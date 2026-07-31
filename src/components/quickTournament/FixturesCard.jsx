import MatchCard from "./MatchCard";

function FixturesCard({ tournament, updateMatchScore }) {

    if (tournament.status === "setup") {
        return null;
    }

    return (

        <div className="card mt-4 shadow-sm">

            <div className="card-header">

                <h5 className="mb-0">
                    Fixtures
                </h5>

            </div>

            <div className="card-body">

                {tournament.rounds.map((round) => (

                    <div
                        key={round.id}
                        className="mb-5"
                    >

                        <h5 className="fw-bold mb-3">
                            Round {round.number}
                        </h5>

                        <div className="row g-3">

                            {round.matches.map((match) => (

                                <div
                                    key={match.id}
                                    className="col-lg-6"
                                >

                                    <MatchCard
                                        roundId={round.id}
                                        match={match}
                                        skinsEnabled={
                                            tournament.scoring.skins.enabled
                                        }
                                        onSaveScore={updateMatchScore}
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

                ))}

            </div>

        </div>

    );

}

export default FixturesCard;