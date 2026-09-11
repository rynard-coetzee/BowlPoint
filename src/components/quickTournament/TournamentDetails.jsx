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

                    {tournament.scoring.drawMode === "strength" && (
                        <>
                            <div className="mt-3">
                                <label className="form-label fw-semibold">
                                    Strength vs Strength Rounds
                                </label>

                                <select
                                    className="form-select"
                                    value={
                                        tournament.scoring.strengthRounds ||
                                        Math.max(1, tournament.totalRounds - 1)
                                    }
                                    onChange={(e) =>
                                        updateScoring(
                                            "strengthRounds",
                                            Number(e.target.value)
                                        )
                                    }
                                >
                                    {Array.from(
                                        {
                                            length: Math.max(1, tournament.totalRounds - 1)
                                        },
                                        (_, index) => {
                                            const rounds = index + 1;
                                            const randomRounds = tournament.totalRounds - rounds;

                                            return (
                                                <option key={rounds} value={rounds}>
                                                    {rounds} strength vs strength {rounds === 1 ? "round" : "rounds"} — first {randomRounds} {randomRounds === 1 ? "round" : "rounds"} random
                                                </option>
                                            );
                                        }
                                    )}
                                </select>
                            </div>

                            <small className="text-muted d-block mt-2">
                                The first rounds are blind random draws. The selected number of final rounds are generated from the standings while avoiding repeat opponents whenever possible.
                            </small>
                        </>
                    )}

                    {tournament.scoring.drawMode !== "strength" && (
                        <small className="text-muted d-block mt-2">
                            All rounds use the standard round-robin draw.
                        </small>
                    )}

                </div>

            )}

        </>
    );

}

export default TournamentDetails;