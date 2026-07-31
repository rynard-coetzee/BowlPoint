function ScoringCard({
    tournament,
    updateScoring
}) {

    const drawPoints = tournament.scoring.win / 2;

    return (

        <>

            <div className="row">

                <div className="col-md-6">

                    <label className="form-label fw-semibold">

                        <i className="bi bi-trophy-fill text-warning me-2"></i>

                        Win Points

                    </label>

                    <input
                        type="number"
                        min="1"
                        className="form-control form-control-lg"
                        value={tournament.scoring.win}
                        onChange={(e) =>
                            updateScoring(
                                "win",
                                e.target.value
                            )
                        }
                    />

                </div>

                <div className="col-md-6">

                    <label className="form-label fw-semibold">

                        <i className="bi bi-hand-thumbs-up-fill text-warning me-2"></i>

                        Draw Points

                    </label>

                    <div className="border rounded p-3 bg-light">

                        <div className="fs-3 fw-bold">

                            {drawPoints}

                        </div>

                        <small className="text-muted">

                            Automatically calculated

                        </small>

                    </div>

                </div>

            </div>

            <hr className="my-4" />

            <div className="form-check form-switch mb-3">

                <input
                    className="form-check-input"
                    type="checkbox"
                    id="enableSkins"
                    checked={tournament.scoring.skins.enabled}
                    onChange={(e) =>
                        updateScoring(
                            "skinsEnabled",
                            e.target.checked
                        )
                    }
                />

                <label
                    className="form-check-label fw-semibold"
                    htmlFor="enableSkins"
                >

                    Enable Skins Competition

                </label>

            </div>

            {tournament.scoring.skins.enabled && (

                <div className="row">

                    <div className="col-md-4">

                        <label className="form-label fw-semibold">

                            Points Per Skin

                        </label>

                        <input
                            type="number"
                            min="1"
                            className="form-control"
                            value={tournament.scoring.skins.pointsPerSkin}
                            onChange={(e) =>
                                updateScoring(
                                    "pointsPerSkin",
                                    e.target.value
                                )
                            }
                        />

                    </div>

                </div>

            )}

        </>

    );

}

export default ScoringCard;