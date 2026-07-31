import { useState } from "react";
import { getWinner } from "../../services/scoringEngine";

function MatchCard() {
    const [match, setMatch] = useState({
        team1: {
            name: "Team 1",
            score: ""
        },
        team2: {
            name: "Team 2",
            score: ""
        }
    });

    const updateTeam = (team, property, value) => {
        setMatch(prevMatch => ({
            ...prevMatch,
            [team]: {
                ...prevMatch[team],
                [property]: value
            }
        }));
    };

    const winner = getWinner(match);

    return (
        <div className="card shadow-sm border-0">

            <div className="card-body p-4">

                {/* Header */}

                <div className="d-flex justify-content-between align-items-center mb-4">
                    <h3 className="mb-0">
                        Match
                    </h3>

                    <span className="badge bg-success">
                        New
                    </span>
                </div>

                {/* Team 1 */}

                <div className="row align-items-end mb-4">

                    <div className="col-md-9">
                        <label className="form-label fw-semibold">
                            Team 1
                        </label>

                        <input
                            type="text"
                            className={`form-control ${
                                match.team1.name.trim() === ""
                                    ? "is-invalid"
                                    : ""
                            }`}
                            placeholder="Enter team name"
                            value={match.team1.name}
                            onChange={(e) =>
                                updateTeam("team1", "name", e.target.value)
                            }
                        />
                    </div>

                    <div className="col-md-3">
                        <label className="form-label fw-semibold">
                            Score
                        </label>

                        <input
                            type="number"
                            min="0"
                            className="form-control text-center fs-3 fw-bold"
                            placeholder="0"
                            value={match.team1.score}
                            onChange={(e) =>
                                updateTeam("team1", "score", e.target.value)
                            }
                        />
                    </div>

                </div>

                {/* VS */}

                <div className="text-center my-4">
                    <hr />

                    <span className="badge bg-secondary px-4 py-2 fs-6">
                        VS
                    </span>
                </div>

                {/* Team 2 */}

                <div className="row align-items-end mb-4">

                    <div className="col-md-9">
                        <label className="form-label fw-semibold">
                            Team 2
                        </label>

                        <input
                            type="text"
                            className={`form-control ${
                                match.team2.name.trim() === ""
                                    ? "is-invalid"
                                    : ""
                            }`}
                            placeholder="Enter team name"
                            value={match.team2.name}
                            onChange={(e) =>
                                updateTeam("team2", "name", e.target.value)
                            }
                        />
                    </div>

                    <div className="col-md-3">
                        <label className="form-label fw-semibold">
                            Score
                        </label>

                        <input
                            type="number"
                            min="0"
                            className="form-control text-center fs-3 fw-bold"
                            placeholder="0"
                            value={match.team2.score}
                            onChange={(e) =>
                                updateTeam("team2", "score", e.target.value)
                            }
                        />
                    </div>

                </div>

                {/* Winner */}

                {winner && (
                    <div className="alert alert-success d-flex justify-content-between align-items-center mt-4 mb-0">
                        <strong>🏆 Winner</strong>

                        <span className="fs-5 fw-bold">
                            {winner}
                        </span>
                    </div>
                )}

            </div>

        </div>
    );
}

export default MatchCard;