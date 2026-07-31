function StatCard({ title, value, icon }) {
    return (
        <div className="card shadow-sm h-100">
            <div className="card-body">

                <div className="d-flex justify-content-between align-items-center">

                    <div>
                        <h6 className="text-muted mb-1">
                            {title}
                        </h6>

                        <h2 className="mb-0">
                            {value}
                        </h2>
                    </div>

                    <i className={`bi bi-${icon} fs-1 text-success`}></i>

                </div>

            </div>
        </div>
    );
}

export default StatCard;