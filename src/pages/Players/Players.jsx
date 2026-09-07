import { useEffect, useRef, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

function Players() {

    const [players, setPlayers] = useState([]);
    const [clubs, setClubs] = useState([]);

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const [search, setSearch] = useState("");

    const [showForm, setShowForm] = useState(false);
    const [editingPlayer, setEditingPlayer] = useState(null);

    const editFormRef = useRef(null);

    const [form, setForm] = useState({
        first_name: "",
        nickname: "",
        last_name: "",
        club_id: "",
        date_registered: "",
        bsa_number: "",
        id_number: "",
        active: true
    });


    /*
     * Load players and clubs
     */
    const loadData = async () => {

        setLoading(true);

        const [
            playersResult,
            clubsResult
        ] = await Promise.all([

            supabase
                .from("players")
                .select(`
                    id,
                    first_name,
                    nickname,
                    last_name,
                    display_name,
                    club_id,
                    date_registered,
                    bsa_number,
                    id_number,
                    active,
                    clubs (
                        id,
                        name,
                        short_name,
                        active
                    )
                `)
                .order("first_name")
                .order("last_name"),

            supabase
                .from("clubs")
                .select("*")
                .eq("active", true)
                .order("name")

        ]);


        if (playersResult.error) {

            console.error(
                "Error loading players:",
                playersResult.error
            );

            alert(
                `Unable to load players.\n\n${playersResult.error.message}`
            );

            setLoading(false);

            return;

        }


        if (clubsResult.error) {

            console.error(
                "Error loading clubs:",
                clubsResult.error
            );

            alert(
                `Unable to load clubs.\n\n${clubsResult.error.message}`
            );

            setLoading(false);

            return;

        }


        setPlayers(playersResult.data || []);
        setClubs(clubsResult.data || []);

        setLoading(false);

    };


    useEffect(() => {

        loadData();

    }, []);


    useEffect(() => {

        if (!showForm || !editingPlayer || !editFormRef.current) {
            return;
        }

        // Wait for the edit card to render before scrolling to it.
        requestAnimationFrame(() => {
            editFormRef.current?.scrollIntoView({
                behavior: "smooth",
                block: "start"
            });
        });

    }, [showForm, editingPlayer]);


    /*
     * Reset form
     */
    const resetForm = () => {

        setForm({
            first_name: "",
            nickname: "",
            last_name: "",
            club_id: "",
            date_registered: "",
            bsa_number: "",
            id_number: "",
            active: true
        });

        setEditingPlayer(null);

    };


    /*
     * Add player
     */
    const handleAddPlayer = () => {

        resetForm();

        setShowForm(true);

    };


    /*
     * Edit player
     */
    const handleEditPlayer = (player) => {

        setEditingPlayer(player);

        setForm({
            first_name: player.first_name || "",
            nickname: player.nickname || "",
            last_name: player.last_name || "",
            club_id: player.club_id || "",
            date_registered: player.date_registered || "",
            bsa_number: player.bsa_number || "",
            id_number: player.id_number || "",
            active: player.active ?? true
        });

        setShowForm(true);

    };


    /*
     * Form changes
     */
    const handleChange = (e) => {

        const {
            name,
            value,
            type,
            checked
        } = e.target;

        setForm(prev => ({
            ...prev,
            [name]:
                type === "checkbox"
                    ? checked
                    : value
        }));

    };


    /*
     * Save player
     */
    const handleSave = async (e) => {

        e.preventDefault();


        if (!form.first_name.trim()) {

            alert("Please enter the player's first name.");

            return;

        }


        if (!form.last_name.trim()) {

            alert("Please enter the player's surname.");

            return;

        }


        if (!form.club_id) {

            alert("Please select a club.");

            return;

        }


        setSaving(true);


        const payload = {

            first_name:
                form.first_name.trim(),

            nickname:
                form.nickname.trim() || null,

            last_name:
                form.last_name.trim(),

            club_id:
                form.club_id,

            date_registered:
                form.date_registered || null,

            bsa_number:
                form.bsa_number.trim() || null,

            id_number:
                form.id_number.trim() || null,

            active:
                form.active

        };


        let error;


        if (editingPlayer) {

            const result = await supabase
                .from("players")
                .update(payload)
                .eq("id", editingPlayer.id);

            error = result.error;

        } else {

            const result = await supabase
                .from("players")
                .insert(payload);

            error = result.error;

        }


        setSaving(false);


        if (error) {

            console.error(
                "Error saving player:",
                error
            );

            alert(
                `Unable to save player.\n\n${error.message}`
            );

            return;

        }


        setShowForm(false);

        resetForm();

        await loadData();

    };


    /*
     * Filter players
     */
    const filteredPlayers = players.filter(player => {

        const searchText =
            search.trim().toLowerCase();

        if (!searchText) {
            return true;
        }


        const fullName = `
            ${player.first_name || ""}
            ${player.nickname || ""}
            ${player.last_name || ""}
        `.trim().toLowerCase();


        const clubName =
            player.clubs?.name
                ?.toLowerCase() || "";


        const shortClubName =
            player.clubs?.short_name
                ?.toLowerCase() || "";


        const bsaNumber =
            player.bsa_number
                ?.toLowerCase() || "";


        return (
            fullName.includes(searchText) ||
            clubName.includes(searchText) ||
            shortClubName.includes(searchText) ||
            bsaNumber.includes(searchText)
        );

    });


    return (

        <div className="container-fluid py-4">

            {/* Header */}

            <div className="d-flex justify-content-between align-items-center mb-4">

                <div>

                    <h1 className="mb-1">
                        Players
                    </h1>

                    <p className="text-muted mb-0">
                        Manage registered BowlPoint players.
                    </p>

                </div>


                <button
                    type="button"
                    className="btn btn-primary"
                    onClick={handleAddPlayer}
                >

                    <i className="bi bi-person-plus-fill me-2"></i>

                    Add Player

                </button>

            </div>


            {/* Search */}

            <div className="card shadow-sm border-0 mb-4">

                <div className="card-body">

                    <div className="input-group">

                        <span className="input-group-text">

                            <i className="bi bi-search"></i>

                        </span>

                        <input
                            type="text"
                            className="form-control"
                            placeholder="Search by name, club or BSA number..."
                            value={search}
                            onChange={(e) =>
                                setSearch(e.target.value)
                            }
                        />

                    </div>

                </div>

            </div>


            {/* Player form */}

            {showForm && (

                <div
                    ref={editFormRef}
                    className="card shadow-sm border-0 mb-4"
                >

                    <div className="card-header bg-white">

                        <h5 className="mb-0">

                            <i className="bi bi-person-fill me-2"></i>

                            {editingPlayer
                                ? "Edit Player"
                                : "Add Player"
                            }

                        </h5>

                    </div>


                    <form onSubmit={handleSave}>

                        <div className="card-body">

                            <div className="row g-3">

                                {/* First name */}

                                <div className="col-md-6">

                                    <label className="form-label">
                                        Name
                                    </label>

                                    <input
                                        type="text"
                                        name="first_name"
                                        className="form-control"
                                        value={form.first_name}
                                        onChange={handleChange}
                                        required
                                    />

                                </div>


                                {/* Nickname */}

                                <div className="col-md-6">

                                    <label className="form-label">
                                        Nickname <span className="text-muted">(optional)</span>
                                    </label>

                                    <input
                                        type="text"
                                        name="nickname"
                                        className="form-control"
                                        value={form.nickname}
                                        onChange={handleChange}
                                        placeholder="e.g. Albert"
                                    />

                                </div>


                                {/* Surname */}

                                <div className="col-md-6">

                                    <label className="form-label">
                                        Surname
                                    </label>

                                    <input
                                        type="text"
                                        name="last_name"
                                        className="form-control"
                                        value={form.last_name}
                                        onChange={handleChange}
                                        required
                                    />

                                </div>


                                {/* Club */}

                                <div className="col-md-6">

                                    <label className="form-label">
                                        Club
                                    </label>

                                    <select
                                        name="club_id"
                                        className="form-select"
                                        value={form.club_id}
                                        onChange={handleChange}
                                        required
                                    >

                                        <option value="">
                                            Select club...
                                        </option>

                                        {clubs.map(club => (

                                            <option
                                                key={club.id}
                                                value={club.id}
                                            >

                                                {club.name}

                                            </option>

                                        ))}

                                    </select>

                                </div>


                                {/* Date registered */}

                                <div className="col-md-6">

                                    <label className="form-label">
                                        Date Registered
                                    </label>

                                    <input
                                        type="date"
                                        name="date_registered"
                                        className="form-control"
                                        value={form.date_registered}
                                        onChange={handleChange}
                                    />

                                </div>


                                {/* BSA */}

                                <div className="col-md-6">

                                    <label className="form-label">
                                        BSA Number
                                    </label>

                                    <input
                                        type="text"
                                        name="bsa_number"
                                        className="form-control"
                                        value={form.bsa_number}
                                        onChange={handleChange}
                                    />

                                </div>


                                {/* ID */}

                                <div className="col-md-6">

                                    <label className="form-label">
                                        ID Number
                                    </label>

                                    <input
                                        type="text"
                                        name="id_number"
                                        className="form-control"
                                        value={form.id_number}
                                        onChange={handleChange}
                                    />

                                </div>


                                {/* Active */}

                                <div className="col-12">

                                    <div className="form-check">

                                        <input
                                            type="checkbox"
                                            className="form-check-input"
                                            id="playerActive"
                                            name="active"
                                            checked={form.active}
                                            onChange={handleChange}
                                        />

                                        <label
                                            className="form-check-label"
                                            htmlFor="playerActive"
                                        >
                                            Active player
                                        </label>

                                    </div>

                                </div>

                            </div>

                        </div>


                        <div className="card-footer bg-white d-flex justify-content-end gap-2">

                            <button
                                type="button"
                                className="btn btn-outline-secondary"
                                onClick={() => {

                                    setShowForm(false);

                                    resetForm();

                                }}
                                disabled={saving}
                            >

                                Cancel

                            </button>


                            <button
                                type="submit"
                                className="btn btn-primary"
                                disabled={saving}
                            >

                                {saving ? (

                                    <>
                                        <span
                                            className="spinner-border spinner-border-sm me-2"
                                        ></span>

                                        Saving...

                                    </>

                                ) : (

                                    <>
                                        <i className="bi bi-check-lg me-2"></i>

                                        {editingPlayer
                                            ? "Save Changes"
                                            : "Save Player"
                                        }

                                    </>

                                )}

                            </button>

                        </div>

                    </form>

                </div>

            )}


            {/* Players table */}

            <div className="card shadow-sm border-0">

                <div className="card-header bg-white d-flex justify-content-between align-items-center">

                    <h5 className="mb-0">

                        <i className="bi bi-people-fill me-2"></i>

                        Registered Players

                    </h5>

                    <span className="badge bg-primary">
                        {filteredPlayers.length}
                    </span>

                </div>


                <div className="card-body p-0">

                    {loading ? (

                        <div className="text-center py-5">

                            <div
                                className="spinner-border text-primary"
                            ></div>

                            <div className="text-muted mt-2">
                                Loading players...
                            </div>

                        </div>

                    ) : filteredPlayers.length === 0 ? (

                        <div className="text-center py-5">

                            <i
                                className="bi bi-person display-4 text-muted"
                            ></i>

                            <h5 className="mt-3">
                                No players found
                            </h5>

                            <p className="text-muted mb-0">

                                {search
                                    ? "Try changing your search."
                                    : "Add your first player to get started."
                                }

                            </p>

                        </div>

                    ) : (

                        <div className="table-responsive">

                            <table className="table table-hover mb-0">

                                <thead>

                                    <tr>

                                        <th>
                                            Player
                                        </th>

                                        <th>
                                            Club
                                        </th>

                                        <th>
                                            BSA Number
                                        </th>

                                        <th>
                                            Date Registered
                                        </th>

                                        <th>
                                            Status
                                        </th>

                                        <th className="text-end">
                                            Action
                                        </th>

                                    </tr>

                                </thead>


                                <tbody>

                                    {filteredPlayers.map(player => (

                                        <tr key={player.id}>

                                            <td>

                                                <strong>
                                                    {player.nickname || player.first_name}{" "}
                                                    {player.last_name}
                                                    {player.nickname && (
                                                        <div className="small text-muted fw-normal">
                                                            Legal name: {player.first_name} {player.last_name}
                                                        </div>
                                                    )}
                                                </strong>

                                            </td>


                                            <td>

                                                {player.clubs?.short_name
                                                    ? player.clubs.short_name
                                                    : player.clubs?.name || "—"
                                                }

                                            </td>


                                            <td>
                                                {player.bsa_number || "—"}
                                            </td>


                                            <td>
                                                {player.date_registered || "—"}
                                            </td>


                                            <td>

                                                {player.active ? (

                                                    <span className="badge bg-success">
                                                        Active
                                                    </span>

                                                ) : (

                                                    <span className="badge bg-secondary">
                                                        Inactive
                                                    </span>

                                                )}

                                            </td>


                                            <td className="text-end">

                                                <button
                                                    type="button"
                                                    className="btn btn-sm btn-outline-primary"
                                                    onClick={() =>
                                                        handleEditPlayer(player)
                                                    }
                                                >

                                                    <i className="bi bi-pencil me-1"></i>

                                                    Edit

                                                </button>

                                            </td>

                                        </tr>

                                    ))}

                                </tbody>

                            </table>

                        </div>

                    )}

                </div>

            </div>

        </div>

    );

}

export default Players;