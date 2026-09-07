import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

export default function ProtectedRoute({ roles }) {
    const { session, profile, loading, profileError } = useAuth();
    const location = useLocation();

    if (loading) {
        return <div className="auth-loading">Loading BowlPoint…</div>;
    }

    if (!session) {
        return <Navigate to="/login" replace state={{ from: location.pathname }} />;
    }

    if (!profile) {
        return (
            <div className="auth-loading">
                <h2>BowlPoint access not configured</h2>
                <p>{profileError || "No BowlPoint profile exists for this login."}</p>
                <p>Please ask an administrator to activate your account.</p>
            </div>
        );
    }

    if (profile.active === false) {
        return (
            <div className="auth-loading">
                <h2>Account disabled</h2>
                <p>Please contact a BowlPoint administrator.</p>
            </div>
        );
    }

    if (roles?.length && !roles.includes(profile.role)) {
        return <Navigate to="/" replace />;
    }

    return <Outlet />;
}
