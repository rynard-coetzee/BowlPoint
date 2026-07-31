import { useEffect, useState } from "react";

function MatchCard({
    roundId,
    match,
    skinsEnabled,
    onSaveScore
}) {

    const [scoreA, setScoreA] = useState(match.scoreA ?? "");
    const [scoreB, setScoreB] = useState(match.scoreB ?? "");

    const [skinsA, setSkinsA] = useState(match.skinsA ?? "");
    const [skinsB, setSkinsB] = useState(match.skinsB ?? "");

    useEffect(() => {

        setScoreA(match.scoreA ?? "");
        setScoreB(match.scoreB ?? "");

        setSkinsA(match.skinsA ?? "");
        setSkinsB(match.skinsB ?? "");

    }, [
        match.scoreA,
        match.scoreB,
        match.skinsA,
        match.skinsB
    ]);

    const handleSave = () => {

        if (scoreA === "" || scoreB === "") {

            alert("Please enter both scores.");

            return;

        }

        if (
            skinsEnabled &&
            (
                skinsA === "" ||
                skinsB === ""
            )
        ) {

            alert("Please enter both skin scores.");

            return;

        }

        onSaveScore(

            roundId,

            match.id,

            scoreA,

            scoreB,

            skinsA,

            skinsB

        );

    };

    return (

        <div className="card h-100 shadow-sm">

            <div className="card-body">

                <h5 className="fw-bold mb-3">

                    {match.teamA.name}

                </h5>

                <div className="row">

                    <div className={skinsEnabled ? "col-6" : "col-12"}>

                        <label className="form-label">

                            Score

                        </label>

                        <input
                            type="number"
                            min="0"
                            className="form-control form-control-lg text-center"
                            value={scoreA}
                            disabled={match.completed}
                            onChange={(e) =>
                                setScoreA(e.target.value)
                            }
                        />

                    </div>

                    {skinsEnabled && (

                        <div className="col-6">

                            <label className="form-label">

                                Skins

                            </label>

                            <input
                                type="number"
                                min="0"
                                className="form-control form-control-lg text-center"
                                value={skinsA}
                                disabled={match.completed}
                                onChange={(e) =>
                                    setSkinsA(e.target.value)
                                }
                            />

                        </div>

                    )}

                </div>

                <hr className="my-4" />

                <h5 className="fw-bold mb-3">

                    {match.teamB.name}

                </h5>

                <div className="row">

                    <div className={skinsEnabled ? "col-6" : "col-12"}>

                        <label className="form-label">

                            Score

                        </label>

                        <input
                            type="number"
                            min="0"
                            className="form-control form-control-lg text-center"
                            value={scoreB}
                            disabled={match.completed}
                            onChange={(e) =>
                                setScoreB(e.target.value)
                            }
                        />

                    </div>

                    {skinsEnabled && (

                        <div className="col-6">

                            <label className="form-label">

                                Skins

                            </label>

                            <input
                                type="number"
                                min="0"
                                className="form-control form-control-lg text-center"
                                value={skinsB}
                                disabled={match.completed}
                                onChange={(e) =>
                                    setSkinsB(e.target.value)
                                }
                            />

                        </div>

                    )}

                </div>

            </div>

            <div className="card-footer bg-white">

                {match.completed ? (

                    <button
                        className="btn btn-success w-100"
                        disabled
                    >

                        ✓ Score Saved

                    </button>

                ) : (

                    <button
                        className="btn btn-primary w-100"
                        onClick={handleSave}
                    >

                        Save Score

                    </button>

                )}

            </div>

        </div>

    );

}

export default MatchCard;