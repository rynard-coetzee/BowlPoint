function SectionHeader({
    icon,
    iconColor = "text-primary",
    title,
    subtitle,
    endContent
}) {
    return (
        <div className="d-flex justify-content-between align-items-center mb-4">
            <div className="d-flex align-items-center">
                {icon && (
                    <i
                        className={`bi ${icon} fs-4 ${iconColor} me-2`}
                    ></i>
                )}

                <div>
                    <h5 className="mb-0">
                        {title}
                    </h5>

                    {subtitle && (
                        <small className="text-muted">
                            {subtitle}
                        </small>
                    )}
                </div>
            </div>

            {endContent && (
                <div>
                    {endContent}
                </div>
            )}
        </div>
    );
}

export default SectionHeader;