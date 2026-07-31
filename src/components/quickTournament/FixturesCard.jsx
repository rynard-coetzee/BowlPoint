import RoundCard from "./RoundCard";

function FixturesCard({
    tournament,
    updateMatchScore
}) {

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

                <div className="row g-4">

                    {tournament.rounds.map((round) => (

                        <div
                            key={round.id}
                            className="col-12 col-xl-6"
                        >

                            <RoundCard
                                round={round}
                                skinsEnabled={tournament.scoring.skins.enabled}
                                updateMatchScore={updateMatchScore}
                            />

                        </div>

                    ))}

                </div>

            </div>

        </div>

    );

}

export default FixturesCard;