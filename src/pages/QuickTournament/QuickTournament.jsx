import {
    useEffect,
    useRef,
    useState
} from "react";

import {
    useNavigate,
    useParams
} from "react-router-dom";

import PageHeader from "../../components/common/PageHeader";
import TournamentSetup from "../../components/quickTournament/TournamentSetup";
import FixturesCard from "../../components/quickTournament/FixturesCard";
import StandingsCard from "../../components/quickTournament/StandingsCard";
import QRCodeCard from "../../components/quickTournament/QRCodeCard";
import { loadTournament } from "../../services/supabase/tournamentLoader";
import { createTournament } from "../../models/tournament";
import { createTeam } from "../../models/team";

import {
    generateRoundRobinDraw,
    generateStrengthDraw,
    generateNextStrengthRound,
    isRoundComplete
} from "../../lib/drawEngine";

import {
    updateMatchInTournament,
    swapTeamsInRound
} from "../../lib/tournamentEngine";

import {
    calculateStandings
} from "../../lib/standingsEngine";


/*
 * Supabase services
 *
 * Renamed here so they don't conflict with the
 * local tournament/team model functions above.
 */

import {
    createTournament as createSupabaseTournament,
    updateTournament as updateTournamentInDatabase,
    endQuickScoreTournament
} from "../../services/supabase/tournamentService";

import {
    createAndAddTeam
} from "../../services/supabase/teamService";

import {
    createRound,
    createMatch,
    updateRoundStatus,
    updateMatchTeams,
    updateMatchScore as updateSupabaseMatchScore
} from "../../services/supabase/matchService";


