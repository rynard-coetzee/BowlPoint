function AppCard({
    title,
    icon = null,
    children,
    className = "",
    collapsible = false,
    collapsed = false,
    onToggle = null,
    headerContent = null,
    bodyClassName = "",
    bodyWrapper = true
}) {

    return (

        <div className={`card shadow-sm border-0 mb-4 ${className}`}>

            <div className="card-header bg-white d-flex justify-content-between align-items-center">

                <div className="d-flex align-items-center">

                    {icon && (
                        <i className={`bi ${icon} me-2`}></i>
                    )}

                    <h4 className="mb-0">
                        {title}
                    </h4>

                </div>

                <div className="d-flex align-items-center gap-2">

                    {headerContent}

                    {collapsible && (

                        <button
                            type="button"
                            className="btn btn-sm btn-outline-secondary"
                            onClick={onToggle}
                            aria-label={
                                collapsed
                                    ? `Expand ${title}`
                                    : `Collapse ${title}`
                            }
                        >
                            <i
                                className={`bi ${
                                    collapsed
                                        ? "bi-chevron-down"
                                        : "bi-chevron-up"
                                }`}
                            />
                        </button>

                    )}

                </div>

            </div>

            {!collapsed && (

                bodyWrapper ? (

                    <div className={`card-body ${bodyClassName}`}>

                        {children}

                    </div>

                ) : (

                    children

                )

            )}

        </div>

    );

}

export default AppCard;