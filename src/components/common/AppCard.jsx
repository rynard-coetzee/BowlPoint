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

    const handleHeaderClick = () => {

        if (
            collapsible &&
            onToggle
        ) {

            onToggle();

        }

    };


    const handleButtonClick = (e) => {

        /*
         * Prevent the button click from bubbling
         * into the header.
         *
         * This means the icon button and the
         * header both perform exactly one toggle.
         */
        e.stopPropagation();

        if (onToggle) {
            onToggle();
        }

    };


    return (

        <div
            className={`card shadow-sm border-0 mb-4 ${className}`}
        >

            <div
                className={
                    `card-header bg-white d-flex ` +
                    `justify-content-between align-items-center ` +
                    `${collapsible ? "app-card-collapsible" : ""}`
                }
                onClick={
                    collapsible
                        ? handleHeaderClick
                        : undefined
                }
                role={
                    collapsible
                        ? "button"
                        : undefined
                }
                tabIndex={
                    collapsible
                        ? 0
                        : undefined
                }
                onKeyDown={(e) => {

                    if (
                        collapsible &&
                        (
                            e.key === "Enter" ||
                            e.key === " "
                        )
                    ) {

                        e.preventDefault();

                        handleHeaderClick();

                    }

                }}
            >

                <div className="d-flex align-items-center">

                    {icon && (

                        <i
                            className={`bi ${icon} me-2`}
                        ></i>

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
                            className="btn btn-sm btn-outline-secondary app-card-toggle"
                            onClick={handleButtonClick}
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

                    <div
                        className={`card-body ${bodyClassName}`}
                    >

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