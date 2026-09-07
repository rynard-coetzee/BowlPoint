import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [session, setSession] = useState(null);
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [profileError, setProfileError] = useState("");

    const loadProfile = async (userId) => {
        if (!userId) {
            setProfile(null);
            return null;
        }

        const { data, error } = await supabase
            .from("profiles")
            .select("id, full_name, role, active")
            .eq("id", userId)
            .maybeSingle();

        if (error) {
            console.error("Unable to load BowlPoint profile:", error);
            setProfileError(error.message);
            setProfile(null);
            return null;
        }

        setProfileError("");
        setProfile(data || null);
        return data || null;
    };

    useEffect(() => {
        let mounted = true;

        const initialise = async () => {
            const { data } = await supabase.auth.getSession();
            if (!mounted) return;

            setSession(data.session || null);
            if (data.session?.user?.id) {
                await loadProfile(data.session.user.id);
            }
            setLoading(false);
        };

        initialise();

        const { data: listener } = supabase.auth.onAuthStateChange(async (_event, nextSession) => {
            if (!mounted) return;
            setSession(nextSession || null);

            if (nextSession?.user?.id) {
                await loadProfile(nextSession.user.id);
            } else {
                setProfile(null);
                setProfileError("");
            }

            setLoading(false);
        });

        return () => {
            mounted = false;
            listener.subscription.unsubscribe();
        };
    }, []);

    const signIn = async (email, password) => {
        const result = await supabase.auth.signInWithPassword({ email, password });
        return result;
    };

    const signOut = async () => {
        const result = await supabase.auth.signOut();
        setSession(null);
        setProfile(null);
        return result;
    };

    const refreshProfile = async () => {
        if (session?.user?.id) return loadProfile(session.user.id);
        return null;
    };

    const value = useMemo(() => ({
        session,
        user: session?.user || null,
        profile,
        loading,
        profileError,
        role: profile?.role || null,
        isAdmin: profile?.role === "admin",
        isCompSecretary: profile?.role === "comp_secretary" || profile?.role === "admin",
        isNormalUser: profile?.role === "user",
        signIn,
        signOut,
        refreshProfile
    }), [session, profile, loading, profileError]);

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) throw new Error("useAuth must be used inside AuthProvider");
    return context;
}
