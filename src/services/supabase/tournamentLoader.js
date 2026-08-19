import { getTournamentById } from "./tournamentService";
import { getTournamentTeams } from "./teamService";
import { getTournamentRounds } from "./matchService";


/*
 * Load a complete BowlPoint tournament from Supabase.
 *
 * This converts the relational Supabase structure back
 * into the tournament object used by the BowlPoint engines.
 */
export async function loadTournament(tournamentId) {

    if (!tournamentId) {

        throw new Error(
            "Tournament ID is required."
        );

    }


    /*
     * Load the main tournament.
     */
    const tournament =
        await getTournamentById(
            tournamentId
        );


    /*
     * Load the tournament's teams.
     */
    const tournamentTeams =
        await getTournamentTeams(
            tournamentId
        );


    /*
     * Load rounds and matches.
     */
    const tournamentRounds =
        await getTournamentRounds(
            tournamentId
        );


    /*
     * Reconstruct teams.
     *
     * IMPORTANT:
     * Keep both:
     *
     * id              = Supabase team ID
     * supabaseTeamId  = Supabase team ID
     *
     * The latter is used by the existing QuickTournament
     * database update logic.
     */
    const teams =
        tournamentTeams.map(
            tournamentTeam => ({

                id:
                    tournamentTeam.team.id,

                supabaseTeamId:
                    tournamentTeam.team.id,

                name:
                    tournamentTeam.team.name

            })
        );


    /*
     * Reconstruct rounds.
     */
    const rounds =
        tournamentRounds.map(
            round => {

                const matches =
                    (round.matches || [])
                        .map(match => ({

                            /*
                             * Local match ID is the
                             * Supabase match ID.
                             */
                            id:
                                match.id,

                            /*
                             * Keep the explicit Supabase ID
                             * because QuickTournament uses it
                             * when updating scores/draws.
                             */
                            supabaseMatchId:
                                match.id,

                            matchNumber:
                                match.match_number,

                            teamA:
                                match.teamA
                                    ? {
                                        id:
                                            match.teamA.id,

                                        supabaseTeamId:
                                            match.teamA.id,

                                        name:
                                            match.teamA.name
                                    }
                                    : null,

                            teamB:
                                match.teamB
                                    ? {
                                        id:
                                            match.teamB.id,

                                        supabaseTeamId:
                                            match.teamB.id,

                                        name:
                                            match.teamB.name
                                    }
                                    : null,

                            scoreA:
                                match.score_a,

                            scoreB:
                                match.score_b,

                            skinsA:
                                match.skins_a,

                            skinsB:
                                match.skins_b,

                            completed:
                                match.completed,

                            completedAt:
                                match.completed_at

                        }));


                /*
                 * Determine whether this round has a BYE.
                 *
                 * We don't currently store BYEs as database
                 * matches, so we determine the BYE team by
                 * finding the tournament team that does not
                 * appear in any match in this round.
                 */
                const participatingTeamIds =
                    new Set();


                matches.forEach(match => {

                    if (match.teamA?.id) {

                        participatingTeamIds.add(
                            match.teamA.id
                        );

                    }

                    if (match.teamB?.id) {

                        participatingTeamIds.add(
                            match.teamB.id
                        );

                    }

                });


                const byeTeam =
                    teams.find(
                        team =>
                            !participatingTeamIds.has(
                                team.id
                            )
                    ) || null;


                return {

                    id:
                        round.id,

                    number:
                        round.round_number,

                    status:
                        round.status,

                    matches,

                    byeTeam

                };

            }
        );


    /*
     * Return the structure expected by
     * QuickTournament and the tournament engines.
     */
    return {

        /*
         * The database ID is the canonical tournament ID.
         */
        id:
            tournament.id,

        /*
         * Keep the explicit property used by the
         * existing QuickTournament code.
         */
        supabaseTournamentId:
            tournament.id,

        publicCode:
            tournament.public_code,

        name:
            tournament.name,

        status:
            tournament.status,

        totalRounds:
            tournament.total_rounds,

        currentRound:
            tournament.current_round,

        scoring:
            tournament.scoring,

        isPublic:
            tournament.is_public,

        createdAt:
            tournament.created_at,

        updatedAt:
            tournament.updated_at,

        teams,

        rounds

    };

}