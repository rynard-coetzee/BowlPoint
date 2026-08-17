import { forwardRef, useEffect, useRef, useState } from "react";

const SpeechInput = forwardRef(function SpeechInput(
    {
        value,
        onChange,
        placeholder = "",
        onKeyDown,
        onPaste,
        className = "form-control"
    },
    forwardedRef
) {

    const [listening, setListening] = useState(false);
    const [supported, setSupported] = useState(false);

    const recognitionRef = useRef(null);

    useEffect(() => {

        const SpeechRecognition =
            window.SpeechRecognition ||
            window.webkitSpeechRecognition;

        if (!SpeechRecognition) {
            setSupported(false);
            return;
        }

        setSupported(true);

        const recognition = new SpeechRecognition();

        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = "en-ZA";

        recognition.onstart = () => {
            setListening(true);
        };

        recognition.onresult = (event) => {

            const transcript =
                event.results[0][0].transcript.trim();

            onChange({
                target: {
                    value: transcript
                }
            });

        };

        recognition.onerror = (event) => {

            console.error(
                "Speech recognition error:",
                event.error
            );

            setListening(false);

        };

        recognition.onend = () => {
            setListening(false);
        };

        recognitionRef.current = recognition;

        return () => {

            recognition.stop();

            recognitionRef.current = null;

        };

    }, [onChange]);

    const toggleListening = () => {

        if (!recognitionRef.current) {
            return;
        }

        if (listening) {

            recognitionRef.current.stop();

            return;

        }

        try {

            recognitionRef.current.start();

        } catch (error) {

            console.error(
                "Unable to start speech recognition:",
                error
            );

        }

    };

    return (

        <div className="input-group">

            <input
                ref={forwardedRef}
                className={className}
                placeholder={
                    listening
                        ? "Listening..."
                        : placeholder
                }
                value={value}
                onChange={onChange}
                onKeyDown={onKeyDown}
                onPaste={onPaste}
                disabled={listening}
            />

            {supported && (

                <button
                    type="button"
                    className={`btn ${
                        listening
                            ? "btn-danger"
                            : "btn-outline-secondary"
                    }`}
                    onClick={toggleListening}
                    title={
                        listening
                            ? "Stop listening"
                            : "Speak team name"
                    }
                    aria-label={
                        listening
                            ? "Stop listening"
                            : "Speak team name"
                    }
                >

                    <i
                        className={`bi ${
                            listening
                                ? "bi-mic-fill"
                                : "bi-mic"
                        }`}
                    ></i>

                </button>

            )}

        </div>

    );

});

export default SpeechInput;