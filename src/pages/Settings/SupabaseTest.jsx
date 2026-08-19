import { useState } from "react";
import {
    createTournament,
    getTournamentByPublicCode
} from "../../services/supabase/tournamentService";
import {
    createTestTournament
} from "../../services/supabase/testTournamentService";

function SupabaseTest() {

    const [status, setStatus] = useState(
        "Ready to test Supabase."
    );

    const [tournament, setTournament] =
        useState(null);

    const [lookupCode, setLookupCode] =
        useState("");

    const [error, setError] =
        useState(null);

    const handleCreateTest = async () => {

        setStatus("Creating test tournament...");
        setError(null);
        setTournament(null);

        try {

            const result =
                await createTournament({
                    name: "Supabase Test Tournament",
                    totalRounds: 3,
                    scoring: {
                        win: 2,
                        skins: {
                            enabled: false,
                            pointsPerSkin: 1
                        }
                    },
                    isPublic: true
                });

            setTournament(result);

            setLookupCode(
                result.public_code
            );

            setStatus(
                "Tournament created successfully."
            );

        } catch (err) {

            console.error(err);

            setStatus(
                "Tournament creation failed."
            );

            setError(
                err.message
            );

        }

    };


    const handleLookup = async () => {

        const code =
            lookupCode.trim();

        if (!code) {

            setError(
                "Please enter a public tournament code."
            );

            return;

        }

        setStatus(
            "Looking up tournament..."
        );

        setError(null);
        setTournament(null);

        try {

            const result =
                await getTournamentByPublicCode(
                    code
                );

            setTournament(result);

            setStatus(
                "Tournament found successfully."
            );

        } catch (err) {

            console.error(err);

            setStatus(
                "Tournament lookup failed."
            );

            setError(
                err.message
            );

        }

    };
    const handleCreateLiveTest = async () => {

        setStatus(
            "Creating live tournament test..."
        );

        setError(null);
        setTournament(null);

        try {

            const result =
                await createTestTournament();

            setTournament(
                result.tournament
            );

            setLookupCode(
                result.tournament.public_code
            );

            setStatus(
                "Live tournament test created successfully."
            );

        } catch (err) {

            console.error(err);

            setStatus(
                "Live tournament creation failed."
            );

            setError(
                err.message
            );

        }

    };


    return (

        <div className="container-fluid">

            <div className="card shadow-sm border-0">

                <div className="card-body">

                    <h3 className="mb-4">
                        Supabase Database Test
                    </h3>


                    {/* Create */}

                    <div className="mb-4">

                        <button
                            type="button"
                            className="btn btn-primary"
                            onClick={handleCreateTest}
                        >

                            <i className="bi bi-database-add me-2"></i>

                            Create Test Tournament

                        </button>

                    </div>
                    <div className="mt-2">

                        <button
                            type="button"
                            className="btn btn-success"
                            onClick={handleCreateLiveTest}
                        >

                            <i className="bi bi-broadcast me-2"></i>

                            Create Live Tournament Test

                        </button>

                    </div>

                    {/* Lookup */}

                    <div className="border rounded p-3 bg-light">

                        <h5 className="mb-3">
                            Public Tournament Lookup
                        </h5>

                        <div className="input-group">

                            <input
                                type="text"
                                className="form-control"
                                placeholder="Enter public code"
                                value={lookupCode}
                                onChange={(e) =>
                                    setLookupCode(
                                        e.target.value
                                    )
                                }
                            />

                            <button
                                type="button"
                                className="btn btn-success"
                                onClick={handleLookup}
                            >

                                <i className="bi bi-search me-2"></i>

                                Find Tournament

                            </button>

                        </div>

                    </div>


                    {/* Status */}

                    <div className="mt-4">

                        {error ? (

                            <div className="alert alert-danger">

                                <strong>
                                    Error
                                </strong>

                                <hr />

                                {error}

                            </div>

                        ) : (

                            <div className="alert alert-success">

                                <i className="bi bi-check-circle-fill me-2"></i>

                                {status}

                            </div>

                        )}

                    </div>


                    {/* Result */}

                    {tournament && (

                        <div className="card bg-light border-0 mt-4">

                            <div className="card-body">

                                <h5>
                                    Tournament Found
                                </h5>

                                <hr />

                                <p>
                                    <strong>
                                        Name:
                                    </strong>{" "}

                                    {tournament.name}
                                </p>

                                <p>
                                    <strong>
                                        Public Code:
                                    </strong>{" "}

                                    <code className="fs-5">
                                        {tournament.public_code}
                                    </code>
                                </p>

                                <p>
                                    <strong>
                                        Status:
                                    </strong>{" "}

                                    {tournament.status}
                                </p>

                                <p>
                                    <strong>
                                        Rounds:
                                    </strong>{" "}

                                    {tournament.total_rounds}
                                </p>

                                <p className="mb-0">

                                    <strong>
                                        Public:
                                    </strong>{" "}

                                    {tournament.is_public
                                        ? "Yes"
                                        : "No"}

                                </p>

                            </div>

                        </div>

                    )}

                </div>

            </div>

        </div>

    );

}

export default SupabaseTest;