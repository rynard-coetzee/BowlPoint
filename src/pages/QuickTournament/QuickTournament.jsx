import { useState } from "react";

import PageHeader from "../../components/common/PageHeader";
import TournamentSetup from "../../components/quickTournament/TournamentSetup";
import FixturesCard from "../../components/quickTournament/FixturesCard";
import StandingsCard from "../../components/quickTournament/StandingsCard";
import QRCodeCard from "../../components/quickTournament/QRCodeCard";   
import { createTournament } from "../../models/tournament";
import { createTeam } from "../../models/team";

import { generateRoundRobinDraw } from "../../lib/drawEngine";

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
    createTournament as createSupabaseTournament
} from "../../services/supabase/tournamentService";

import {
    createAndAddTeam
} from "../../services/supabase/teamService";

import {
    createRound,
    createMatch,
    updateMatchTeams,
    updateMatchScore as updateSupabaseMatchScore
} from "../../services/supabase/matchService";


function QuickTournament() {

    const [tournament, setTournament] =
        useState(createTournament());


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
     * Public tournament information.
     */
    const [publicCode, setPublicCode] =
        useState(null);


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
     * This now:
     *
     * 1. Generates the local draw
     * 2. Creates the tournament in Supabase
     * 3. Creates the teams
     * 4. Creates all rounds
     * 5. Creates all matches
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
                generateRoundRobinDraw(
                    tournament
                );


            /*
             * Create the tournament in Supabase.
             */
            const databaseTournament =
                await createSupabaseTournament({

                    name:
                        generatedTournament.name,

                    totalRounds:
                        generatedTournament
                            .rounds
                            .length,

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
             * for the QR code we'll add later.
             */
            setPublicCode(
                databaseTournament.public_code
            );


            /*
             * Map local team IDs to Supabase
             * team IDs.
             *
             * Example:
             *
             * local-id-123
             *       ↓
             * supabase-id-456
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
             * Create rounds and matches.
             */
            const databaseRounds = [];


            for (
                let roundIndex = 0;
                roundIndex <
                generatedTournament
                    .rounds
                    .length;
                roundIndex++
            ) {

                const localRound =
                    generatedTournament
                        .rounds[
                            roundIndex
                        ];


                /*
                 * First round is active.
                 * Remaining rounds are pending.
                 */
                const roundStatus =
                    roundIndex === 0
                        ? "in_progress"
                        : "pending";


                const databaseRound =
                    await createRound({

                        tournamentId:
                            databaseTournament.id,

                        roundNumber:
                            localRound.number,

                        status:
                            roundStatus

                    });


                databaseRounds.push(
                    databaseRound
                );


                /*
                 * Create every match in
                 * this round.
                 */
                for (
                    let matchIndex = 0;
                    matchIndex <
                    localRound
                        .matches
                        .length;
                    matchIndex++
                ) {

                    const localMatch =
                        localRound
                            .matches[
                                matchIndex
                            ];


                    const databaseTeamAId =
                        teamIdMap.get(
                            localMatch
                                .teamA
                                .id
                        );


                    const databaseTeamBId =
                        teamIdMap.get(
                            localMatch
                                .teamB
                                .id
                        );


                    const databaseMatch =
                        await createMatch({

                            roundId:
                                databaseRound.id,

                            matchNumber:
                                matchIndex + 1,

                            teamAId:
                                databaseTeamAId,

                            teamBId:
                                databaseTeamBId

                        });


                    /*
                     * Attach the Supabase match ID
                     * to the local match.
                     *
                     * This lets Save Score know
                     * exactly which database record
                     * to update.
                     */
                    localMatch.supabaseMatchId =
                        databaseMatch.id;

                }

            }


            /*
             * Store the database tournament ID
             * and public information locally.
             */
            const finalTournament = {

                ...generatedTournament,

                supabaseTournamentId:
                    databaseTournament.id,

                publicCode:
                    databaseTournament
                        .public_code

            };


            setTournament(
                finalTournament
            );


            /*
             * Collapse setup after
             * successful generation.
             */
            setSetupCollapsed(true);


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


        const swappedTournament =
            swapTeamsInRound(
                tournament,
                roundId,
                teamAId,
                teamBId
            );


        const affectedRound =
            swappedTournament.rounds.find(
                round =>
                    round.id === roundId
            );


        if (
            affectedRound &&
            tournament.supabaseTournamentId
        ) {

            try {

                for (
                    const match of affectedRound.matches
                ) {

                    if (!match.supabaseMatchId) {
                        continue;
                    }


                    const databaseTeamA =
                        swappedTournament.teams.find(
                            team =>
                                team.id ===
                                match.teamA.id
                        );


                    const databaseTeamB =
                        swappedTournament.teams.find(
                            team =>
                                team.id ===
                                match.teamB.id
                        );


                    await updateMatchTeams({

                        matchId:
                            match.supabaseMatchId,

                        teamAId:
                            databaseTeamA?.supabaseTeamId,

                        teamBId:
                            databaseTeamB?.supabaseTeamId

                    });

                }

            } catch (error) {

                console.error(
                    "Failed to update draw:",
                    error
                );


                alert(
                    "The draw was changed locally, " +
                    "but could not be fully updated in Supabase.\n\n" +
                    error.message
                );

            }

        }


        setTournament(
            swappedTournament
        );

        setSelectedTeams([]);

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

            return;

        }


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


                return;

            }

        }


        /*
         * Update the local tournament only
         * after Supabase has successfully saved.
         */
        setTournament(prev =>
            updateMatchInTournament(

                prev,

                roundId,

                matchId,

                {

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
                        true,

                    completedAt:
                        new Date()
                            .toISOString()

                }

            )
        );

    };


    /*
     * Calculate standings using the existing
     * BowlPoint standings engine.
     */
    const standings =
        calculateStandings(
            tournament
        );


    return (

        <>

            <PageHeader

                title="Quick Tournament"

                subtitle={
                    publicCode
                        ? `Live tournament • Code: ${publicCode}`
                        : "Run a tournament without creating a full competition."
                }

            />


            <TournamentSetup

                tournament={tournament}

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
                publicCode={publicCode}
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


export default QuickTournament;