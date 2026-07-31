function SectionPanel({
    children,
    className = ""
}) {

    return (

        <div
            className={`border rounded-3 bg-white p-4 shadow-sm ${className}`}
        >

            {children}

        </div>

    );

}

export default SectionPanel;