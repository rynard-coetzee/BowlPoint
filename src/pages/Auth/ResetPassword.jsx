import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";
import "./Auth.css";

export default function ResetPassword() {
    const navigate = useNavigate();
    const [password, setPassword] = useState("");
    const [confirm, setConfirm] = useState("");
    const [error, setError] = useState("");
    const [message, setMessage] = useState("");
    const [busy, setBusy] = useState(false);

    const submit = async (event) => {
        event.preventDefault();
        setError("");
        if (password.length < 8) return setError("Password must be at least 8 characters.");
        if (password !== confirm) return setError("Passwords do not match.");
        setBusy(true);
        const { error: updateError } = await supabase.auth.updateUser({ password });
        setBusy(false);
        if (updateError) return setError(updateError.message);
        setMessage("Password updated successfully.");
        setTimeout(() => navigate("/"), 900);
    };

    return (
        <div className="auth-page">
            <div className="auth-card">
                <img src="/bowlpoint-logo.png" alt="BowlPoint" className="auth-logo" />
                <h1>Choose a new password</h1>
                <form onSubmit={submit}>
                    <label>New password</label>
                    <input type="password" value={password} onChange={e => setPassword(e.target.value)} required />
                    <label>Confirm password</label>
                    <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} required />
                    {error && <div className="auth-error">{error}</div>}
                    {message && <div className="auth-success">{message}</div>}
                    <button className="auth-primary" type="submit" disabled={busy}>{busy ? "Updating…" : "Update password"}</button>
                </form>
            </div>
        </div>
    );
}
