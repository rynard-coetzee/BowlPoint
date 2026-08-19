import { supabase } from "../../lib/supabaseClient";


/*
 * Create a round.
 */
export async function createRound({

    tournamentId,
    roundNumber,
    status = "pending"

}) {

    const { data, error } = await supabase
        .from("rounds")
        .insert({
            tournament_id: tournamentId,
            round_number: roundNumber,
            status
        })
        .select()
        .single();

    if (error) {
        throw error;
    }

    return data;

}


/*
 * Create a match.
 */
export async function createMatch({

    roundId,
    matchNumber,
    teamAId = null,
    teamBId = null

}) {

    const { data, error } = await supabase
        .from("matches")
        .insert({
            round_id: roundId,
            match_number: matchNumber,
            team_a_id: teamAId,
            team_b_id: teamBId
        })
        .select()
        .single();

    if (error) {
        throw error;
    }

    return data;

}

/*
 * Update the teams assigned to a match.
 *
 * Used when the Quick Tournament draw is changed.
 */
export async function updateMatchTeams({

    matchId,
    teamAId,
    teamBId

}) {

    const { data, error } = await supabase
        .from("matches")
        .update({

            team_a_id: teamAId,
            team_b_id: teamBId,

            updated_at:
                new Date().toISOString()

        })
        .eq("id", matchId)
        .select()
        .single();


    if (error) {
        throw error;
    }


    return data;

}
/*
 * Update a match score.
 */
export async function updateMatchScore({

    matchId,
    scoreA,
    scoreB,
    skinsA = null,
    skinsB = null,
    completed = true

}) {

    const updates = {

        score_a: scoreA,
        score_b: scoreB,

        skins_a: skinsA,
        skins_b: skinsB,

        completed,

        completed_at: completed
            ? new Date().toISOString()
            : null,

        updated_at:
            new Date().toISOString()

    };

    const { data, error } = await supabase
        .from("matches")
        .update(updates)
        .eq("id", matchId)
        .select()
        .single();

    if (error) {
        throw error;
    }

    return data;

}


/*
 * Get all matches for a round.
 */
export async function getRoundMatches(
    roundId
) {

    const { data, error } = await supabase
        .from("matches")
        .select(`
            *,
            teamA:teams!matches_team_a_id_fkey (
                id,
                name
            ),
            teamB:teams!matches_team_b_id_fkey (
                id,
                name
            )
        `)
        .eq(
            "round_id",
            roundId
        )
        .order(
            "match_number",
            {
                ascending: true
            }
        );

    if (error) {
        throw error;
    }

    return data;

}


/*
 * Get all rounds and matches for a tournament.
 */
export async function getTournamentRounds(
    tournamentId
) {

    const { data, error } = await supabase
        .from("rounds")
        .select(`
            *,
            matches (
                *,
                teamA:teams!matches_team_a_id_fkey (
                    id,
                    name
                ),
                teamB:teams!matches_team_b_id_fkey (
                    id,
                    name
                )
            )
        `)
        .eq(
            "tournament_id",
            tournamentId
        )
        .order(
            "round_number",
            {
                ascending: true
            }
        );

    if (error) {
        throw error;
    }

    return data;

}