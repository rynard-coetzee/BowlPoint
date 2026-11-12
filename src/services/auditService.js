import { supabase } from "../lib/supabaseClient";

export async function logAuditEvent(action, summary, metadata = {}, competitionId = null) {
    const { error } = await supabase.rpc("audit_log_event", {
        p_action: action,
        p_summary: summary,
        p_metadata: metadata,
        p_competition_id: competitionId ? String(competitionId) : null
    });

    if (error) {
        // Audit logging must not prevent the user's primary action from completing.
        console.warn("BowlPoint audit event could not be recorded:", error.message);
    }
}

export async function getAuditLogs({
    search = "",
    action = "",
    from = "",
    to = "",
    limit = 100,
    offset = 0
} = {}) {
    let query = supabase
        .from("audit_logs")
        .select("id, occurred_at, actor_id, actor_email, actor_name, event_source, action, table_name, record_id, competition_id, summary, old_data, new_data, metadata", { count: "exact" })
        .order("occurred_at", { ascending: false })
        .range(offset, offset + limit - 1);

    if (action) query = query.eq("action", action);
    if (from) query = query.gte("occurred_at", `${from}T00:00:00`);
    if (to) query = query.lt("occurred_at", `${to}T23:59:59.999`);
    if (search.trim()) {
        const term = search.trim().replace(/[(),]/g, " ");
        query = query.or(`summary.ilike.%${term}%,actor_email.ilike.%${term}%,actor_name.ilike.%${term}%,table_name.ilike.%${term}%,record_id.ilike.%${term}%`);
    }

    const { data, error, count } = await query;
    if (error) throw error;
    return { rows: data || [], count: count || 0 };
}
