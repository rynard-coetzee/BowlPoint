import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import {
    getActiveTournaments,
    getCompletedTournaments
} from "../../services/supabase/tournamentService";


function TournamentList() {

    const navigate = useNavigate();


    const [
        activeTournaments,
        setActiveTournaments
    ] = useState([]);


    const [
        completedTournaments,
        setCompletedTournaments
    ] = useState([]);


    const [
        loading,
        setLoading
    ] = useState(true);


    const [
        error,
        setError
    ] = useState(null);


    const loadTournaments = async () => {

        try {

            setLoading(true);

            setError(null);


            const [
                active,
                completed
            ] = await Promise.all([

                getActiveTournaments(),

                getCompletedTournaments()

            ]);


            setActiveTournaments(
                active
            );

            setCompletedTournaments(
                completed
            );


        } catch (err) {

            console.error(
                "Failed to load tournaments:",
                err
            );


            setError(
                err.message ||
                "Unable to load tournaments."
            );


        } finally {

            setLoading(false);

        }

    };


    useEffect(() => {

        loadTournaments();

    }, []);


    const getStatusLabel = (
        tournament
    ) => {

        switch (
            tournament.status
        ) {

            case "setup":
                return "Setup";

            case "generated":
                return "Ready";

            case "in_progress":
                return "In Progress";

            case "completed":
                return "Completed";

            default:
                return tournament.status;

        }

    };


    const getStatusClass = (
        tournament
    ) => {

        switch (
            tournament.status
        ) {

            case "in_progress":
                return "bg-success";

            case "generated":
                return "bg-primary";

            case "setup":
                return "bg-secondary";

            case "completed":
                return "bg-dark";

            default:
                return "bg-secondary";

        }

    };


    const handleOpen = (
        tournament
    ) => {

        navigate(
            `/quick-tournament/${tournament.id}`
        );

    };


    const handleNewTournament = () => {

        navigate(
            "/quick-tournament/new"
        );

    };


    if (loading) {

        return (

            <>

                <div className="d-flex justify-content-between align-items-center mb-4">

                    <div>

                        <h2 className="mb-1">
                            Tournament Manager
                        </h2>

                        <p className="text-muted mb-0">
                            Create, manage and score your tournaments.
                        </p>

                    </div>

                </div>


                <div className="card shadow-sm border-0">

                    <div className="card-body text-center py-5">

                        <div
                            className="spinner-border text-primary mb-3"
                            role="status"
                        >

                            <span className="visually-hidden">
                                Loading...
                            </span>

                        </div>


                        <p className="text-muted mb-0">

                            Loading tournaments...

                        </p>

                    </div>

                </div>

            </>

        );

    }


    if (error) {

        return (

            <>

                <div className="d-flex justify-content-between align-items-center mb-4">

                    <div>

                        <h2 className="mb-1">
                            Tournament Manager
                        </h2>

                        <p className="text-muted mb-0">
                            Create, manage and score your tournaments.
                        </p>

                    </div>

                </div>


                <div className="alert alert-danger">

                    <i className="bi bi-exclamation-triangle-fill me-2"></i>

                    {error}

                </div>

            </>

        );

    }


    return (

        <>

            <div className="d-flex justify-content-between align-items-center mb-4">

                <div>

                    <h2 className="mb-1">
                        Tournament Manager
                    </h2>

                    <p className="text-muted mb-0">
                        Create, manage and score your tournaments.
                    </p>

                </div>


                <button
                    type="button"
                    className="btn btn-success"
                    onClick={handleNewTournament}
                >

                    <i className="bi bi-plus-lg me-2"></i>

                    New Tournament

                </button>

            </div>


            {/* Active tournaments */}

            <div className="mb-5">

                <div className="d-flex align-items-center mb-3">

                    <i className="bi bi-broadcast-pin text-success me-2"></i>

                    <h4 className="mb-0">
                        Active Tournaments
                    </h4>

                </div>


                {activeTournaments.length === 0 ? (

                    <div className="card border-0 shadow-sm">

                        <div className="card-body text-center py-5 text-muted">

                            <i className="bi bi-trophy fs-1 d-block mb-3"></i>

                            <h5>
                                No active tournaments
                            </h5>

                            <p className="mb-0">
                                Create a tournament to get started.
                            </p>

                        </div>

                    </div>

                ) : (

                    <div className="row g-4">

                        {activeTournaments.map(
                            tournament => (

                                <div
                                    className="col-12 col-lg-6"
                                    key={tournament.id}
                                >

                                    <div className="card border-0 shadow-sm h-100">

                                        <div className="card-body">

                                            <div className="d-flex justify-content-between align-items-start mb-3">

                                                <div>

                                                    <h5 className="mb-1">

                                                        {tournament.name}

                                                    </h5>

                                                    <small className="text-muted">

                                                        Updated{" "}

                                                        {new Date(
                                                            tournament.updated_at
                                                        ).toLocaleString()}

                                                    </small>

                                                </div>


                                                <span
                                                    className={`badge ${getStatusClass(tournament)}`}
                                                >

                                                    {getStatusLabel(
                                                        tournament
                                                    )}

                                                </span>

                                            </div>


                                            <div className="row text-center mb-3">

                                                <div className="col-6">

                                                    <div className="fs-4 fw-bold">

                                                        {tournament.total_rounds}

                                                    </div>

                                                    <small className="text-muted">

                                                        Rounds

                                                    </small>

                                                </div>


                                                <div className="col-6">

                                                    <div className="fs-4 fw-bold">

                                                        {tournament.current_round || 0}

                                                    </div>

                                                    <small className="text-muted">

                                                        Current Round

                                                    </small>

                                                </div>

                                            </div>


                                            <button
                                                type="button"
                                                className="btn btn-primary w-100"
                                                onClick={() =>
                                                    handleOpen(
                                                        tournament
                                                    )
                                                }
                                            >

                                                <i className="bi bi-arrow-right-circle me-2"></i>

                                                Continue Tournament

                                            </button>

                                        </div>

                                    </div>

                                </div>

                            )
                        )}

                    </div>

                )}

            </div>


            {/* Completed tournaments */}

            {completedTournaments.length > 0 && (

                <div>

                    <div className="d-flex align-items-center mb-3">

                        <i className="bi bi-trophy-fill me-2"></i>

                        <h4 className="mb-0">
                            Completed Tournaments
                        </h4>

                    </div>


                    <div className="row g-4">

                        {completedTournaments.map(
                            tournament => (

                                <div
                                    className="col-12 col-lg-6"
                                    key={tournament.id}
                                >

                                    <div className="card border-0 shadow-sm">

                                        <div className="card-body">

                                            <div className="d-flex justify-content-between align-items-start">

                                                <div>

                                                    <h5 className="mb-1">

                                                        {tournament.name}

                                                    </h5>

                                                    <small className="text-muted">

                                                        {new Date(
                                                            tournament.updated_at
                                                        ).toLocaleDateString()}

                                                    </small>

                                                </div>


                                                <span className="badge bg-dark">

                                                    Completed

                                                </span>

                                            </div>


                                            <button
                                                type="button"
                                                className="btn btn-outline-secondary w-100 mt-3"
                                                onClick={() =>
                                                    handleOpen(
                                                        tournament
                                                    )
                                                }
                                            >

                                                <i className="bi bi-eye me-2"></i>

                                                View Tournament

                                            </button>

                                        </div>

                                    </div>

                                </div>

                            )
                        )}

                    </div>

                </div>

            )}

        </>

    );

}


export default TournamentList;