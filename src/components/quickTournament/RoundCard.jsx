import MatchCard from "./MatchCard";

function RoundCard({
    round,
    skinsEnabled,
    updateMatchScore,
    drawEditMode,
    selectedTeams,
    onSelectTeamForSwap
}) {

    const byeSelected =
        selectedTeams?.some(
            selection =>
                selection.teamId ===
                round.byeTeam?.id
        );


    return (

        <div className="card h-100 shadow-sm">

            <div className="card-header bg-white">

                <h5 className="mb-0 fw-bold">

                    🏆 Round {round.number}

                </h5>

            </div>


            <div className="card-body">

                <div className="row g-3">

                    {round.matches.map((match) => (

                        <div
                            key={match.id}
                            className="col-12"
                        >

                            <MatchCard

                                roundId={
                                    round.id
                                }

                                match={
                                    match
                                }

                                skinsEnabled={
                                    skinsEnabled
                                }

                                onSaveScore={
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

                        </div>

                    ))}

                </div>


                {round.byeTeam && (

                    <div className="mt-3">

                        {drawEditMode ? (

                            <button
                                type="button"
                                className={
                                    `btn w-100 text-start ${
                                        byeSelected
                                            ? "btn-primary"
                                            : "btn-outline-warning"
                                    }`
                                }
                                onClick={() =>
                                    onSelectTeamForSwap(
                                        round.id,
                                        round.byeTeam.id
                                    )
                                }
                            >

                                {byeSelected && (

                                    <i className="bi bi-check-circle-fill me-2"></i>

                                )}

                                <i className="bi bi-calendar-x me-2"></i>

                                <strong>
                                    BYE:
                                </strong>

                                {" "}

                                {round.byeTeam.name}

                            </button>

                        ) : (

                            <div className="alert alert-warning mb-0">

                                <strong>
                                    BYE:
                                </strong>

                                {" "}

                                {round.byeTeam.name}

                            </div>

                        )}

                    </div>

                )}

            </div>

        </div>

    );

}

export default RoundCard;