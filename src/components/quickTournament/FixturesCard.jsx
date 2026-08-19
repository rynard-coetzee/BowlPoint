import { useEffect, useState } from "react";
import RoundCard from "./RoundCard";

function FixturesCard({
    tournament,
    updateMatchScore,
    drawEditMode,
    selectedTeams,
    onSelectTeamForSwap,
    onSwapTeams,
    onCancelDrawEdit,
    onStartDrawEdit
}) {

    if (tournament.status === "setup") {
        return null;
    }


    const canSwap =
        selectedTeams.length === 2 &&
        selectedTeams[0].roundId === selectedTeams[1].roundId;


    /*
     * Automatically determine the current round.
     *
     * The current round is the first round that still
     * contains an incomplete match.
     *
     * If everything is complete, use the final round.
     */
    const getCurrentRound = () => {

        const incompleteRound =
            tournament.rounds.find(round =>
                round.matches.some(
                    match => !match.completed
                )
            );


        return (
            incompleteRound ||
            tournament.rounds[
                tournament.rounds.length - 1
            ]
        );

    };


    const [
        selectedRoundId,
        setSelectedRoundId
    ] = useState(
        () => getCurrentRound()?.id
    );


    /*
     * Track whether rounds have actually changed.
     *
     * This allows us to automatically advance after
     * a score is saved without interfering when the
     * user manually selects an earlier round.
     */
    const roundCompletionState =
        tournament.rounds
            .map(round => {

                const completed =
                    round.matches.length > 0 &&
                    round.matches.every(
                        match => match.completed
                    );


                return `${round.id}:${completed}`;

            })
            .join("|");


    useEffect(() => {

        const currentRound =
            getCurrentRound();


        if (!currentRound) {
            return;
        }


        const selectedRound =
            tournament.rounds.find(
                round =>
                    round.id ===
                    selectedRoundId
            );


        /*
         * If the selected round no longer exists,
         * move to the current round.
         */
        if (!selectedRound) {

            setSelectedRoundId(
                currentRound.id
            );

            return;

        }


        /*
         * Automatically advance when the currently
         * selected round becomes complete.
         */
        const selectedRoundIncomplete =
            selectedRound.matches.some(
                match =>
                    !match.completed
            );


        if (!selectedRoundIncomplete) {

            if (
                currentRound.id !==
                selectedRound.id
            ) {

                setSelectedRoundId(
                    currentRound.id
                );

            }

        }

    }, [
        roundCompletionState
    ]);


    const selectedRound =
        tournament.rounds.find(
            round =>
                round.id ===
                selectedRoundId
        ) || getCurrentRound();


    const multipleRounds =
        tournament.rounds.length > 1;


    return (

        <div className="card mt-4 shadow-sm">

            {/* =========================================
                SCORING HEADER
            ========================================== */}

            <div className="card-header bg-white">

                <div className="d-flex justify-content-between align-items-center">

                    <h5 className="mb-0">

                        <i className="bi bi-list-check me-2"></i>

                        Scoring

                    </h5>

                </div>

            </div>


            <div className="card-body">

                {/* =====================================
                    ROUND SELECTOR
                ====================================== */}

                {multipleRounds && (

                    <div className="mb-4">

                        <label
                            htmlFor="roundSelector"
                            className="form-label fw-semibold"
                        >

                            Round

                        </label>


                        <select
                            id="roundSelector"
                            className="form-select form-select-lg"
                            value={
                                selectedRound?.id ||
                                ""
                            }
                            onChange={(e) =>
                                setSelectedRoundId(
                                    e.target.value
                                )
                            }
                        >

                            {tournament.rounds.map(
                                round => {

                                    const completed =
                                        round.matches.length > 0 &&
                                        round.matches.every(
                                            match =>
                                                match.completed
                                        );


                                    return (

                                        <option
                                            key={
                                                round.id
                                            }
                                            value={
                                                round.id
                                            }
                                        >

                                            Round{" "}
                                            {
                                                round.number
                                            }

                                            {completed
                                                ? " ✓"
                                                : ""
                                            }

                                        </option>

                                    );

                                }
                            )}

                        </select>

                    </div>

                )}


                {/* =====================================
                    EDIT DRAW CONTROL
                ====================================== */}

                {!drawEditMode ? (

                    <div className="mb-4">

                        <button
                            type="button"
                            className="btn btn-outline-primary w-100"
                            onClick={
                                onStartDrawEdit
                            }
                        >

                            <i className="bi bi-shuffle me-2"></i>

                            Edit Draw

                        </button>

                    </div>

                ) : (

                    <div className="bowlpoint-draw-toolbar">

                        <div className="d-flex justify-content-between align-items-start gap-3">

                            <div>

                                <div className="fw-bold">

                                    <i className="bi bi-shuffle me-2"></i>

                                    Edit Draw

                                </div>


                                <div className="small text-muted mt-1">

                                    {selectedTeams.length === 0 && (

                                        <>
                                            Select two teams to swap.
                                        </>

                                    )}


                                    {selectedTeams.length === 1 && (

                                        <>
                                            Select one more team.
                                        </>

                                    )}


                                    {selectedTeams.length === 2 && (

                                        <span className="text-success fw-semibold">

                                            <i className="bi bi-check-circle me-1"></i>

                                            2 teams selected

                                        </span>

                                    )}

                                </div>

                            </div>


                            <button
                                type="button"
                                className="btn btn-outline-secondary btn-sm"
                                onClick={
                                    onCancelDrawEdit
                                }
                            >

                                Cancel

                            </button>

                        </div>


                        {selectedTeams.length > 0 && (

                            <div className="bowlpoint-selected-teams mt-3">

                                {selectedTeams.map(
                                    (selection, index) => {

                                        const round =
                                            tournament.rounds.find(
                                                item =>
                                                    item.id ===
                                                    selection.roundId
                                            );


                                        const team =
                                            round?.matches
                                                .flatMap(
                                                    match => [
                                                        match.teamA,
                                                        match.teamB
                                                    ]
                                                )
                                                .find(
                                                    item =>
                                                        item?.id ===
                                                        selection.teamId
                                                ) ||
                                            round?.byeTeam?.id ===
                                                selection.teamId
                                                ? round.byeTeam
                                                : null;


                                        return (

                                            <div
                                                key={
                                                    `${selection.roundId}-${selection.teamId}`
                                                }
                                                className="badge bg-primary fs-6"
                                            >

                                                {team?.name ||
                                                    `Team ${index + 1}`}

                                            </div>

                                        );

                                    }
                                )}

                            </div>

                        )}


                        <div className="d-grid mt-3">

                            <button
                                type="button"
                                className="btn btn-primary"
                                disabled={!canSwap}
                                onClick={
                                    onSwapTeams
                                }
                            >

                                <i className="bi bi-arrow-left-right me-2"></i>

                                Swap Selected Teams

                            </button>

                        </div>


                        <div className="small text-muted mt-2">

                            <i className="bi bi-info-circle me-1"></i>

                            Completed matches cannot be changed.

                        </div>

                    </div>

                )}


                {/* =====================================
                    SELECTED ROUND
                ====================================== */}

                {selectedRound && (

                    <RoundCard

                        round={
                            selectedRound
                        }

                        skinsEnabled={
                            tournament
                                .scoring
                                .skins
                                .enabled
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
                            onSelectTeamForSwap
                        }

                    />

                )}

            </div>

        </div>

    );

}

export default FixturesCard;