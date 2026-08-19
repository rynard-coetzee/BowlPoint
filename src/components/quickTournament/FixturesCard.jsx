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
                round.matches.some(match => !match.completed)
            );

        return (
            incompleteRound ||
            tournament.rounds[tournament.rounds.length - 1]
        );
    };


    const [selectedRoundId, setSelectedRoundId] =
        useState(() => getCurrentRound()?.id);


    /*
     * When the tournament changes, automatically move
     * to the next incomplete round.
     */
    /*
 * Track whether rounds have actually changed.
 *
 * This allows us to automatically advance after a
 * score is saved, without interfering when the user
 * manually selects an earlier round from the dropdown.
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

    const currentRound = getCurrentRound();

    if (!currentRound) {
        return;
    }


    /*
     * If the selected round no longer exists,
     * select the current round.
     */
    const selectedRound =
        tournament.rounds.find(
            round =>
                round.id === selectedRoundId
        );


    if (!selectedRound) {

        setSelectedRoundId(
            currentRound.id
        );

        return;

    }


    /*
     * Only automatically advance when the round
     * completion state changes.
     *
     * This means:
     *
     * Round 1 completed
     *       ↓
     * automatically select Round 2
     *
     * But if the user later selects Round 1
     * manually, we leave them there.
     */
    const selectedRoundIncomplete =
        selectedRound.matches.some(
            match => !match.completed
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
                round.id === selectedRoundId
        ) || getCurrentRound();


    const multipleRounds =
        tournament.rounds.length > 1;


    return (

        <div className="card mt-4 shadow-sm">

            <div className="card-header">

                <div className="d-flex justify-content-between align-items-center flex-wrap gap-2">

                    <h5 className="mb-0">

                        <i className="bi bi-list-check me-2"></i>

                        Scoring

                    </h5>


                    {!drawEditMode ? (

                        <button
                            type="button"
                            className="btn btn-outline-secondary btn-sm"
                            onClick={onStartDrawEdit}
                        >

                            <i className="bi bi-shuffle me-2"></i>

                            Change Draw

                        </button>

                    ) : (

                        <div className="d-flex gap-2">

                            <button
                                type="button"
                                className="btn btn-outline-secondary btn-sm"
                                onClick={onCancelDrawEdit}
                            >

                                Cancel

                            </button>


                            <button
                                type="button"
                                className="btn btn-primary btn-sm"
                                disabled={!canSwap}
                                onClick={onSwapTeams}
                            >

                                <i className="bi bi-arrow-left-right me-2"></i>

                                Swap Teams

                            </button>

                        </div>

                    )}

                </div>


                {drawEditMode && (

                    <div className="alert alert-info mt-3 mb-0">

                        <i className="bi bi-info-circle me-2"></i>

                        Select two teams in the same round to swap
                        their fixtures.

                        <br />

                        <small>
                            Completed matches cannot be changed.
                        </small>

                    </div>

                )}

            </div>


            <div className="card-body">

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
                            value={selectedRound?.id || ""}
                            onChange={(e) =>
                                setSelectedRoundId(
                                    e.target.value
                                )
                            }
                        >

                            {tournament.rounds.map(
                                (round) => {

                                    const completed =
                                        round.matches.length > 0 &&
                                        round.matches.every(
                                            match =>
                                                match.completed
                                        );

                                    return (

                                        <option
                                            key={round.id}
                                            value={round.id}
                                        >

                                            Round {round.number}

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


                {selectedRound && (

                    <RoundCard
                        round={selectedRound}
                        skinsEnabled={
                            tournament.scoring.skins.enabled
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