import { supabase } from "../../lib/supabaseClient";


/*
 * Generate a short public tournament code.
 *
 * We deliberately avoid characters that are easily confused:
 *
 * 0 / O
 * 1 / I
 * 5 / S
 */
function generatePublicCode(length = 6) {

    const characters =
        "ABCDEFGHJKLMNPQRTUVWXYZ2346789";


    const values =
        new Uint32Array(length);


    crypto.getRandomValues(values);


    return Array.from(values)

        .map(value =>
            characters[
                value % characters.length
            ]
        )

        .join("");

}


/*
 * Create a new tournament.
 */
export async function createTournament({

    name,

    totalRounds = 1,

    scoring = {
        win: 2,

        skins: {
            enabled: false,
            pointsPerSkin: 1
        }
    },

    status = "setup",

    currentRound = 0,

    isPublic = false

}) {

    for (
        let attempt = 0;
        attempt < 5;
        attempt++
    ) {

        const publicCode =
            generatePublicCode();


        const { data, error } =
            await supabase

                .from("tournaments")

                .insert({

                    public_code:
                        publicCode,

                    name:
                        name.trim(),

                    status,

                    total_rounds:
                        totalRounds,

                    current_round:
                        currentRound,

                    scoring,

                    is_public:
                        isPublic

                })

                .select()

                .single();


        if (!error) {

            return data;

        }


        /*
         * If the code happened to collide,
         * try another one.
         */
        if (error.code !== "23505") {

            throw error;

        }

    }


    throw new Error(
        "Unable to generate a unique tournament code."
    );

}


/*
 * Get a tournament by its internal database ID.
 *
 * This is used by the organiser/admin interface.
 */
export async function getTournamentById(
    tournamentId
) {

    const { data, error } =
        await supabase

            .from("tournaments")

            .select("*")

            .eq(
                "id",
                tournamentId
            )

            .single();


    if (error) {

        throw error;

    }


    return data;

}


/*
 * Get all tournaments.
 *
 * Phase 1/2 currently allows public access because
 * authentication has not yet been introduced.
 *
 * We will add owner_id and proper RLS later.
 */
export async function getTournaments() {

    const { data, error } =
        await supabase

            .from("tournaments")

            .select("*")

            .order(
                "updated_at",
                {
                    ascending: false
                }
            );


    if (error) {

        throw error;

    }


    return data || [];

}


/*
 * Get active tournaments.
 */
export async function getActiveTournaments() {

    const { data, error } =
        await supabase

            .from("tournaments")

            .select("*")

            .in(
                "status",
                [
                    "setup",
                    "generated",
                    "in_progress"
                ]
            )

            .order(
                "updated_at",
                {
                    ascending: false
                }
            );


    if (error) {

        throw error;

    }


    return data || [];

}


/*
 * Get completed tournaments.
 */
export async function getCompletedTournaments() {

    const { data, error } =
        await supabase

            .from("tournaments")

            .select("*")

            .eq(
                "status",
                "completed"
            )

            .order(
                "updated_at",
                {
                    ascending: false
                }
            );


    if (error) {

        throw error;

    }


    return data || [];

}


/*
 * Get a tournament by its public QR code.
 */
export async function getTournamentByPublicCode(
    publicCode
) {

    const { data, error } =
        await supabase

            .from("tournaments")

            .select("*")

            .eq(
                "public_code",
                publicCode.toUpperCase()
            )

            .eq(
                "is_public",
                true
            )

            .single();


    if (error) {

        throw error;

    }


    return data;

}


/*
 * Update tournament information.
 */
export async function updateTournament(
    tournamentId,
    updates
) {

    const databaseUpdates = {};


    if (
        updates.name !== undefined
    ) {

        databaseUpdates.name =
            updates.name.trim();

    }


    if (
        updates.totalRounds !== undefined
    ) {

        databaseUpdates.total_rounds =
            updates.totalRounds;

    }


    if (
        updates.currentRound !== undefined
    ) {

        databaseUpdates.current_round =
            updates.currentRound;

    }


    if (
        updates.status !== undefined
    ) {

        databaseUpdates.status =
            updates.status;

    }


    if (
        updates.scoring !== undefined
    ) {

        databaseUpdates.scoring =
            updates.scoring;

    }


    if (
        updates.isPublic !== undefined
    ) {

        databaseUpdates.is_public =
            updates.isPublic;

    }


    databaseUpdates.updated_at =
        new Date().toISOString();


    const { data, error } =
        await supabase

            .from("tournaments")

            .update(
                databaseUpdates
            )

            .eq(
                "id",
                tournamentId
            )

            .select()

            .single();


    if (error) {

        throw error;

    }


    return data;

}


/*
 * Publish a tournament.
 */
export async function publishTournament(
    tournamentId
) {

    return updateTournament(

        tournamentId,

        {
            isPublic: true
        }

    );

}


/*
 * Unpublish a tournament.
 */
export async function unpublishTournament(
    tournamentId
) {

    return updateTournament(

        tournamentId,

        {
            isPublic: false
        }

    );

}