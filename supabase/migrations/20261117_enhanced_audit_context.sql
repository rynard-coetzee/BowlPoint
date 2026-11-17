-- BowlPoint enriched audit context.
-- Forward-only migration: preserves existing audit rows, triggers and one-year retention.
-- Related-row snapshots are captured at event time so later renames/deletions do not
-- erase the meaning of historical audit entries.

alter table public.audit_logs
    add column if not exists context jsonb not null default '{}'::jsonb;

create index if not exists audit_logs_context_gin_idx
    on public.audit_logs using gin (context);

create or replace function public.audit_display_label(p_row jsonb)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
    v_label text;
    v_part text;
begin
    if p_row is null then return null; end if;

    foreach v_part in array array[
        'display_name', 'team_name', 'section_name', 'competition_name',
        'full_name', 'name', 'title', 'club_name', 'nickname', 'email'
    ] loop
        v_label := nullif(btrim(p_row ->> v_part), '');
        if v_label is not null then return v_label; end if;
    end loop;

    if nullif(p_row ->> 'first_name', '') is not null
       or nullif(p_row ->> 'last_name', '') is not null then
        return concat_ws(' ', nullif(p_row ->> 'first_name', ''),
                              nullif(p_row ->> 'last_name', ''));
    end if;

    if nullif(p_row ->> 'section_number', '') is not null then
        return 'Section ' || (p_row ->> 'section_number');
    end if;
    if nullif(p_row ->> 'team_number', '') is not null then
        return 'Team ' || (p_row ->> 'team_number');
    end if;
    return null;
end;
$$;

