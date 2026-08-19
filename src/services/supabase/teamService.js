import { supabase } from "../../lib/supabaseClient";


/*
 * Create a team.
 */
export async function createTeam(name) {

    const cleanName = name.trim();

    if (!cleanName) {
        throw new Error(
            "Team name cannot be empty."
        );
    }

    const { data, error } = await supabase
        .from("teams")
        .insert({
            name: cleanName
        })
        .select()
        .single();

    if (error) {
        throw error;
    }

    return data;

}


/*
 * Add an existing team to a tournament.
 */
export async function addTeamToTournament({

    tournamentId,
    teamId,
    teamPosition = null

}) {

    const { data, error } = await supabase
        .from("tournament_teams")
        .insert({
            tournament_id: tournamentId,
            team_id: teamId,
            team_position: teamPosition
        })
        .select()
        .single();

    if (error) {
        throw error;
    }

    return data;

}


/*
 * Get all teams belonging to a tournament.
 */
export async function getTournamentTeams(
    tournamentId
) {

    const { data, error } = await supabase
        .from("tournament_teams")
        .select(`
            id,
            team_position,
            team:teams (
                id,
                name
            )
        `)
        .eq(
            "tournament_id",
            tournamentId
        )
        .order(
            "team_position",
            {
                ascending: true,
                nullsFirst: false
            }
        );

    if (error) {
        throw error;
    }

    return data;

}


/*
 * Create a team and add it to a tournament.
 *
 * Useful when we connect TeamList to Supabase.
 */
export async function createAndAddTeam({

    tournamentId,
    name,
    teamPosition = null

}) {

    const team =
        await createTeam(name);

    await addTeamToTournament({
        tournamentId,
        teamId: team.id,
        teamPosition
    });

    return team;

}