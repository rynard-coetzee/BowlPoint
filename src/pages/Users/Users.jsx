import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../../context/AuthContext";

const roleLabel = {
    admin: "Admin",
    comp_secretary: "Comp Secretary",
    user: "User"
};

const inputStyle = {
    width: "100%",
    padding: "10px 12px",
    border: "1px solid #cfd8d3",
    borderRadius: "8px",
    fontSize: "15px",
    background: "#fff",
    boxSizing: "border-box"
};

const labelStyle = {
    display: "block",
    marginBottom: "6px",
    fontSize: "14px",
    fontWeight: 600,
    color: "#26352f"
};

export default function Users() {
    const { isAdmin, isCompSecretary } = useAuth();

    const [users, setUsers] = useState([]);
    const [competitions, setCompetitions] = useState([]);
    const [access, setAccess] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [selectedUser, setSelectedUser] = useState(null);
    const [passwordReset, setPasswordReset] = useState({
        password: "",
        confirm_password: ""
    });
    const [form, setForm] = useState({
        full_name: "",
        role: "user",
        active: true
    });

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

        const [
            { data: profiles, error: profileError },
            { data: comps, error: compError }
        ] = await Promise.all([
            supabase
                .from("profiles")
                .select("id, full_name, role, active, created_at")
                .order("created_at", { ascending: false }),
            supabase
                .from("competitions")
                .select("id, name, start_date, status")
                .order("created_at", { ascending: false })
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

    useEffect(() => {
        load();
    }, []);

    const select = async (profile) => {
        setSelectedUser(profile);
        setForm({
            full_name: profile.full_name || "",
            role: profile.role,
            active: profile.active !== false
        });

        setMessage("");
        setError("");
        await loadAccess(profile.id);
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

        setSaving(true);
        setError("");
        setMessage("");

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

        if (saveError) {
            setError(saveError.message);
            return;
        }

        setMessage("User updated.");
        await load();
    };
    const resetPassword = async () => {
        if (!selectedUser) return;

        const password = passwordReset.password;
        const confirmPassword =
            passwordReset.confirm_password;

        if (password.length < 8) {
            setError(
                "Password must be at least 8 characters long."
            );
            return;
        }

        if (password !== confirmPassword) {
            setError("Passwords do not match.");
            return;
        }

        setSaving(true);
        setError("");
        setMessage("");

        try {
            const {
                data: { session }
            } = await supabase.auth.getSession();

            if (!session?.access_token) {
                throw new Error(
                    "Your login session has expired. Please log in again."
                );
            }

            const {
                data,
                error: fnError
            } = await supabase.functions.invoke(
                "manage-user",
                {
                    body: {
                        action: "reset_password",
                        user_id: selectedUser.id,
                        password
                    },
                    headers: {
                        Authorization:
                            `Bearer ${session.access_token}`
                    }
                }
            );

            if (fnError) {
                throw new Error(
                    fnError.message ||
                        "Unable to reset password."
                );
            }

            if (data?.error) {
                throw new Error(data.error);
            }

            setPasswordReset({
                password: "",
                confirm_password: ""
            });

            setMessage(
                "Password reset successfully."
            );
        } catch (resetError) {
            console.error(
                "Unable to reset user password:",
                resetError
            );

            setError(
                resetError.message ||
                    "Unable to reset password."
            );
        } finally {
            setSaving(false);
        }
    };


    const deleteUser = async () => {
        if (!selectedUser) return;

        if (selectedUser.id === undefined) {
            return;
        }

        const confirmed = window.confirm(
            `Are you sure you want to permanently delete ${selectedUser.full_name || "this user"}?\n\n` +
            "This will remove their BowlPoint account, login and competition access.\n\n" +
            "This action cannot be undone."
        );

        if (!confirmed) return;

        setSaving(true);
        setError("");
        setMessage("");

        try {
            const {
                data: { session }
            } = await supabase.auth.getSession();

            if (!session?.access_token) {
                throw new Error(
                    "Your login session has expired. Please log in again."
                );
            }

            const {
                data,
                error: fnError
            } = await supabase.functions.invoke(
                "manage-user",
                {
                    body: {
                        action: "delete_user",
                        user_id: selectedUser.id
                    },
                    headers: {
                        Authorization:
                            `Bearer ${session.access_token}`
                    }
                }
            );

            if (fnError) {
                throw new Error(
                    fnError.message ||
                        "Unable to delete user."
                );
            }

            if (data?.error) {
                throw new Error(data.error);
            }

            setSelectedUser(null);
            setAccess([]);

            setMessage(
                "User deleted successfully."
            );

            await load();
        } catch (deleteError) {
            console.error(
                "Unable to delete BowlPoint user:",
                deleteError
            );

            setError(
                deleteError.message ||
                    "Unable to delete user."
            );
        } finally {
            setSaving(false);
        }
    };
    const toggleCompetition = async (competitionId, checked) => {
        if (!selectedUser || selectedUser.role !== "user") return;

        const existing = access.find(
            (item) => item.competition_id === competitionId
        );

        let result;

        if (checked) {
            result = existing
                ? await supabase
                      .from("competition_user_access")
                      .update({
                          can_view: true,
                          can_score: true
                      })
                      .eq("id", existing.id)
                : await supabase
                      .from("competition_user_access")
                      .insert({
                          competition_id: competitionId,
                          user_id: selectedUser.id,
                          can_view: true,
                          can_score: true
                      });
        } else if (existing) {
            result = await supabase
                .from("competition_user_access")
                .delete()
                .eq("id", existing.id);
        }

        if (result?.error) {
            setError(result.error.message);
        } else {
            await loadAccess(selectedUser.id);
        }
    };

    const handleInviteChange = (field, value) => {
        setInvite((prev) => ({
            ...prev,
            [field]: value
        }));

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

        if (!fullName) {
            setError("Please enter the user's full name.");
            return;
        }

        if (!email) {
            setError("Please enter the user's email address.");
            return;
        }

        if (password.length < 8) {
            setError("Password must be at least 8 characters long.");
            return;
        }

        if (password !== confirmPassword) {
            setError("Passwords do not match.");
            return;
        }

        if (!isAdmin && invite.role === "admin") {
            setError("Comp Secretaries cannot create Admin users.");
            return;
        }

        setSaving(true);
        setError("");
        setMessage("");

        try {
            const {
                data: { session }
            } = await supabase.auth.getSession();

            if (!session?.access_token) {
                throw new Error(
                    "Your login session has expired. Please log in again."
                );
            }

            const { data, error: fnError } =
                await supabase.functions.invoke("create-user", {
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
                    const responseBody =
                        await fnError.context?.json?.();

                    if (responseBody?.error) {
                        detail = responseBody.error;
                    }
                } catch {
                    // Keep the original function error message.
                }

                throw new Error(
                    detail || "Unable to create user."
                );
            }

            if (data?.error) {
                throw new Error(data.error);
            }

            setInvite({
                email: "",
                full_name: "",
                role: "user",
                password: "",
                confirm_password: ""
            });

            setMessage(
                "User created successfully. They can log in immediately with the password you set."
            );

            await load();
        } catch (createError) {
            console.error(
                "Unable to create BowlPoint user:",
                createError
            );

            setError(
                createError.message ||
                    "Unable to create user."
            );
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="page-container">
                <p>Loading users…</p>
            </div>
        );
    }

    return (
        <div className="page-container">
            <div
                className="page-header"
                style={{
                    marginBottom: "24px"
                }}
            >
                <h1 style={{ marginBottom: "6px" }}>
                    Users
                </h1>
                <p style={{ margin: 0 }}>
                    Manage BowlPoint logins and competition access.
                </p>
            </div>

            <div
                style={{
                    display: "grid",
                    gridTemplateColumns:
                        "minmax(300px, 0.8fr) minmax(420px, 1.4fr)",
                    gap: "24px",
                    alignItems: "start"
                }}
            >
                <section className="app-card">
                    <div
                        style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            marginBottom: "16px"
                        }}
                    >
                        <div>
                            <h2 style={{ margin: 0 }}>
                                Users
                            </h2>
                            <small
                                style={{
                                    color: "#66756f"
                                }}
                            >
                                {users.length} account
                                {users.length === 1 ? "" : "s"}
                            </small>
                        </div>
                    </div>

                    {users.length === 0 ? (
                        <p
                            style={{
                                color: "#66756f",
                                marginBottom: 0
                            }}
                        >
                            No users have been created yet.
                        </p>
                    ) : (
                        users.map((profile) => (
                            <button
                                key={profile.id}
                                type="button"
                                onClick={() => select(profile)}
                                style={{
                                    width: "100%",
                                    textAlign: "left",
                                    padding: "14px 16px",
                                    marginBottom: "10px",
                                    border:
                                        selectedUser?.id ===
                                        profile.id
                                            ? "2px solid #2d8a57"
                                            : "1px solid #d8e0dc",
                                    borderRadius: "10px",
                                    background:
                                        selectedUser?.id ===
                                        profile.id
                                            ? "#f1f8f4"
                                            : "#fff",
                                    cursor: "pointer",
                                    boxSizing: "border-box"
                                }}
                            >
                                <strong
                                    style={{
                                        display: "block",
                                        fontSize: "15px",
                                        marginBottom: "4px"
                                    }}
                                >
                                    {profile.full_name ||
                                        "Unnamed user"}
                                </strong>

                                <small
                                    style={{
                                        color: "#66756f"
                                    }}
                                >
                                    {roleLabel[
                                        profile.role
                                    ] || profile.role}{" "}
                                    ·{" "}
                                    {profile.active === false
                                        ? "Disabled"
                                        : "Active"}
                                </small>
                            </button>
                        ))
                    )}
                </section>

                <section className="app-card">
                    {selectedUser ? (
                        <>
                            <div
                                style={{
                                    borderBottom:
                                        "1px solid #e1e7e4",
                                    paddingBottom: "14px",
                                    marginBottom: "18px"
                                }}
                            >
                                <h2
                                    style={{
                                        margin: 0,
                                        marginBottom: "4px"
                                    }}
                                >
                                    {selectedUser.full_name ||
                                        "User"}
                                </h2>
                                <small
                                    style={{
                                        color: "#66756f"
                                    }}
                                >
                                    Manage account details
                                    and access
                                </small>
                            </div>

                            <div
                                style={{
                                    display: "grid",
                                    gap: "14px"
                                }}
                            >
                                <div>
                                    <label style={labelStyle}>
                                        Display name
                                    </label>
                                    <input
                                        style={inputStyle}
                                        value={form.full_name}
                                        onChange={(event) =>
                                            setForm({
                                                ...form,
                                                full_name:
                                                    event.target
                                                        .value
                                            })
                                        }
                                    />
                                </div>

                                <div>
                                    <label style={labelStyle}>
                                        Role
                                    </label>
                                    <select
                                        style={inputStyle}
                                        value={form.role}
                                        disabled={
                                            !isAdmin &&
                                            selectedUser.role ===
                                                "admin"
                                        }
                                        onChange={(event) =>
                                            setForm({
                                                ...form,
                                                role: event.target
                                                    .value
                                            })
                                        }
                                    >
                                        <option value="user">
                                            User
                                        </option>
                                        <option value="comp_secretary">
                                            Comp Secretary
                                        </option>
                                        {isAdmin && (
                                            <option value="admin">
                                                Admin
                                            </option>
                                        )}
                                    </select>
                                </div>

                                <label
                                    style={{
                                        display: "flex",
                                        gap: "10px",
                                        alignItems: "center",
                                        padding: "10px 12px",
                                        border:
                                            "1px solid #d8e0dc",
                                        borderRadius: "8px",
                                        background: "#fafcfb",
                                        cursor: "pointer"
                                    }}
                                >
                                    <input
                                        type="checkbox"
                                        checked={form.active}
                                        onChange={(event) =>
                                            setForm({
                                                ...form,
                                                active:
                                                    event.target
                                                        .checked
                                            })
                                        }
                                    />
                                    <span>
                                        <strong>
                                            Account active
                                        </strong>
                                        <small
                                            style={{
                                                display: "block",
                                                color: "#66756f"
                                            }}
                                        >
                                            Disabled accounts
                                            cannot use
                                            BowlPoint.
                                        </small>
                                    </span>
                                </label>

                                <button
                                    type="button"
                                    onClick={save}
                                    disabled={saving}
                                    className="primary-button"
                                    style={{
                                        marginTop: "2px",
                                        width: "fit-content"
                                    }}
                                >
                                    {saving
                                        ? "Saving…"
                                        : "Save user"}
                                </button>
                                <div
                                    style={{
                                        marginTop: "24px",
                                        paddingTop: "20px",
                                        borderTop: "1px solid #e1e7e4"
                                    }}
                                >
                                    <h3
                                        style={{
                                            marginTop: 0,
                                            marginBottom: "4px"
                                        }}
                                    >
                                        Account security
                                    </h3>

                                    <p
                                        style={{
                                            marginTop: 0,
                                            color: "#66756f",
                                            fontSize: "14px"
                                        }}
                                    >
                                        Reset this user's password or permanently
                                        remove their BowlPoint account.
                                    </p>

                                    <div
                                        style={{
                                            display: "grid",
                                            gridTemplateColumns: "1fr 1fr",
                                            gap: "12px",
                                            marginBottom: "14px"
                                        }}
                                    >
                                        <div>
                                            <label style={labelStyle}>
                                                New password
                                            </label>

                                            <input
                                                style={inputStyle}
                                                type="password"
                                                value={passwordReset.password}
                                                onChange={(event) =>
                                                    setPasswordReset({
                                                        ...passwordReset,
                                                        password:
                                                            event.target.value
                                                    })
                                                }
                                                minLength={8}
                                                autoComplete="new-password"
                                            />
                                        </div>

                                        <div>
                                            <label style={labelStyle}>
                                                Confirm new password
                                            </label>

                                            <input
                                                style={inputStyle}
                                                type="password"
                                                value={
                                                    passwordReset.confirm_password
                                                }
                                                onChange={(event) =>
                                                    setPasswordReset({
                                                        ...passwordReset,
                                                        confirm_password:
                                                            event.target.value
                                                    })
                                                }
                                                minLength={8}
                                                autoComplete="new-password"
                                            />
                                        </div>
                                    </div>

                                    <div
                                        style={{
                                            display: "flex",
                                            gap: "10px",
                                            alignItems: "center"
                                        }}
                                    >
                                        <button
                                            type="button"
                                            onClick={resetPassword}
                                            disabled={
                                                saving ||
                                                !passwordReset.password ||
                                                !passwordReset.confirm_password
                                            }
                                            className="primary-button"
                                        >
                                            {saving
                                                ? "Working…"
                                                : "Reset password"}
                                        </button>

                                        {(isAdmin ||
                                            selectedUser.role !== "admin") && (
                                            <button
                                                type="button"
                                                onClick={deleteUser}
                                                disabled={saving}
                                                style={{
                                                    minHeight: "42px",
                                                    padding: "0 18px",
                                                    borderRadius: "8px",
                                                    border: "1px solid #c62828",
                                                    background: "#fff",
                                                    color: "#c62828",
                                                    cursor: "pointer",
                                                    fontSize: "15px",
                                                    fontWeight: 600
                                                }}
                                            >
                                                Delete user
                                            </button>
                                        )}
                                    </div>

                                    <small
                                        style={{
                                            display: "block",
                                            marginTop: "10px",
                                            color: "#66756f"
                                        }}
                                    >
                                        Passwords must contain at least 8
                                        characters.
                                    </small>
                                </div>
                            </div>

                            {selectedUser.role === "user" && (
                                <div
                                    style={{
                                        borderTop:
                                            "1px solid #e1e7e4",
                                        marginTop: "24px",
                                        paddingTop: "20px"
                                    }}
                                >
                                    <h3
                                        style={{
                                            marginTop: 0,
                                            marginBottom: "4px"
                                        }}
                                    >
                                        Competition access
                                    </h3>

                                    <p
                                        style={{
                                            marginTop: 0,
                                            color: "#66756f",
                                            fontSize: "14px"
                                        }}
                                    >
                                        Select the competitions
                                        this user can view and
                                        score.
                                    </p>

                                    {competitions.length ===
                                    0 ? (
                                        <p
                                            style={{
                                                color: "#66756f"
                                            }}
                                        >
                                            No competitions are
                                            available.
                                        </p>
                                    ) : (
                                        <div
                                            style={{
                                                display: "grid",
                                                gap: "6px"
                                            }}
                                        >
                                            {competitions.map(
                                                (comp) => {
                                                    const assigned =
                                                        access.some(
                                                            (item) =>
                                                                item.competition_id ===
                                                                    comp.id &&
                                                                item.can_view
                                                        );

                                                    return (
                                                        <label
                                                            key={
                                                                comp.id
                                                            }
                                                            style={{
                                                                display:
                                                                    "flex",
                                                                gap: "10px",
                                                                alignItems:
                                                                    "center",
                                                                padding:
                                                                    "10px 12px",
                                                                border:
                                                                    "1px solid #d8e0dc",
                                                                borderRadius:
                                                                    "8px",
                                                                cursor: "pointer"
                                                            }}
                                                        >
                                                            <input
                                                                type="checkbox"
                                                                checked={
                                                                    assigned
                                                                }
                                                                onChange={(
                                                                    event
                                                                ) =>
                                                                    toggleCompetition(
                                                                        comp.id,
                                                                        event
                                                                            .target
                                                                            .checked
                                                                    )
                                                                }
                                                            />
                                                            <span>
                                                                {
                                                                    comp.name
                                                                }
                                                            </span>
                                                        </label>
                                                    );
                                                }
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}
                        </>
                    ) : (
                        <div
                            style={{
                                padding: "28px 10px",
                                textAlign: "center",
                                color: "#66756f"
                            }}
                        >
                            <div
                                style={{
                                    fontSize: "28px",
                                    marginBottom: "10px"
                                }}
                            >
                                👤
                            </div>
                            <h3
                                style={{
                                    margin: "0 0 6px",
                                    color: "#26352f"
                                }}
                            >
                                Select a user
                            </h3>
                            <p
                                style={{
                                    margin: 0
                                }}
                            >
                                Select a user from the list to
                                manage their account and
                                competition access.
                            </p>
                        </div>
                    )}

                    {message && (
                        <div
                            style={{
                                marginTop: "16px",
                                padding: "10px 12px",
                                borderRadius: "8px",
                                background: "#edf8f1",
                                color: "#23643b"
                            }}
                        >
                            {message}
                        </div>
                    )}

                    {error && (
                        <div
                            style={{
                                marginTop: "16px",
                                padding: "10px 12px",
                                borderRadius: "8px",
                                background: "#fff1f1",
                                color: "#a33"
                            }}
                        >
                            {error}
                        </div>
                    )}
                </section>
            </div>

            <section
                className="app-card"
                style={{
                    marginTop: "24px"
                }}
            >
                <div
                    style={{
                        borderBottom:
                            "1px solid #e1e7e4",
                        paddingBottom: "14px",
                        marginBottom: "20px"
                    }}
                >
                    <h2
                        style={{
                            margin: 0,
                            marginBottom: "4px"
                        }}
                    >
                        Add user
                    </h2>
                    <p
                        style={{
                            margin: 0,
                            color: "#66756f"
                        }}
                    >
                        Create a BowlPoint login and set the
                        password immediately.
                    </p>
                </div>

                <form onSubmit={createUser}>
                    <div
                        style={{
                            display: "grid",
                            gridTemplateColumns:
                                "1fr 1fr 220px",
                            gap: "16px",
                            alignItems: "start"
                        }}
                    >
                        <div>
                            <label style={labelStyle}>
                                Full name
                            </label>
                            <input
                                style={inputStyle}
                                value={invite.full_name}
                                onChange={(event) =>
                                    handleInviteChange(
                                        "full_name",
                                        event.target.value
                                    )
                                }
                                required
                            />
                        </div>

                        <div>
                            <label style={labelStyle}>
                                Email address
                            </label>
                            <input
                                style={inputStyle}
                                type="email"
                                value={invite.email}
                                onChange={(event) =>
                                    handleInviteChange(
                                        "email",
                                        event.target.value
                                    )
                                }
                                required
                            />
                        </div>

                        <div>
                            <label style={labelStyle}>
                                Role
                            </label>
                            <select
                                style={inputStyle}
                                value={invite.role}
                                onChange={(event) =>
                                    handleInviteChange(
                                        "role",
                                        event.target.value
                                    )
                                }
                            >
                                <option value="user">
                                    User
                                </option>
                                <option value="comp_secretary">
                                    Comp Secretary
                                </option>
                                {isAdmin && (
                                    <option value="admin">
                                        Admin
                                    </option>
                                )}
                            </select>
                        </div>

                        <div>
                            <label style={labelStyle}>
                                Password
                            </label>
                            <input
                                style={inputStyle}
                                type="password"
                                value={invite.password}
                                onChange={(event) =>
                                    handleInviteChange(
                                        "password",
                                        event.target.value
                                    )
                                }
                                minLength={8}
                                required
                                autoComplete="new-password"
                            />
                            <small
                                style={{
                                    display: "block",
                                    marginTop: "5px",
                                    color: "#66756f"
                                }}
                            >
                                Minimum 8 characters
                            </small>
                        </div>

                        <div>
                            <label style={labelStyle}>
                                Confirm password
                            </label>
                            <input
                                style={inputStyle}
                                type="password"
                                value={invite.confirm_password}
                                onChange={(event) =>
                                    handleInviteChange(
                                        "confirm_password",
                                        event.target.value
                                    )
                                }
                                minLength={8}
                                required
                                autoComplete="new-password"
                            />
                        </div>

                        <div
                            style={{
                                display: "flex",
                                alignItems: "end",
                                height: "100%"
                            }}
                        >
                            <button
                                type="submit"
                                className="primary-button"
                                disabled={saving}
                                style={{
                                    width: "100%",
                                    minHeight: "42px"
                                }}
                            >
                                {saving
                                    ? "Creating…"
                                    : "Create user"}
                            </button>
                        </div>
                    </div>

                    <div
                        style={{
                            marginTop: "16px",
                            padding: "12px 14px",
                            borderRadius: "8px",
                            background: "#f5f8f6",
                            color: "#66756f",
                            fontSize: "14px"
                        }}
                    >
                        No email invitation is sent. The account
                        is created immediately and the password is
                        set here.
                    </div>
                </form>
            </section>
        </div>
    );
}
