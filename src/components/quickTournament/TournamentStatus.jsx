import {
    hasTournamentName,
    hasEnoughTeams,
    hasEvenTeams,
    hasDuplicateTeams,
    canGenerateTournament
} from "../../lib/validation";

function TournamentStatus({ tournament }) {

    const checks = [
        {
            label: "Tournament Name",
            valid: hasTournamentName(tournament)
        },
        {
            label: "Minimum 2 Teams",
            valid: hasEnoughTeams(tournament)
        },
        {
            label: "Even Number of Teams",
            valid: hasEvenTeams(tournament),
            warning: !hasEvenTeams(tournament)
        },
        {
            label: "No Duplicate Teams",
            valid: !hasDuplicateTeams(tournament)
        }
    ];

    const passedChecks = checks.filter(check => check.valid).length;

    const StatusIcon = ({ check }) => {

        if (check.valid) {
            return (
                <i className="bi bi-check-circle-fill text-success fs-5"></i>
            );
        }

        if (check.warning) {
            return (
                <i className="bi bi-exclamation-triangle-fill text-warning fs-5"></i>
            );
        }

        return (
            <i className="bi bi-x-circle-fill text-danger fs-5"></i>
        );
    };

    return (

        <>

            <div className="d-flex justify-content-between align-items-center mb-4">

                <div>

                    <h6 className="fw-bold mb-1">
                        Tournament Status
                    </h6>

                    <small className="text-muted">
                        Ready to generate your draw
                    </small>

                </div>

                <span className="badge bg-primary fs-6">

                    {passedChecks}/{checks.length}

                </span>

            </div>

            <div className="list-group list-group-flush">

                {checks.map(check => (

                    <div
                        key={check.label}
                        className="list-group-item px-0 d-flex justify-content-between align-items-center"
                    >

                        <span>

                            {check.label}

                        </span>

                        <StatusIcon check={check} />

                    </div>

                ))}

            </div>

            <div className="mt-4">

                {canGenerateTournament(tournament) ? (

                    <div className="alert alert-success mb-0">

                        <i className="bi bi-check-circle-fill me-2"></i>

                        <strong>
                            Tournament Ready
                        </strong>

                    </div>

                ) : (

                    <div className="alert alert-warning mb-0">

                        <i className="bi bi-exclamation-triangle-fill me-2"></i>

                        <strong>
                            Setup Incomplete
                        </strong>

                    </div>

                )}

            </div>

        </>

    );

}

export default TournamentStatus;