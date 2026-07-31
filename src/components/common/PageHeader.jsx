function PageHeader({ title, subtitle }) {
    return (
        <div className="mb-5">
            <h1 className="display-5 fw-bold mb-2">
                {title}
            </h1>

            {subtitle && (
                <p className="text-muted fs-5 mb-0">
                    {subtitle}
                </p>
            )}
        </div>
    );
}

export default PageHeader;