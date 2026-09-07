import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import "./Auth.css";

export default function Login() {
    const { signIn } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");

    const handleSubmit = async (event) => {
        event.preventDefault();
        setBusy(true);
        setError("");

        const { error: signInError } = await signIn(email.trim(), password);
        setBusy(false);

        if (signInError) {
            setError(signInError.message || "Unable to sign in.");
            return;
        }

        navigate(location.state?.from || "/", { replace: true });
    };

    return (
        <div className="auth-page">
            <div className="auth-card">
                <img src="/bowlpoint-logo.png" alt="BowlPoint" className="auth-logo" />
                <h1>Sign in</h1>
                <p className="auth-subtitle">Sign in to manage BowlPoint competitions.</p>

                <form onSubmit={handleSubmit}>
                    <label>Email</label>
                    <input type="email" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" />

                    <label>Password</label>
                    <input type="password" value={password} onChange={e => setPassword(e.target.value)} required autoComplete="current-password" />

                    {error && <div className="auth-error">{error}</div>}

                    <button className="auth-primary" type="submit" disabled={busy}>
                        {busy ? "Signing in…" : "Sign in"}
                    </button>
                </form>

                <Link className="auth-link" to="/forgot-password">Forgot your password?</Link>
            </div>
        </div>
    );
}
