import { supabase } from "../../lib/supabaseClient";

/*
 * Reporting data loader for the current BowlPoint competition schema.
 *
 * Reports deliberately use the persisted competition data rather than
 * duplicating scoring/draw logic. This keeps the reporting layer read-only.
 */
export async function getReportCompetitions() {
    const { data, error } = await supabase
        .from("competitions")
        .select("id, name, format, structure, status, start_date, end_date, scoring, public_code")
        .order("start_date", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false });

    if (error) throw error;

    return data || [];
}

export async function getCompetitionReportData(competitionId) {
    const [competitionResult, teamsResult, roundsResult, sectionsResult, matchesResult] = await Promise.all([
        supabase
            .from("competitions")
            .select("id, name, format, structure, status, start_date, end_date, scoring, public_code")
            .eq("id", competitionId)
            .single(),

        supabase
            .from("competition_teams")
            .select("id, competition_id, club_id, team_number, team_name, status, clubs (id, name, short_name)")
            .eq("competition_id", competitionId)
            .order("team_number"),

        supabase
            .from("competition_rounds")
            .select("id, competition_id, competition_day_id, round_number, round_name, status, competition_days (id, day_number, playing_date, name, venue_club_id, clubs (id, name, short_name))")
            .eq("competition_id", competitionId)
            .order("round_number"),

        supabase
            .from("competition_sections")
            .select("id, competition_id, section_number, section_name")
            .eq("competition_id", competitionId)
            .order("section_number"),

        supabase
            .from("competition_matches")
            .select("id, competition_id, round_id, section_id, match_number, team_a_id, team_b_id, score_a, score_b, skins_a, skins_b, points_a, points_b, shots_for_a, shots_for_b, completed, completed_at")
            .eq("competition_id", competitionId)
            .order("match_number"),

    ]);

    if (competitionResult.error) throw competitionResult.error;
    if (teamsResult.error) throw teamsResult.error;
    if (roundsResult.error) throw roundsResult.error;
    if (sectionsResult.error) throw sectionsResult.error;
    if (matchesResult.error) throw matchesResult.error;

    const teams = teamsResult.data || [];
    let teamPlayers = [];

    // Fetch team/player membership now that we have the real team IDs.
    if (teams.length) {
        const { data, error } = await supabase
            .from("competition_team_players")
            .select("id, competition_team_id, player_id, position, position_order, players (id, first_name, nickname, last_name, display_name)")
            .in("competition_team_id", teams.map(team => team.id));

        if (error) throw error;
        teamPlayers = data || [];
    }

    const teamById = new Map(teams.map(team => [team.id, team]));
    const roundById = new Map((roundsResult.data || []).map(round => [round.id, round]));

    const { data: sectionTeamRows, error: sectionTeamError } = await supabase
        .from("competition_section_teams")
        .select("id, section_id, competition_team_id")
        .in(
            "section_id",
            (sectionsResult.data || []).length
                ? sectionsResult.data.map(section => section.id)
                : ["00000000-0000-0000-0000-000000000000"]
        );

    if (sectionTeamError) throw sectionTeamError;

    const sections = (sectionsResult.data || []).map(section => ({
        ...section,
        teams: (sectionTeamRows || [])
            .filter(row => row.section_id === section.id)
            .map(row => teamById.get(row.competition_team_id))
            .filter(Boolean)
    }));

    const matches = (matchesResult.data || []).map(match => ({
        ...match,
        teamA: teamById.get(match.team_a_id) || null,
        teamB: teamById.get(match.team_b_id) || null,
        round: roundById.get(match.round_id) || null
    }));

    return {
        competition: competitionResult.data,
        teams,
        rounds: roundsResult.data || [],
        sections,
        matches,
        teamPlayers
    };
}
