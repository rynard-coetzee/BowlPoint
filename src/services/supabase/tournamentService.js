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
            characters[value % characters.length]
        )
        .join("");

}


/*
 * Return the currently authenticated user and BowlPoint role.
 *
 * Quick Score is owned by the authenticated user. Admins and
 * Competition Secretaries can manage all Quick Scores.
 */
async function getCurrentUserContext() {

    const { data: userData, error: userError } =
        await supabase.auth.getUser();

    if (userError) {
        throw userError;
    }

    const user = userData?.user;

    if (!user) {
        throw new Error("You must be logged in to manage Quick Score tournaments.");
    }

    const { data: profile, error: profileError } =
        await supabase
            .from("profiles")
            .select("role")
            .eq("id", user.id)
            .maybeSingle();

    if (profileError) {
        throw profileError;
    }

    return {
        user,
        role: profile?.role || "user"
    };

}


function isManager(role) {
    return role === "admin" || role === "comp_secretary";
}


/*
 * Create a new tournament.
 *
 * Every Quick Score tournament is automatically owned by the
 * currently logged-in user.
 */
export async function endQuickScoreTournament(tournamentId) {

    if (!tournamentId) {
        throw new Error("Tournament ID is required.");
    }

    const { error } = await supabase.rpc(
        "end_quick_score_tournament",
        {
            p_tournament_id: tournamentId
        }
    );

    if (error) {
        throw error;
    }

}


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

    const { user } = await getCurrentUserContext();

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
                    public_code: publicCode,
                    name: name.trim(),
                    status,
                    total_rounds: totalRounds,
                    current_round: currentRound,
                    scoring,
                    is_public: isPublic,
                    created_by: user.id
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
 * Admins and Competition Secretaries can open any Quick Score.
 * Normal users can only open their own.
 */
export async function getTournamentById(
    tournamentId
) {

    const { user, role } =
        await getCurrentUserContext();

    let query =
        supabase
            .from("tournaments")
            .select("*")
            .eq("id", tournamentId);

    if (!isManager(role)) {
        query = query.eq("created_by", user.id);
    }

    const { data, error } =
        await query.single();

    if (error) {
        throw error;
    }

    return data;

}


/*
 * Get all tournaments visible to the current Quick Score user.
 *
 * Admins and Competition Secretaries see all tournaments.
 * Normal users see only tournaments they created.
 */
export async function getTournaments() {

    const { user, role } =
        await getCurrentUserContext();

    let query =
        supabase
            .from("tournaments")
            .select("*");

    if (!isManager(role)) {
        query = query.eq("created_by", user.id);
    }

    const { data, error } =
        await query.order(
            "updated_at",
            { ascending: false }
        );

    if (error) {
        throw error;
    }

    return data || [];

}


/*
 * Get active tournaments visible to the current user.
 */
export async function getActiveTournaments() {

    const { user, role } =
        await getCurrentUserContext();

    let query =
        supabase
            .from("tournaments")
            .select("*")
            .in(
                "status",
                [
                    "setup",
                    "generated",
                    "in_progress"
                ]
            );

    if (!isManager(role)) {
        query = query.eq("created_by", user.id);
    }

    const { data, error } =
        await query.order(
            "updated_at",
            { ascending: false }
        );

    if (error) {
        throw error;
    }

    return data || [];

}


/*
 * Get completed tournaments visible to the current user.
 *
 * Completed Quick Scores remain available until the organiser
 * explicitly uses End Tournament.
 */
export async function getCompletedTournaments() {

    const { user, role } =
        await getCurrentUserContext();

    let query =
        supabase
            .from("tournaments")
            .select("*")
            .eq("status", "completed");

    if (!isManager(role)) {
        query = query.eq("created_by", user.id);
    }

    const { data, error } =
        await query.order(
            "updated_at",
            { ascending: false }
        );

    if (error) {
        throw error;
    }

    return data || [];

}


/*
 * Get a tournament by its public QR code.
 *
 * This deliberately does not apply ownership filtering because
 * the public live page must remain accessible to spectators.
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
 *
 * Admins and Competition Secretaries can update any Quick Score.
 * Normal users can only update their own.
 */
export async function updateTournament(
    tournamentId,
    updates
) {

    const { user, role } =
        await getCurrentUserContext();

    const databaseUpdates = {};

    if (updates.name !== undefined) {
        databaseUpdates.name = updates.name.trim();
    }

    if (updates.totalRounds !== undefined) {
        databaseUpdates.total_rounds = updates.totalRounds;
    }

    if (updates.currentRound !== undefined) {
        databaseUpdates.current_round = updates.currentRound;
    }

    if (updates.status !== undefined) {
        databaseUpdates.status = updates.status;
    }

    if (updates.scoring !== undefined) {
        databaseUpdates.scoring = updates.scoring;
    }

    if (updates.isPublic !== undefined) {
        databaseUpdates.is_public = updates.isPublic;
    }

    databaseUpdates.updated_at =
        new Date().toISOString();

    let query =
        supabase
            .from("tournaments")
            .update(databaseUpdates)
            .eq("id", tournamentId);

    if (!isManager(role)) {
        query = query.eq("created_by", user.id);
    }

    const { data, error } =
        await query
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
        { isPublic: true }
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
        { isPublic: false }
    );

}
