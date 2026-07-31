function TeamRow({ team, index, onRemove }) {

    return (

        <div className="list-group-item px-0 py-3 d-flex justify-content-between align-items-center">

            <div className="d-flex align-items-center">

                <div
                    className="rounded-circle bg-primary text-white fw-bold d-flex align-items-center justify-content-center me-3"
                    style={{
                        width: "36px",
                        height: "36px",
                        minWidth: "36px"
                    }}
                >
                    {index + 1}
                </div>

                <div>

                    <div className="fw-semibold">

                        {team.name}

                    </div>

                    <small className="text-muted">

                        Team {index + 1}

                    </small>

                </div>

            </div>

            <button
                className="btn btn-sm btn-outline-danger"
                title="Remove Team"
                onClick={() => onRemove(team.id)}
            >

                <i className="bi bi-trash"></i>

            </button>

        </div>

    );

}

export default TeamRow;