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
        .select("id, occurred_at, actor_id, actor_email, actor_name, event_source, action, table_name, record_id, competition_id, summary, old_data, new_data, metadata, context", { count: "exact" })
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


// Reconstruct readable context for historical audit entries that pre-date the
// enriched audit trigger. These values are current linked records, not a claim
// about what their names were at the time of the original event.
export async function getAuditEntryEnrichment(entry) {
    const before = entry?.old_data || {};
    const after = entry?.new_data || {};
    const row = { ...before, ...after };
    const result = {
        historical: false,
        competition: null,
        match: null,
        round: null,
        section: null,
        teams: [],
        player: null,
        teamAssignments: []
    };

    const fetchByIds = async (table, select, ids) => {
        const unique = [...new Set(ids.filter(Boolean).map(String))];
        if (!unique.length) return [];
        const { data, error } = await supabase.from(table).select(select).in("id", unique);
        if (error) {
            console.warn(`Could not resolve historical audit ${table}:`, error.message);
            return [];
        }
        return data || [];
    };

    const competitionId = entry.competition_id || row.competition_id;
    const matchId = entry.table_name === "competition_matches"
        ? (entry.record_id || row.id)
        : null;

    if (competitionId) {
        const { data, error } = await supabase.from("competitions")
            .select("id, name, format, start_date, status")
            .eq("id", competitionId).maybeSingle();
        if (!error) result.competition = data;
    }

    const teamFields = ["team_a_id", "team_b_id", "competition_team_id"];
    const teamIds = teamFields.flatMap(field => [before[field], after[field]]).filter(Boolean);
    const teams = await fetchByIds(
        "competition_teams",
        "id, competition_id, team_number, team_name, club_id, clubs(id, name, short_name)",
        teamIds
    );
    result.teams = teams.map(team => ({
        id: team.id,
        label: [
            team.clubs?.short_name || team.clubs?.name,
            team.team_name || (team.team_number != null ? `Team ${team.team_number}` : null)
        ].filter(Boolean).join(" — ") || `Team ${team.id}`,
        club: team.clubs?.name || null
    }));

    const sectionIds = [before.section_id, after.section_id].filter(Boolean);
    const sections = await fetchByIds(
        "competition_sections",
        "id, competition_id, section_number, section_name",
        sectionIds
    );
    const sectionLabel = section => section?.section_name
        || (section?.section_number != null ? `Section ${section.section_number}` : null)
        || (section?.id ? `Section ${section.id}` : "—");
    result.teamAssignments = sectionIds.map(id => {
        const section = sections.find(item => String(item.id) === String(id));
        return { id, label: sectionLabel(section) };
    });

    const roundIds = [before.round_id, after.round_id].filter(Boolean);
    const rounds = await fetchByIds(
        "competition_rounds",
        "id, competition_id, round_number, round_name, competition_day_id",
        roundIds
    );
    result.round = rounds[0] ? {
        id: rounds[0].id,
        label: rounds[0].round_name || (rounds[0].round_number != null ? `Round ${rounds[0].round_number}` : "Round")
    } : null;

    if (matchId) {
        const { data: match, error } = await supabase.from("competition_matches")
            .select("id, competition_id, round_id, section_id, match_number, team_a_id, team_b_id, score_a, score_b, completed")
            .eq("id", matchId).maybeSingle();
        if (!error && match) {
            result.match = match;
            const [matchTeams, matchSections, matchRounds] = await Promise.all([
                fetchByIds("competition_teams", "id, competition_id, team_number, team_name, club_id, clubs(id, name, short_name)", [match.team_a_id, match.team_b_id]),
                fetchByIds("competition_sections", "id, competition_id, section_number, section_name", [match.section_id]),
                fetchByIds("competition_rounds", "id, competition_id, round_number, round_name, competition_day_id", [match.round_id])
            ]);
            for (const team of matchTeams) {
                if (!result.teams.some(item => item.id === team.id)) {
                    result.teams.push({
                        id: team.id,
                        label: [team.clubs?.short_name || team.clubs?.name, team.team_name || (team.team_number != null ? `Team ${team.team_number}` : null)].filter(Boolean).join(" — ") || `Team ${team.id}`,
                        club: team.clubs?.name || null
                    });
                }
            }
            if (matchSections[0]) result.section = sectionLabel(matchSections[0]);
            if (matchRounds[0]) result.round = {
                id: matchRounds[0].id,
                label: matchRounds[0].round_name || (matchRounds[0].round_number != null ? `Round ${matchRounds[0].round_number}` : "Round")
            };
        }
    }

    if (entry.table_name === "competition_section_teams") {
        const teamId = after.competition_team_id || before.competition_team_id;
        const team = result.teams.find(item => String(item.id) === String(teamId));
        const oldSection = sections.find(item => String(item.id) === String(before.section_id));
        const newSection = sections.find(item => String(item.id) === String(after.section_id));
        result.teamMove = {
            team: team?.label || (teamId ? `Team ${teamId}` : "Unknown team"),
            from: sectionLabel(oldSection),
            to: sectionLabel(newSection)
        };
    }

    const playerId = after.player_id || before.player_id;
    if (playerId) {
        const { data, error } = await supabase.from("players")
            .select("id, first_name, nickname, last_name, display_name")
            .eq("id", playerId).maybeSingle();
        if (!error && data) result.player = data.display_name
            || [data.nickname || data.first_name, data.last_name].filter(Boolean).join(" ");
    }

    result.historical = Boolean(
        result.competition || result.match || result.teams.length ||
        result.teamAssignments.length || result.player
    );
    return result;
}
