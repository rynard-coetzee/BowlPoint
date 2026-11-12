-- BowlPoint comprehensive audit logging
-- Apply once through the Supabase SQL Editor or Supabase CLI.
-- Audit records are retained for one year.

create table if not exists public.audit_logs (
    id bigint generated always as identity primary key,
    occurred_at timestamptz not null default now(),
    actor_id uuid,
    actor_email text,
    actor_name text,
    event_source text not null default 'database',
    action text not null,
    table_name text,
    record_id text,
    competition_id text,
    summary text not null,
    old_data jsonb,
    new_data jsonb,
    metadata jsonb not null default '{}'::jsonb
);

create index if not exists audit_logs_occurred_at_idx
    on public.audit_logs (occurred_at desc);
create index if not exists audit_logs_actor_id_idx
    on public.audit_logs (actor_id, occurred_at desc);
create index if not exists audit_logs_action_idx
    on public.audit_logs (action, occurred_at desc);
create index if not exists audit_logs_competition_id_idx
    on public.audit_logs (competition_id, occurred_at desc);
create index if not exists audit_logs_table_record_idx
    on public.audit_logs (table_name, record_id, occurred_at desc);

alter table public.audit_logs enable row level security;

drop policy if exists "Admins can read audit logs" on public.audit_logs;
create policy "Admins can read audit logs"
on public.audit_logs
for select
to authenticated
using (
    exists (
        select 1
        from public.profiles p
        where p.id = (select auth.uid())
          and p.active = true
          and p.role = 'admin'
    )
);

revoke all on public.audit_logs from anon, authenticated;
grant select on public.audit_logs to authenticated;
revoke all on sequence public.audit_logs_id_seq from anon, authenticated;

-- Snapshot sanitiser: retain operational history without copying credentials
-- or high-risk personal identifiers into the audit trail.
create or replace function public.audit_sanitise_row(p_row jsonb)
returns jsonb
language sql
immutable
set search_path = ''
as $$
    select coalesce(p_row, '{}'::jsonb)
        - 'password'
        - 'password_hash'
        - 'access_token'
        - 'refresh_token'
        - 'token'
        - 'secret'
        - 'service_role_key'
        - 'id_number'
        - 'bsa_number';
$$;

-- Generic trigger for row-level INSERT / UPDATE / DELETE events.
create or replace function public.audit_capture_row_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_old jsonb;
    v_new jsonb;
    v_row jsonb;
    v_actor uuid;
    v_email text;
    v_name text;
    v_record_id text;
    v_competition_id text;
    v_action text;
    v_summary text;
begin
    if tg_op = 'INSERT' then
        v_old := null;
        v_new := public.audit_sanitise_row(to_jsonb(new));
        v_row := to_jsonb(new);
        v_action := 'INSERT';
    elsif tg_op = 'UPDATE' then
        v_old := public.audit_sanitise_row(to_jsonb(old));
        v_new := public.audit_sanitise_row(to_jsonb(new));
        v_row := to_jsonb(new);
        v_action := 'UPDATE';
        if v_old = v_new then
            return new;
        end if;
    else
        v_old := public.audit_sanitise_row(to_jsonb(old));
        v_new := null;
        v_row := to_jsonb(old);
        v_action := 'DELETE';
    end if;

    v_actor := auth.uid();
    v_email := nullif(auth.jwt() ->> 'email', '');
    if v_actor is not null then
        select p.full_name into v_name
        from public.profiles p
        where p.id = v_actor;
    end if;

    v_record_id := coalesce(
        v_row ->> 'id',
        v_row ->> 'competition_id',
        v_row ->> 'section_id',
        v_row ->> 'round_id',
        v_row ->> 'match_id',
        v_row ->> 'user_id'
    );

    v_competition_id := coalesce(
        v_row ->> 'competition_id',
        case when tg_table_name = 'competition_sections'
             then v_row ->> 'competition_id' end,
        case when tg_table_name = 'competition_rounds'
             then v_row ->> 'competition_id' end,
        case when tg_table_name = 'competition_matches'
             then v_row ->> 'competition_id' end
    );

    if v_competition_id is null and tg_table_name = 'competition_teams' then
        v_competition_id := v_row ->> 'competition_id';
    end if;

    v_summary := format('%s on %s (record %s)',
        v_action, tg_table_name, coalesce(v_record_id, 'unknown'));

    insert into public.audit_logs (
        actor_id, actor_email, actor_name, event_source, action,
        table_name, record_id, competition_id, summary, old_data, new_data,
        metadata
    ) values (
        v_actor, v_email, v_name, 'database', v_action,
        tg_table_name, v_record_id, v_competition_id, v_summary, v_old, v_new,
        jsonb_build_object('schema', tg_table_schema, 'operation', tg_op)
    );

    if tg_op = 'DELETE' then
        return old;
    end if;
    return new;