function QuickTournament() {

    const [tournament, setTournament] =
        useState(createTournament());

        /*
     * Tournament ID from the URL.
     *
     * When a tournament is opened as:
     *
     * /quick-tournament/<tournament-id>
     *
     * this identifies which tournament should
     * be loaded from Supabase.
     */
    const {
        tournamentId
    } = useParams();

    const navigate = useNavigate();

    /*
     * Loading state used when reopening a
     * persistent tournament.
     */
    const [
        loadingTournament,
        setLoadingTournament
    ] = useState(
        Boolean(tournamentId)
    );


    /*
     * Error encountered while loading.
     */
    const [
        tournamentLoadError,
        setTournamentLoadError
    ] = useState(null);
    /*
     * Controls whether the setup card is collapsed.
     */
    const [setupCollapsed, setSetupCollapsed] =
        useState(false);


    /*
     * Draw editing.
     */
    const [drawEditMode, setDrawEditMode] =
        useState(false);

    const [selectedTeams, setSelectedTeams] =
        useState([]);


    /*
     * Prevent duplicate database operations.
     */
    const [saving, setSaving] =
        useState(false);


    /*
     * Prevent duplicate End Tournament operations.
     */
    const [endingTournament, setEndingTournament] =
        useState(false);

    /* Prevent duplicate next-round generation if two score saves finish
     * at nearly the same time. */
    const strengthRoundGenerationLock =
        useRef(false);


    /*
     * Public tournament information.
     */
    const [publicCode, setPublicCode] =
        useState(null);

        /*
     * Load an existing tournament when the page
     * is opened with a tournament ID.
     *
     * If there is no tournament ID, this is a
     * brand-new tournament and the normal
     * setup screen is shown.
     */
    useEffect(() => {

        if (!tournamentId) {

            setLoadingTournament(false);

            return;

        }


        let cancelled = false;


        const restoreTournament =
            async () => {

                try {

                    setLoadingTournament(true);

                    setTournamentLoadError(null);


                    const loadedTournament =
                        await loadTournament(
                            tournamentId
                        );


                    if (cancelled) {
                        return;
                    }


                    /*
                     * Restore the complete tournament
                     * into React state.
                     */
                    setTournament(
                        loadedTournament
                    );


                    /*
                     * Restore public QR code.
                     */
                    setPublicCode(
                        loadedTournament.publicCode
                    );


                    /*
                     * Existing tournaments have already
                     * been generated, so keep setup collapsed.
                     */
                    setSetupCollapsed(
                        loadedTournament.status !==
                        "setup"
                    );


                } catch (error) {

                    if (cancelled) {
                        return;
                    }


                    console.error(
                        "Failed to load tournament:",
                        error
                    );


                    setTournamentLoadError(
                        error.message ||
                        "Unable to load tournament."
                    );


                } finally {

                    if (!cancelled) {

                        setLoadingTournament(false);

                    }

                }

            };


        restoreTournament();


        return () => {

            cancelled = true;

        };

    }, [
        tournamentId
    ]);
    /*
     * Update tournament fields.
     */
    const updateTournament = (
        field,
        value
    ) => {

        setTournament(prev => ({

            ...prev,

            [field]: value

        }));

    };


    /*
     * Update scoring.
     */
    const updateScoring = (
        field,
        value
    ) => {

        setTournament(prev => {

            const scoring =
                structuredClone(
                    prev.scoring
                );


            switch (field) {

                case "win":

                    scoring.win =
                        Number(value);

                    break;


                case "skinsEnabled":

                    scoring.skins.enabled =
                        value;

                    break;


                case "pointsPerSkin":

                    scoring.skins.pointsPerSkin =
                        Number(value);

                    break;

                case "strengthDraw":

                    scoring.drawMode =
                        value ? "strength" : "standard";

                    break;


                default:
                    break;

            }


            return {

                ...prev,

                scoring

            };

        });

    };


    /*
     * Add a team locally.
     *
     * Teams are persisted to Supabase when
     * Generate Tournament is pressed.
     */
    const addTeam = (teamName) => {

        const name =
            teamName.trim();


        if (!name) {
            return;
        }


        const team =
            createTeam(name);


        setTournament(prev => ({

            ...prev,

            teams: [

                ...prev.teams,

                team

            ]

        }));

    };


    /*
     * Remove a team locally.
     */
    const removeTeam = (teamId) => {

        setTournament(prev => ({

            ...prev,

            teams:
                prev.teams.filter(
                    team =>
                        team.id !== teamId
                )

        }));

    };


    /*
     * Generate the tournament.
     *
     * This:
     *
     * 1. Generates the local draw
     * 2. Creates the tournament in Supabase
     * 3. Creates the teams
     * 4. Creates Round 1 (Strength mode) or all rounds (standard mode)
     * 5. Creates the matches for the rounds that currently exist
     * 6. Stores the Supabase match IDs
     */
    const generateTournament = async () => {

        if (saving) {
            return;
        }


        setSaving(true);


        try {

            /*
             * Generate the existing BowlPoint
             * round-robin draw.
             */
            const generatedTournament =
                tournament.scoring.drawMode === "strength"
                    ? generateStrengthDraw(tournament)
                    : generateRoundRobinDraw(tournament);


            /*
             * Create the tournament in Supabase.
             */
            const databaseTournament =
                await createSupabaseTournament({

                    name:
                        generatedTournament.name,

                    totalRounds:
                        generatedTournament.totalRounds,

                    scoring:
                        generatedTournament.scoring,

                    status:
                        "in_progress",

                    currentRound:
                        1,

                    isPublic:
                        true

                });


            /*
             * Keep the public code available
             * for the QR code.
             */
            setPublicCode(
                databaseTournament.public_code
            );


            /*
             * Map local team IDs to Supabase
             * team IDs.
             */
            const teamIdMap =
                new Map();


            /*
             * Create all teams and link them
             * to the tournament.
             */
            for (
                let index = 0;
                index <
                generatedTournament
                    .teams
                    .length;
                index++
            ) {

                const localTeam =
                    generatedTournament
                        .teams[index];


                /*
                 * The generated tournament may contain
                 * a synthetic BYE team.
                 *
                 * Never create that as a real
                 * Supabase team.
                 */
                if (localTeam.isBye) {
                    continue;
                }


                const databaseTeam =
                    await createAndAddTeam({

                        tournamentId:
                            databaseTournament.id,

                        name:
                            localTeam.name,

                        teamPosition:
                            index + 1

                    });


                teamIdMap.set(

                    localTeam.id,

                    databaseTeam.id

                );


                localTeam.supabaseTeamId =
                    databaseTeam.id;

            }


            /*
             * Create the rounds and matches.
             *
             * Standard draws create all requested rounds. Strength draws
             * create Round 1 only; later rounds are created after the
             * preceding round has been fully scored.
             */
            const databaseRounds = [];

            for (
                let roundIndex = 0;
                roundIndex < generatedTournament.rounds.length;
                roundIndex++
            ) {

                const localRound =
                    generatedTournament.rounds[roundIndex];

                const databaseRound =
                    await createRound({
                        tournamentId: databaseTournament.id,
                        roundNumber: localRound.number,
                        status:
                            generatedTournament.scoring.drawMode === "strength"
                                ? "in_progress"
                                : roundIndex === 0
                                    ? "in_progress"
                                    : "pending"
                    });

                databaseRounds.push(databaseRound);

                localRound.id = databaseRound.id;

                for (
                    let matchIndex = 0;
                    matchIndex < localRound.matches.length;
                    matchIndex++
                ) {

                    const localMatch = localRound.matches[matchIndex];

                    const databaseTeamAId =
                        teamIdMap.get(localMatch.teamA.id);

                    const databaseTeamBId =
                        teamIdMap.get(localMatch.teamB.id);

                    if (!databaseTeamAId || !databaseTeamBId) {
                        continue;
                    }

                    const databaseMatch =
                        await createMatch({
                            roundId: databaseRound.id,
                            matchNumber: matchIndex + 1,
                            teamAId: databaseTeamAId,
                            teamBId: databaseTeamBId
                        });

                    localMatch.supabaseMatchId = databaseMatch.id;
                }

            }

            /*
             * Store the database tournament ID
             * and public information locally.
             */
            const finalTournament = {

                ...generatedTournament,

                /*
                * The Supabase tournament ID is now the
                * canonical tournament ID.
                */
                id:
                    databaseTournament.id,

                supabaseTournamentId:
                    databaseTournament.id,

                publicCode:
                    databaseTournament.public_code,

                currentRound: 1

            };


            setTournament(
                finalTournament
            );

            setSetupCollapsed(true);
            
                        /*
            * Give the tournament its permanent URL.
            *
            * From this point onward, refreshing the browser
            * will reload this tournament from Supabase.
            */
            navigate(
                `/quick-score/${databaseTournament.id}`,
                {
                    replace: true
                }
            );
            /*
            * Return the user to the top after the
            * generated tournament has rendered.
            */
            setTimeout(() => {

                window.scrollTo({

                    top: 0,

                    left: 0,

                    behavior: "smooth"

                });

            }, 50);


        } catch (error) {

            console.error(
                "Failed to generate tournament:",
                error
            );


            alert(
                "Unable to save the tournament to Supabase.\n\n" +
                error.message
            );


        } finally {

            setSaving(false);

        }

    };


    /*
     * Select a team for draw swapping.
     *
     * This now also supports selecting the
     * team currently receiving a BYE.
     */
    const handleSelectTeamForSwap = (
        roundId,
        teamId
    ) => {

        if (!drawEditMode) {
            return;
        }


        setSelectedTeams(prev => {

            const existing =
                prev.find(
                    selection =>
                        selection.teamId ===
                        teamId
                );


            /*
             * Clicking an already selected
             * team deselects it.
             */
            if (existing) {

                return prev.filter(
                    selection =>
                        selection.teamId !==
                        teamId
                );

            }


            /*
             * Selecting a third team replaces
             * the current selection with it.
             */
            if (prev.length >= 2) {

                return [

                    {
                        roundId,
                        teamId
                    }

                ];

            }


            return [

                ...prev,

                {
                    roundId,
                    teamId
                }

            ];

        });

    };


    /*
     * Swap two teams in a round.
     *
     * Supports:
     *
     * Team ↔ Team
     *
     * Team ↔ BYE
     *
     * The local tournament is updated first,
     * then the affected database matches
     * are synchronised.
     */
    const handleSwapTeams = async () => {

        if (selectedTeams.length !== 2) {
            return;
        }


        if (
            selectedTeams[0].roundId !==
            selectedTeams[1].roundId
        ) {

            alert(
                "Please select two teams from the same round."
            );

            return;

        }


        const roundId =
            selectedTeams[0].roundId;


        const teamAId =
            selectedTeams[0].teamId;


        const teamBId =
            selectedTeams[1].teamId;


        try {

            /*
             * Perform the local swap.
             *
             * The updated tournamentEngine
             * supports both normal team swaps
             * and Team ↔ BYE swaps.
             */
            const swappedTournament =
                swapTeamsInRound(
                    tournament,
                    roundId,
                    teamAId,
                    teamBId
                );


            /*
             * Find the updated round.
             */
            const affectedRound =
                swappedTournament.rounds.find(
                    round =>
                        round.id ===
                        roundId
                );


            if (!affectedRound) {

                throw new Error(
                    "Unable to find the selected round."
                );

            }


            /*
             * --------------------------------------------------
             * SUPABASE DATABASE UPDATE
             * --------------------------------------------------
             *
             * We update only unfinished matches.
             *
             * A BYE is never stored in Supabase as a team.
             * When a BYE is swapped, the affected match now
             * contains two real teams, so it can be updated
             * normally.
             */
            if (
                affectedRound &&
                tournament.supabaseTournamentId
            ) {

                for (
                    const match
                    of affectedRound.matches
                ) {

                    /*
                     * Do not touch completed matches.
                     *
                     * This is particularly important because
                     * changing a completed match would alter
                     * historical results.
                     */
                    if (
                        match.completed
                    ) {

                        continue;

                    }


                    /*
                     * No database match ID means there is
                     * nothing to update.
                     */
                    if (
                        !match.supabaseMatchId
                    ) {

                        continue;

                    }


                    /*
                     * Never attempt to save a synthetic
                     * BYE as a database team.
                     */
                    if (
                        match.teamA?.isBye ||
                        match.teamB?.isBye
                    ) {

                        continue;

                    }


                    /*
                     * Find the corresponding local teams.
                     */
                    const databaseTeamA =
                        swappedTournament
                            .teams
                            .find(
                                team =>
                                    team.id ===
                                    match.teamA.id
                            );


                    const databaseTeamB =
                        swappedTournament
                            .teams
                            .find(
                                team =>
                                    team.id ===
                                    match.teamB.id
                            );


                    /*
                     * Both teams must have real
                     * Supabase IDs.
                     */
                    if (
                        !databaseTeamA?.supabaseTeamId ||
                        !databaseTeamB?.supabaseTeamId
                    ) {

                        continue;

                    }


                    /*
                     * Update the database match.
                     */
                    await updateMatchTeams({

                        matchId:
                            match.supabaseMatchId,

                        teamAId:
                            databaseTeamA
                                .supabaseTeamId,

                        teamBId:
                            databaseTeamB
                                .supabaseTeamId

                    });

                }

            }


            /*
             * Only update the UI after the database
             * synchronisation has completed.
             */
            setTournament(
                swappedTournament
            );


            /*
             * IMPORTANT:
             *
             * Automatically leave Change Draw mode
             * after a successful swap.
             *
             * This fixes the issue where clicking
             * a player/team afterwards accidentally
             * selects it for another swap.
             */
            setSelectedTeams([]);

            setDrawEditMode(false);


        } catch (error) {

            console.error(
                "Failed to swap teams:",
                error
            );


            alert(
                "Failed to swap teams.\n\n" +
                error.message
            );

        }

    };


    /*
     * Cancel draw editing.
     */
    const cancelDrawEdit = () => {

        setDrawEditMode(false);

        setSelectedTeams([]);

    };


    /*
     * Reset tournament.
     *
     * The Supabase tournament remains available
     * as a historical/public tournament for now.
     */
    const resetTournament = () => {

        setTournament(
            createTournament()
        );


        setPublicCode(null);

        setDrawEditMode(false);

        setSelectedTeams([]);

        setSetupCollapsed(false);


        window.scrollTo({

            top: 0,

            behavior: "smooth"

        });

    };


    /*
     * Permanently end and remove the current Quick Score tournament.
     *
     * This is deliberately separate from normal tournament completion.
     * A completed tournament remains available until the user explicitly
     * chooses End Tournament.
     */
    const handleEndTournament = async () => {

        if (!tournamentId || endingTournament) {
            return;
        }

        const confirmed = window.confirm(
            "End this tournament?\n\n" +
            "This will permanently delete the Quick Score tournament, " +
            "its fixtures, scores and temporary teams. This action cannot be undone."
        );

        if (!confirmed) {
            return;
        }

        try {

            setEndingTournament(true);

            await endQuickScoreTournament(tournamentId);

            navigate("/quick-score", { replace: true });

        } catch (error) {

            console.error(
                "Failed to end tournament:",
                error
            );

            alert(
                "Unable to end the tournament.\n\n" +
                error.message
            );

        } finally {

            setEndingTournament(false);

        }

    };


    /*
     * Save a match score.
     */
    const updateMatchScore = async (
        roundId,
        matchId,
        scoreA,
        scoreB,
        skinsA,
        skinsB
    ) => {

        const match =
            findMatch(
                tournament,
                roundId,
                matchId
            );


        if (!match) {

            alert(
                "Unable to find the match."
            );

            return false;

        }


        /*
         * Remember whether this is an edit of an already completed
         * match. Editing a completed match must update the existing
         * result without generating another Strength round.
         */
        const wasCompleted = Boolean(match.completed);


        /*
         * If the match has already been
         * published to Supabase, update
         * the database first.
         */
        if (
            tournament.supabaseTournamentId &&
            match.supabaseMatchId
        ) {

            try {

                await updateSupabaseMatchScore({

                    matchId:
                        match.supabaseMatchId,

                    scoreA:
                        Number(scoreA),

                    scoreB:
                        Number(scoreB),

                    skinsA:
                        skinsA === ""
                            ? null
                            : Number(skinsA),

                    skinsB:
                        skinsB === ""
                            ? null
                            : Number(skinsB),

                    completed:
                        true

                });


            } catch (error) {

                console.error(
                    "Failed to save score:",
                    error
                );


                alert(
                    "The score could not be saved to Supabase.\n\n" +
                    error.message
                );


                return false;

            }

        }


        /*
         * Update the local tournament only
         * after Supabase has successfully saved.
         */
        const updatedTournament =
            updateMatchInTournament(
                tournament,
                roundId,
                matchId,
                {
                    scoreA: Number(scoreA),
                    scoreB: Number(scoreB),
                    skinsA:
                        skinsA === ""
                            ? null
                            : Number(skinsA),
                    skinsB:
                        skinsB === ""
                            ? null
                            : Number(skinsB),
                    completed: true,
                    completedAt: new Date().toISOString()
                }
            );

        setTournament(updatedTournament);

        /*
         * Strength mode advances only when every match in the current
         * round has been scored. This is deliberately done after the
         * score has been persisted and reflected in local state.
         */
        if (
            !wasCompleted &&
            updatedTournament.scoring.drawMode === "strength" &&
            !strengthRoundGenerationLock.current
        ) {

            strengthRoundGenerationLock.current = true;

            try {

                const advancedTournament =
                    await generateNextStrengthRoundInDatabase(
                        updatedTournament
                    );

                if (advancedTournament !== updatedTournament) {
                    setTournament(advancedTournament);
                }

            } catch (error) {

                console.error(
                    "Failed to generate the next Strength vs Strength round:",
                    error
                );

                alert(
                    "The score was saved, but the next round could not be generated.\n\n" +
                    error.message
                );

            } finally {

                strengthRoundGenerationLock.current = false;

            }

        }

        return true;

    };


    /*
     * Generate the next Strength vs Strength round after the current
     * round has been completely scored.
     */
    const generateNextStrengthRoundInDatabase = async (
        completedTournament
    ) => {

        if (completedTournament.scoring.drawMode !== "strength") {
            return completedTournament;
        }

        const completedRound =
            completedTournament.rounds[
                completedTournament.rounds.length - 1
            ];

        if (!isRoundComplete(completedRound)) {
            return completedTournament;
        }

        if (completedTournament.rounds.length >= completedTournament.totalRounds) {

            if (completedTournament.supabaseTournamentId) {
                await updateTournamentInDatabase(
                    completedTournament.supabaseTournamentId,
                    {
                        status: "completed",
                        currentRound: completedRound.number
                    }
                );
            }

            return {
                ...completedTournament,
                status: "completed",
                currentRound: completedRound.number
            };

        }

        const currentStandings =
            calculateStandings(completedTournament);

        const nextRound =
            generateNextStrengthRound(
                completedTournament,
                currentStandings
            );

        if (!nextRound) {
            return completedTournament;
        }

        const tournamentId =
            completedTournament.supabaseTournamentId;

        if (!tournamentId) {
            return {
                ...completedTournament,
                rounds: [...completedTournament.rounds, nextRound],
                currentRound: nextRound.number
            };
        }

        await updateRoundStatus({
            roundId: completedRound.id,
            status: "completed"
        });

        const databaseRound =
            await createRound({
                tournamentId,
                roundNumber: nextRound.number,
                status: "in_progress"
            });

        nextRound.id = databaseRound.id;

        for (
            let matchIndex = 0;
            matchIndex < nextRound.matches.length;
            matchIndex++
        ) {

            const localMatch = nextRound.matches[matchIndex];

            const databaseTeamAId =
                getSupabaseTeamId(
                    completedTournament,
                    localMatch.teamA.id
                );

            const databaseTeamBId =
                getSupabaseTeamId(
                    completedTournament,
                    localMatch.teamB.id
                );

            if (!databaseTeamAId || !databaseTeamBId) {
                continue;
            }

            const databaseMatch =
                await createMatch({
                    roundId: databaseRound.id,
                    matchNumber: matchIndex + 1,
                    teamAId: databaseTeamAId,
                    teamBId: databaseTeamBId
                });

            localMatch.supabaseMatchId = databaseMatch.id;
        }

        await updateTournamentInDatabase(
            tournamentId,
            {
                status: "in_progress",
                currentRound: nextRound.number
            }
        );

        return {
            ...completedTournament,
            rounds: [...completedTournament.rounds, nextRound],
            status: "in_progress",
            currentRound: nextRound.number
        };

    };

    /*
     * Calculate standings using the existing
     * BowlPoint standings engine.
     */
    const standings =
        calculateStandings(
            tournament
        );

        /*
     * Show a loading screen while an existing
     * tournament is being restored.
     */
    if (loadingTournament) {

        return (

            <>

                <PageHeader

                    title="Tournament Manager"

                    subtitle="Loading tournament..."

                />


                <div className="card shadow-sm border-0 mt-4">

                    <div className="card-body text-center py-5">

                        <div
                            className="spinner-border text-primary mb-3"
                            role="status"
                        >

                            <span className="visually-hidden">
                                Loading...
                            </span>

                        </div>


                        <h5>
                            Loading Tournament
                        </h5>


                        <p className="text-muted mb-0">

                            Restoring your tournament and scores...

                        </p>

                    </div>

                </div>

            </>

        );

    }


    /*
     * Show an error if the tournament could not
     * be restored.
     */
    if (tournamentLoadError) {

        return (

            <>

                <PageHeader

                    title="Tournament Manager"

                    subtitle="Unable to load tournament"

                />


                <div className="alert alert-danger mt-4">

                    <h5 className="alert-heading">

                        <i className="bi bi-exclamation-triangle-fill me-2"></i>

                        Tournament could not be loaded

                    </h5>


                    <p className="mb-3">

                        {tournamentLoadError}

                    </p>


                    <button
                        type="button"
                        className="btn btn-outline-danger"
                        onClick={() =>
                            window.location.href =
                                "/quick-score"
                        }
                    >

                        <i className="bi bi-arrow-left me-2"></i>

                        Back to Tournaments

                    </button>

                </div>

            </>

        );

    }
        
    return (

        <>

            <PageHeader

                title={
                    tournament.name ||
                    "Tournament Manager"
                }

                subtitle={
                    publicCode
                        ? `Live tournament • Code: ${publicCode}`
                        : "Create, manage and score your tournaments."
                }

            />


            <TournamentSetup

                tournament={
                    tournament
                }

                updateTournament={
                    updateTournament
                }

                updateScoring={
                    updateScoring
                }

                addTeam={
                    addTeam
                }

                removeTeam={
                    removeTeam
                }

                generateTournament={
                    generateTournament
                }

                setupCollapsed={
                    setupCollapsed
                }

                setSetupCollapsed={
                    setSetupCollapsed
                }

            />

            {tournament.supabaseTournamentId && (

                <div className="bowlpoint-tournament-ready">

                    <div className="bowlpoint-tournament-ready-icon">

                        <i className="bi bi-check-circle-fill"></i>

                    </div>

                    <div>

                        <div className="bowlpoint-tournament-ready-title">

                            Tournament Ready

                        </div>

                        <div className="bowlpoint-tournament-ready-message">

                            {getCurrentRoundForDisplay(
                                tournament
                            )}

                        </div>

                    </div>

                </div>

            )}

            <FixturesCard

                tournament={
                    tournament
                }

                updateMatchScore={
                    updateMatchScore
                }

                drawEditMode={
                    drawEditMode
                }

                selectedTeams={
                    selectedTeams
                }

                onSelectTeamForSwap={
                    handleSelectTeamForSwap
                }

                onSwapTeams={
                    handleSwapTeams
                }

                onCancelDrawEdit={
                    cancelDrawEdit
                }

                onStartDrawEdit={() => {

                    setDrawEditMode(true);

                    setSelectedTeams([]);

                }}

            />


            <QRCodeCard
                publicCode={
                    publicCode
                }
            />


            <StandingsCard

                tournament={
                    tournament
                }

                standings={
                    standings
                }

                onNewTournament={
                    resetTournament
                }

            />


            {tournament.supabaseTournamentId && (

                <div className="card shadow-sm border-danger mt-4">

                    <div className="card-body d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3">

                        <div>

                            <h5 className="text-danger mb-1">
                                End Tournament
                            </h5>

                            <p className="text-muted mb-0">
                                Permanently delete this Quick Score tournament and all of its scores and fixtures.
                            </p>

                        </div>

                        <button
                            type="button"
                            className="btn btn-danger"
                            onClick={handleEndTournament}
                            disabled={endingTournament || saving}
                        >

                            {endingTournament ? (

                                <>
                                    <span
                                        className="spinner-border spinner-border-sm me-2"
                                        role="status"
                                        aria-hidden="true"
                                    ></span>
                                    Ending Tournament...
                                </>

                            ) : (

                                <>
                                    <i className="bi bi-trash3 me-2"></i>
                                    End Tournament
                                </>

                            )}

                        </button>

                    </div>

                </div>

            )}


            {saving && (

                <div className="position-fixed bottom-0 end-0 p-3">

                    <div className="alert alert-info shadow">

                        <i className="bi bi-cloud-upload me-2"></i>

                        Saving tournament...

                    </div>

                </div>

            )}

        </>

    );

}


/*
 * Find a match in the local tournament.
 */
function findMatch(
    tournament,
    roundId,
    matchId
) {

    const round =
        tournament.rounds.find(
            round =>
                round.id === roundId
        );


    if (!round) {
        return null;
    }


    return round.matches.find(
        match =>
            match.id === matchId
    );

}


/*
 * The local tournament keeps the original
 * team IDs while Supabase has its own IDs.
 *
 * During generation we attach the Supabase
 * team ID to each local team.
 */
function getSupabaseTeamId(
    tournament,
    localTeamId
) {

    const team =
        tournament.teams.find(
            item =>
                item.id === localTeamId
        );


    return team?.supabaseTeamId ||
        null;

}

function getCurrentRoundForDisplay(tournament) {

    const currentRound =
        tournament.rounds.find(
            round =>
                round.matches.some(
                    match =>
                        !match.completed
                )
        );


    if (currentRound) {

        return `Round ${currentRound.number} is ready for scoring.`;

    }


    /*
     * If all rounds are completed, the tournament
     * is finished.
     */
    return "All rounds have been completed.";

}

export default QuickTournament;