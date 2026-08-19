import { QRCodeCanvas } from "qrcode.react";

function QRCodeCard({ publicCode }) {

    if (!publicCode) {
        return null;
    }

    const liveUrl =
        `${window.location.origin}/live/${publicCode}`;


    const handleDownload = () => {

        const canvas =
            document.getElementById(
                "bowlpoint-live-qr"
            );

        if (!canvas) {
            return;
        }


        const pngUrl =
            canvas.toDataURL(
                "image/png"
            );


        const downloadLink =
            document.createElement("a");

        downloadLink.href = pngUrl;

        downloadLink.download =
            `BowlPoint-Live-${publicCode}.png`;

        downloadLink.click();

    };


    const handleOpenLive = () => {

        window.open(
            liveUrl,
            "_blank",
            "noopener,noreferrer"
        );

    };


    return (

        <div className="card mt-4 shadow-sm">

            <div className="card-header">

                <h5 className="mb-0">

                    <i className="bi bi-qr-code me-2"></i>

                    Live Tournament

                </h5>

            </div>


            <div className="card-body text-center">

                <p className="text-muted mb-3">

                    Players can scan this QR code to view
                    the live standings and results.

                </p>


                <div className="d-flex justify-content-center mb-3">

                    <div className="p-3 bg-white border rounded-3">

                        <QRCodeCanvas
                            id="bowlpoint-live-qr"
                            value={liveUrl}
                            size={220}
                            level="H"
                            includeMargin
                        />

                    </div>

                </div>


                <div className="mb-3">

                    <div className="small text-muted">
                        Public Code
                    </div>

                    <strong className="fs-5">
                        {publicCode}
                    </strong>

                </div>


                <div className="d-flex justify-content-center gap-2 flex-wrap">

                    <button
                        type="button"
                        className="btn btn-primary"
                        onClick={handleOpenLive}
                    >

                        <i className="bi bi-box-arrow-up-right me-2"></i>

                        Open Live Results

                    </button>


                    <button
                        type="button"
                        className="btn btn-outline-secondary"
                        onClick={handleDownload}
                    >

                        <i className="bi bi-download me-2"></i>

                        Download QR

                    </button>

                </div>

            </div>

        </div>

    );

}

export default QRCodeCard;