-- Capture readable labels and sanitized snapshots for every single-column FK.
-- This is schema-driven, so it works across BowlPoint modules without assuming
-- that every table uses the same naming convention.
create or replace function public.audit_build_row_context(
    p_table_schema text,
    p_table_name text,
    p_row jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    fk record;
    v_fk_value text;
    v_related jsonb;
    v_items jsonb := '[]'::jsonb;
    v_competition_id text;
begin
    for fk in
        select
            c.conname,
            rn.nspname as ref_schema,
            rt.relname as ref_table,
            ra.attname as ref_column,
            la.attname as local_column
        from pg_catalog.pg_constraint c
        join pg_catalog.pg_class lt on lt.oid = c.conrelid
        join pg_catalog.pg_namespace ln on ln.oid = lt.relnamespace
        join pg_catalog.pg_class rt on rt.oid = c.confrelid
        join pg_catalog.pg_namespace rn on rn.oid = rt.relnamespace
        join pg_catalog.pg_attribute la
          on la.attrelid = lt.oid and la.attnum = c.conkey[1]
        join pg_catalog.pg_attribute ra
          on ra.attrelid = rt.oid and ra.attnum = c.confkey[1]
        where c.contype = 'f'
          and ln.nspname = p_table_schema
          and lt.relname = p_table_name
          and array_length(c.conkey, 1) = 1
          and array_length(c.confkey, 1) = 1
        order by la.attname
    loop
        v_fk_value := nullif(p_row ->> fk.local_column, '');
        if v_fk_value is null then continue; end if;

        v_related := null;
        begin
            execute format(
                'select to_jsonb(r) from %I.%I r where r.%I::text = $1 limit 1',
                fk.ref_schema, fk.ref_table, fk.ref_column
            ) into v_related using v_fk_value;
        exception when others then
            -- A broken/unsupported relationship must not prevent the source
            -- database operation or its primary audit row from being recorded.
            v_related := null;
        end;

        if v_related is not null then
            v_related := public.audit_sanitise_row(v_related);
            v_items := v_items || jsonb_build_array(jsonb_build_object(
                'column', fk.local_column,
                'table', fk.ref_table,
                'record_id', v_fk_value,
                'label', public.audit_display_label(v_related)
            ));
            if v_competition_id is null then
                v_competition_id := nullif(v_related ->> 'competition_id', '');
                if v_competition_id is null and fk.ref_table = 'competitions' then
                    v_competition_id := nullif(v_related ->> 'id', '');
                end if;
            end if;
        end if;
    end loop;

    -- Resolve the competition one level beyond section/team rows so the
    -- audit screen can show its name even when the audited table has no
    -- direct competition_id column.
    if v_competition_id is null then
        v_competition_id := nullif(p_row ->> 'competition_id', '');
    end if;
    if v_competition_id is not null then
        begin
            execute 'select to_jsonb(c) from public.competitions c where c.id::text = $1 limit 1'
                into v_related using v_competition_id;
            if v_related is not null then
                v_items := v_items || jsonb_build_array(jsonb_build_object(
                    'column', 'competition_id',
                    'table', 'competitions',
                    'record_id', v_competition_id,
                    'label', public.audit_display_label(public.audit_sanitise_row(v_related))
                ));
            end if;
        exception when undefined_table or undefined_column then
            null;
        end;
    end if;

    return jsonb_build_object(
        'relationships', v_items,
        'record_label', public.audit_display_label(public.audit_sanitise_row(p_row)),
        'competition_id', v_competition_id
    );
end;
$$;

-- Replace the row trigger with enriched snapshots and readable summaries.
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
    v_context jsonb;
    v_old_context jsonb;
    v_new_context jsonb;
    v_relationships jsonb;
    v_from text;
    v_to text;
    v_team text;
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
        if v_old = v_new then return new; end if;
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
        from public.profiles p where p.id = v_actor;
    end if;

    v_record_id := coalesce(
        v_row ->> 'id', v_row ->> 'competition_id',
        v_row ->> 'section_id', v_row ->> 'round_id',
        v_row ->> 'match_id', v_row ->> 'user_id'
    );

    v_competition_id := nullif(v_row ->> 'competition_id', '');

    if tg_op <> 'DELETE' then
        v_context := public.audit_build_row_context(tg_table_schema, tg_table_name, v_row);
    else
        v_context := public.audit_build_row_context(tg_table_schema, tg_table_name, v_row);
    end if;

    if v_competition_id is null then
        v_competition_id := nullif(v_context ->> 'competition_id', '');
    end if;

    -- Also resolve competition through a section/team relationship when the
    -- immediate related row itself does not carry competition_id.
    if v_competition_id is null and tg_table_schema = 'public' then
        if tg_table_name = 'competition_section_teams' then
            begin
                select s.competition_id::text into v_competition_id
                from public.competition_sections s
                where s.id::text = coalesce(v_row ->> 'section_id', '');
            exception when undefined_table or undefined_column then
                v_competition_id := null;
            end;
        end if;
    end if;

    v_summary := format('%s on %s (record %s)',
        v_action, tg_table_name, coalesce(v_record_id, 'unknown'));

    -- Specific operational wording for a team reassignment. The context holds
    -- old/new relationship snapshots, including their names at event time.
    if tg_table_schema = 'public'
       and tg_table_name = 'competition_section_teams'
       and tg_op = 'UPDATE'
       and (v_old ->> 'section_id') is distinct from (v_new ->> 'section_id') then
        v_old_context := public.audit_build_row_context(tg_table_schema, tg_table_name, to_jsonb(old));
        v_new_context := public.audit_build_row_context(tg_table_schema, tg_table_name, to_jsonb(new));

        select x ->> 'label' into v_from
        from jsonb_array_elements(coalesce(v_old_context -> 'relationships', '[]'::jsonb)) x
        where x ->> 'column' = 'section_id' limit 1;
        select x ->> 'label' into v_to
        from jsonb_array_elements(coalesce(v_new_context -> 'relationships', '[]'::jsonb)) x
        where x ->> 'column' = 'section_id' limit 1;
        select x ->> 'label' into v_team
        from jsonb_array_elements(coalesce(v_new_context -> 'relationships', '[]'::jsonb)) x
        where x ->> 'column' = 'competition_team_id' limit 1;

        v_summary := format('Team %s moved from %s to %s',
            coalesce(v_team, 'assignment'),
            coalesce(v_from, 'previous section'),
            coalesce(v_to, 'new section'));
        v_context := jsonb_build_object(
            'old_relationships', coalesce(v_old_context -> 'relationships', '[]'::jsonb),
            'new_relationships', coalesce(v_new_context -> 'relationships', '[]'::jsonb),
            'competition_id', coalesce(v_competition_id, v_new_context ->> 'competition_id')
        );
        v_competition_id := coalesce(v_competition_id, nullif(v_new_context ->> 'competition_id', ''));
    else
        v_context := coalesce(v_context, '{}'::jsonb);
        if v_context -> 'relationships' is not null
           and jsonb_array_length(v_context -> 'relationships') > 0 then
            v_summary := format('%s %s%s',
                case v_action when 'INSERT' then 'Created' when 'DELETE' then 'Deleted' else 'Updated' end,
                replace(tg_table_name, '_', ' '),
                case when nullif(v_context ->> 'record_label', '') is not null
                     then ': ' || (v_context ->> 'record_label') else '' end);
        end if;
    end if;

    insert into public.audit_logs (
        actor_id, actor_email, actor_name, event_source, action,
        table_name, record_id, competition_id, summary, old_data, new_data,
        metadata, context
    ) values (
        v_actor, v_email, v_name, 'database', v_action,
        tg_table_name, v_record_id, v_competition_id, v_summary, v_old, v_new,
        jsonb_build_object('schema', tg_table_schema, 'operation', tg_op),
        coalesce(v_context, '{}'::jsonb)
    );

    if tg_op = 'DELETE' then return old; end if;
    return new;
end;
$$;

comment on column public.audit_logs.context is
    'Human-readable related-record context captured at the time of the audited database event.';
