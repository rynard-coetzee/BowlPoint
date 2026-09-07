import { useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";
import "./Auth.css";

export default function ForgotPassword() {
    const [email, setEmail] = useState("");
    const [message, setMessage] = useState("");
    const [error, setError] = useState("");
    const [busy, setBusy] = useState(false);

    const submit = async (event) => {
        event.preventDefault();
        setBusy(true);
        setMessage("");
        setError("");

        const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
            redirectTo: `${window.location.origin}/reset-password`
        });

        setBusy(false);
        if (resetError) setError(resetError.message);
        else setMessage("If that email exists in BowlPoint, a password reset link has been sent.");
    };

    return (
        <div className="auth-page">
            <div className="auth-card">
                <img src="/bowlpoint-logo.png" alt="BowlPoint" className="auth-logo" />
                <h1>Reset password</h1>
                <p className="auth-subtitle">Enter your BowlPoint login email.</p>
                <form onSubmit={submit}>
                    <label>Email</label>
                    <input type="email" value={email} onChange={e => setEmail(e.target.value)} required />
                    {message && <div className="auth-success">{message}</div>}
                    {error && <div className="auth-error">{error}</div>}
                    <button className="auth-primary" type="submit" disabled={busy}>{busy ? "Sending…" : "Send reset link"}</button>
                </form>
                <Link className="auth-link" to="/login">Back to sign in</Link>
            </div>
        </div>
    );
}
