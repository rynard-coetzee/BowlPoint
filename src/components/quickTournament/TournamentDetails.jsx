import SectionHeader from "../common/SectionHeader";

function TournamentDetails({
    tournament,
    updateTournament,
    updateScoring
}) {

    return (
        <>

            <SectionHeader
                icon="bi-trophy"
                iconColor="text-warning"
                title="Tournament Details"
            />

            <div className="mb-4">

                <label className="form-label fw-semibold">
                    Tournament Name
                </label>

                <input
                    type="text"
                    className="form-control form-control-lg"
                    placeholder="Saturday Social"
                    value={tournament.name}
                    onChange={(e) =>
                        updateTournament(
                            "name",
                            e.target.value
                        )
                    }
                />

            </div>

            <div>

                <label className="form-label fw-semibold mb-3">
                    Rounds to Play
                </label>

                <div
                    className="btn-group w-100"
                    role="group"
                >

                    {[1,2,3,4,5,6].map(round => (

                        <div
                            key={round}
                            className="flex-fill"
                        >

                            <input
                                type="radio"
                                className="btn-check"
                                id={`round-${round}`}
                                name="rounds"
                                checked={
                                    tournament.totalRounds === round
                                }
                                onChange={() =>
                                    updateTournament(
                                        "totalRounds",
                                        round
                                    )
                                }
                            />

                            <label
                                className="btn btn-outline-primary w-100"
                                htmlFor={`round-${round}`}
                            >

                                {round}

                            </label>

                        </div>

                    ))}

                </div>

            </div>

            {tournament.totalRounds >= 2 && (

                <div className="mt-4 p-3 border rounded bg-light">

                    <div className="form-check form-switch">

                        <input
                            className="form-check-input"
                            type="checkbox"
                            id="strengthVsStrength"
                            checked={
                                tournament.scoring.drawMode === "strength"
                            }
                            onChange={(e) =>
                                updateScoring(
                                    "strengthDraw",
                                    e.target.checked
                                )
                            }
                        />

                        <label
                            className="form-check-label fw-semibold"
                            htmlFor="strengthVsStrength"
                        >
                            Strength vs Strength Draw
                        </label>

                    </div>

                    <small className="text-muted d-block mt-2">
                        Round 1 is random. After each round is completed,
                        the next round is generated from the standings while
                        avoiding repeat opponents whenever possible.
                    </small>

                </div>

            )}

        </>
    );

}

export default TournamentDetails;