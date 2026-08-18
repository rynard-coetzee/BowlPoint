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

    return (

        <div className="card mt-4 shadow-sm">

            <div className="card-header">

                <div className="d-flex justify-content-between align-items-center">

                    <h5 className="mb-0">
                        Fixtures
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

                <div className="row g-4">

                    {tournament.rounds.map((round) => (

                        <div
                            key={round.id}
                            className="col-12 col-xl-6"
                        >

                            <RoundCard
                                round={round}
                                skinsEnabled={
                                    tournament.scoring.skins.enabled
                                }
                                updateMatchScore={
                                    updateMatchScore
                                }
                                drawEditMode={drawEditMode}
                                selectedTeams={selectedTeams}
                                onSelectTeamForSwap={
                                    onSelectTeamForSwap
                                }
                            />

                        </div>

                    ))}

                </div>

            </div>

        </div>

    );

}

export default FixturesCard;