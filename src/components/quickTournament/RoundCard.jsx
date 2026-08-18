import MatchCard from "./MatchCard";

function RoundCard({
    round,
    skinsEnabled,
    updateMatchScore,
    drawEditMode,
    selectedTeams,
    onSelectTeamForSwap
}) {

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
                                roundId={round.id}
                                match={match}
                                skinsEnabled={skinsEnabled}
                                onSaveScore={updateMatchScore}
                                drawEditMode={drawEditMode}
                                selectedTeams={selectedTeams}
                                onSelectTeamForSwap={
                                    onSelectTeamForSwap
                                }
                            />

                        </div>

                    ))}

                </div>

                {round.byeTeam && (

                    <div className="alert alert-warning mt-3 mb-0">

                        <strong>BYE:</strong> {round.byeTeam.name}

                    </div>

                )}

            </div>

        </div>

    );

}

export default RoundCard;