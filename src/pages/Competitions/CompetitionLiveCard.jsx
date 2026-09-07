import { useMemo } from "react";

function CompetitionLiveCard({ competition }) {
    const publicCode = competition?.public_code;

    const liveUrl = useMemo(() => {
        if (!publicCode || typeof window === "undefined") return "";
        return `${window.location.origin}/competition/live/${encodeURIComponent(publicCode)}`;
    }, [publicCode]);

    const qrUrl = useMemo(() => {
        if (!liveUrl) return "";
        return `https://quickchart.io/qr?text=${encodeURIComponent(liveUrl)}&size=280&margin=2`;
    }, [liveUrl]);

    const copyLink = async () => {
        if (!liveUrl) return;
        try {
            await navigator.clipboard.writeText(liveUrl);
            alert("Live competition link copied to the clipboard.");
        } catch {
            window.prompt("Copy the live competition link:", liveUrl);
        }
    };

    const printQr = () => {
        if (!qrUrl) return;

        const printWindow = window.open("", "_blank", "width=700,height=800");
        if (!printWindow) return;

        printWindow.document.write(`
            <!doctype html>
            <html>
                <head>
                    <title>${competition?.name || "Competition"} - Live QR Code</title>
                    <style>
                        body { font-family: Arial, sans-serif; text-align: center; padding: 40px; }
                        img { width: 280px; height: 280px; }
                        h1 { margin-bottom: 8px; }
                        .code { font-size: 24px; font-weight: 700; letter-spacing: 4px; margin-top: 18px; }
                        .url { font-size: 12px; color: #666; margin-top: 10px; word-break: break-all; }
                    </style>
                </head>
                <body>
                    <h1>${competition?.name || "Competition"}</h1>
                    <div>Scan to view live competition results</div>
                    <p><img src="${qrUrl}" alt="Live competition QR code" /></p>
                    <div class="code">${publicCode}</div>
                    <div class="url">${liveUrl}</div>
                </body>
            </html>
        `);
        printWindow.document.close();
        printWindow.focus();
        printWindow.onload = () => printWindow.print();
    };

    if (!publicCode) {
        return (
            <div className="card shadow-sm border-0 h-100">
                <div className="card-body">
                    <h5 className="mb-2">
                        <i className="bi bi-phone me-2"></i>
                        Live Competition
                    </h5>
                    <p className="text-muted mb-0">
                        A public competition code has not been generated yet.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="card shadow-sm border-0 h-100">
            <div className="card-body">
                <div className="d-flex justify-content-between align-items-start gap-3 mb-4">
                    <div>
                        <h5 className="mb-1">
                            <i className="bi bi-phone me-2"></i>
                            Live Competition
                        </h5>
                        <p className="text-muted mb-0">
                            Share the live results page with players and spectators.
                        </p>
                    </div>
                    <span className="badge bg-success">Public</span>
                </div>

                <div className="row g-4 align-items-center">
                    <div className="col-sm-5 text-center">
                        <div className="border rounded bg-white p-2 d-inline-block">
                            <img
                                src={qrUrl}
                                alt="QR code for live competition results"
                                width="160"
                                height="160"
                                style={{ display: "block" }}
                            />
                        </div>
                    </div>

                    <div className="col-sm-7">
                        <div className="small text-muted">Competition code</div>
                        <div className="fs-4 fw-bold font-monospace mb-2">{publicCode}</div>

                        <div className="small text-muted mb-3 text-break">
                            {liveUrl}
                        </div>

                        <div className="d-flex flex-wrap gap-2">
                            <a
                                href={liveUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="btn btn-primary btn-sm"
                            >
                                <i className="bi bi-box-arrow-up-right me-1"></i>
                                Open Live Page
                            </a>
                            <button type="button" className="btn btn-outline-secondary btn-sm" onClick={copyLink}>
                                <i className="bi bi-link-45deg me-1"></i>
                                Copy Link
                            </button>
                            <button type="button" className="btn btn-outline-secondary btn-sm" onClick={printQr}>
                                <i className="bi bi-printer me-1"></i>
                                Print QR
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default CompetitionLiveCard;