end;
$$;

-- Install on all current BowlPoint public application tables. The audit table
-- itself is excluded to prevent recursion.
do $$
declare
    t record;
begin
    for t in
        select c.table_schema, c.table_name
        from information_schema.tables c
        where c.table_schema = 'public'
          and c.table_type = 'BASE TABLE'
          and c.table_name <> 'audit_logs'
          and c.table_name not like 'spatial_%'
    loop
        execute format(
            'drop trigger if exists bowlpoint_audit_row_change on %I.%I',
            t.table_schema, t.table_name
        );
        execute format(
            'create trigger bowlpoint_audit_row_change
             after insert or update or delete on %I.%I
             for each row execute function public.audit_capture_row_change()',
            t.table_schema, t.table_name
        );
    end loop;
end;
$$;

-- Trusted application event endpoint. A signed-in user can only log an event
-- as themselves; browser-supplied actor IDs are never accepted.
create or replace function public.audit_log_event(
    p_action text,
    p_summary text,
    p_metadata jsonb default '{}'::jsonb,
    p_competition_id text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_actor uuid := auth.uid();
    v_email text := nullif(auth.jwt() ->> 'email', '');
    v_name text;
begin
    if v_actor is null then
        raise exception 'Authentication required';
    end if;

    if p_action not in ('LOGIN', 'LOGOUT', 'DRAW_GENERATED', 'WORKFLOW_ACTION') then
        raise exception 'Unsupported audit event';
    end if;

    select p.full_name into v_name
    from public.profiles p
    where p.id = v_actor and p.active = true;

    if not found then
        raise exception 'Active BowlPoint profile required';
    end if;

    insert into public.audit_logs (
        actor_id, actor_email, actor_name, event_source, action,
        competition_id, summary, metadata
    ) values (
        v_actor, v_email, v_name, 'application', p_action,
        p_competition_id, left(coalesce(p_summary, p_action), 500),
        coalesce(p_metadata, '{}'::jsonb)
    );
end;
$$;

revoke all on function public.audit_log_event(text, text, jsonb, text) from public, anon;
grant execute on function public.audit_log_event(text, text, jsonb, text) to authenticated;

-- Keep audit data for one year. If pg_cron is already enabled, schedule a
-- daily cleanup. If pg_cron is unavailable, schedule the cleanup function
-- using another trusted server-side scheduler.
create or replace function public.audit_delete_expired()
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_deleted bigint;
begin
    delete from public.audit_logs
    where occurred_at < now() - interval '1 year';
    get diagnostics v_deleted = row_count;
    return v_deleted;
end;
$$;

revoke all on function public.audit_delete_expired() from public, anon, authenticated;

do $$
begin
    begin
        execute 'create extension if not exists pg_cron';
    exception
        when others then
            raise notice 'pg_cron could not be enabled automatically: %', sqlerrm;
    end;

    if to_regclass('cron.job') is not null then
        if not exists (
            select 1 from cron.job where jobname = 'bowlpoint-audit-retention'
        ) then
            perform cron.schedule(
                'bowlpoint-audit-retention',
                '17 2 * * *',
                'select public.audit_delete_expired();'
            );
        end if;
    end if;
exception
    when undefined_table or undefined_function then
        raise notice 'pg_cron is unavailable; schedule public.audit_delete_expired() externally.';
end;
$$;

comment on table public.audit_logs is
    'BowlPoint audit history. Records are retained for one year.';
