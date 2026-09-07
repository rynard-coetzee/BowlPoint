import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../../context/AuthContext";

const roleLabel = { admin: "Admin", comp_secretary: "Comp Secretary", user: "User" };

export default function Users() {
    const { isAdmin, isCompSecretary } = useAuth();
    const [users, setUsers] = useState([]);
    const [competitions, setCompetitions] = useState([]);
    const [access, setAccess] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [selectedUser, setSelectedUser] = useState(null);
    const [form, setForm] = useState({ full_name: "", role: "user", active: true });
    const [invite, setInvite] = useState({
        email: "",
        full_name: "",
        role: "user",
        password: "",
        confirm_password: ""
    });
    const [message, setMessage] = useState("");
    const [error, setError] = useState("");

    const load = async () => {
        setLoading(true);
        const [{ data: profiles, error: profileError }, { data: comps, error: compError }] = await Promise.all([
            supabase.from("profiles").select("id, full_name, role, active, created_at").order("created_at", { ascending: false }),
            supabase.from("competitions").select("id, name, start_date, status").order("created_at", { ascending: false })
        ]);
        if (profileError) setError(profileError.message);
        if (compError) setError(compError.message);
        setUsers(profiles || []);
        setCompetitions(comps || []);
        setLoading(false);
    };

    const loadAccess = async (profileId) => {
        const { data, error: accessError } = await supabase
            .from("competition_user_access")
            .select("id, competition_id, can_view, can_score")
            .eq("user_id", profileId);
        if (accessError) setError(accessError.message);
        setAccess(data || []);
    };

    useEffect(() => { load(); }, []);

    const select = async (profile) => {
        setSelectedUser(profile);
        setForm({ full_name: profile.full_name || "", role: profile.role, active: profile.active !== false });
        await loadAccess(profile.id);
        setMessage("");
        setError("");
    };

    const save = async () => {
        if (!selectedUser) return;
        if (!isAdmin && form.role === "admin") {
            setError("Comp Secretaries cannot assign the Admin role.");
            return;
        }
        if (!isAdmin && selectedUser.role === "admin") {
            setError("Comp Secretaries cannot modify an Admin account.");
            return;
        }
        setSaving(true); setError("");
        const { error: saveError } = await supabase
            .from("profiles")
            .update({
                full_name: form.full_name.trim() || null,
                role: form.role,
                active: form.active,
                updated_at: new Date().toISOString()
            })
            .eq("id", selectedUser.id);
        setSaving(false);
        if (saveError) return setError(saveError.message);
        setMessage("User updated.");
        await load();
    };

    const toggleCompetition = async (competitionId, checked) => {
        if (!selectedUser || selectedUser.role !== "user") return;
        const existing = access.find(a => a.competition_id === competitionId);
        let result;
        if (checked) {
            result = existing
                ? await supabase.from("competition_user_access").update({ can_view: true, can_score: true }).eq("id", existing.id)
                : await supabase.from("competition_user_access").insert({ competition_id: competitionId, user_id: selectedUser.id, can_view: true, can_score: true });
        } else if (existing) {
            result = await supabase.from("competition_user_access").delete().eq("id", existing.id);
        }
        if (result?.error) setError(result.error.message);
        else await loadAccess(selectedUser.id);
    };

    const handleInviteChange = (field, value) => {
        setInvite(prev => ({ ...prev, [field]: value }));
        setError("");
        setMessage("");
    };

    const createUser = async (event) => {
        event.preventDefault();
        if (!isCompSecretary) return;

        const email = invite.email.trim().toLowerCase();
        const fullName = invite.full_name.trim();
        const password = invite.password;
        const confirmPassword = invite.confirm_password;

        if (!fullName) return setError("Please enter the user's full name.");
        if (!email) return setError("Please enter the user's email address.");
        if (password.length < 8) return setError("Password must be at least 8 characters long.");
        if (password !== confirmPassword) return setError("Passwords do not match.");
        if (!isAdmin && invite.role === "admin") return setError("Comp Secretaries cannot create Admin users.");

        setSaving(true);
        setError("");
        setMessage("");

        try {
            const { data: { session } } = await supabase.auth.getSession();

            if (!session?.access_token) {
                throw new Error("Your login session has expired. Please log in again.");
            }

            const { data, error: fnError } = await supabase.functions.invoke("create-user", {
                body: {
                    email,
                    full_name: fullName,
                    role: invite.role,
                    password
                },
                headers: {
                    Authorization: `Bearer ${session.access_token}`
                }
            });

            if (fnError) {
                let detail = fnError.message;
                try {
                    const responseBody = await fnError.context?.json?.();
                    if (responseBody?.error) detail = responseBody.error;
                } catch {
                    // Keep the original function error message.
                }
                throw new Error(detail || "Unable to create user.");
            }

            if (data?.error) throw new Error(data.error);

            setInvite({ email: "", full_name: "", role: "user", password: "", confirm_password: "" });
            setMessage("User created successfully. They can log in immediately with the password you set.");
            await load();
        } catch (createError) {
            console.error("Unable to create BowlPoint user:", createError);
            setError(createError.message || "Unable to create user.");
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className="page-container"><p>Loading users…</p></div>;

    return (
        <div className="page-container">
            <div className="page-header"><h1>Users</h1><p>Manage BowlPoint logins and competition access.</p></div>
            <div style={{ display:"grid", gridTemplateColumns:"minmax(320px, 1fr) minmax(360px, 1.4fr)", gap:20 }}>
                <section className="app-card">
                    <h2>Users</h2>
                    {users.map(profile => (
                        <button key={profile.id} onClick={() => select(profile)} style={{ width:"100%", textAlign:"left", padding:14, marginBottom:8, border:"1px solid #dde5e0", borderRadius:10, background:selectedUser?.id===profile.id?"#eef5f0":"#fff", cursor:"pointer" }}>
                            <strong>{profile.full_name || "Unnamed user"}</strong><br />
                            <small>{roleLabel[profile.role] || profile.role} · {profile.active === false ? "Disabled" : "Active"}</small>
                        </button>
                    ))}
                </section>

                <section className="app-card">
                    {selectedUser ? <>
                        <h2>{selectedUser.full_name || "User"}</h2>
                        <label>Display name</label>
                        <input value={form.full_name} onChange={e=>setForm({...form,full_name:e.target.value})} />
                        <label>Role</label>
                        <select value={form.role} disabled={!isAdmin && selectedUser.role === "admin"} onChange={e=>setForm({...form,role:e.target.value})}>
                            <option value="user">User</option><option value="comp_secretary">Comp Secretary</option>{isAdmin && <option value="admin">Admin</option>}
                        </select>
                        <label style={{display:"flex",gap:8,alignItems:"center",marginTop:12}}><input type="checkbox" checked={form.active} onChange={e=>setForm({...form,active:e.target.checked})} /> Account active</label>
                        <button onClick={save} disabled={saving} className="primary-button" style={{marginTop:14}}>{saving?"Saving…":"Save user"}</button>
                        {selectedUser.role === "user" && <>
                            <hr />
                            <h3>Competition access</h3>
                            {competitions.map(comp => {
                                const assigned = access.some(a=>a.competition_id===comp.id && a.can_view);
                                return <label key={comp.id} style={{display:"flex",gap:10,alignItems:"center",padding:"7px 0"}}><input type="checkbox" checked={assigned} onChange={e=>toggleCompetition(comp.id,e.target.checked)} />{comp.name}</label>;
                            })}
                        </>}
                    </> : <p>Select a user to manage their account.</p>}
                    {message && <p style={{color:"#23643b"}}>{message}</p>}
                    {error && <p style={{color:"#a33"}}>{error}</p>}
                </section>
            </div>

            <section className="app-card" style={{marginTop:20}}>
                <h2>Add user</h2>
                <form onSubmit={createUser} style={{display:"grid",gridTemplateColumns:"1fr 1fr 180px",gap:10,alignItems:"end"}}>
                    <div><label>Full name</label><input value={invite.full_name} onChange={e=>handleInviteChange("full_name", e.target.value)} required /></div>
                    <div><label>Email</label><input type="email" value={invite.email} onChange={e=>handleInviteChange("email", e.target.value)} required /></div>
                    <div><label>Role</label><select value={invite.role} onChange={e=>handleInviteChange("role", e.target.value)}><option value="user">User</option><option value="comp_secretary">Comp Secretary</option>{isAdmin&&<option value="admin">Admin</option>}</select></div>
                    <div><label>Password</label><input type="password" value={invite.password} onChange={e=>handleInviteChange("password", e.target.value)} minLength={8} required autoComplete="new-password" /></div>
                    <div><label>Confirm password</label><input type="password" value={invite.confirm_password} onChange={e=>handleInviteChange("confirm_password", e.target.value)} minLength={8} required autoComplete="new-password" /></div>
                    <button className="primary-button" disabled={saving}>{saving?"Creating…":"Create user"}</button>
                </form>
                <small style={{display:"block",marginTop:10}}>No email invitation is sent. The account is created immediately and the password is set here.</small>
            </section>
        </div>
    );
}
