import { useEffect, useRef, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import {
    parseMembershipPdf,
    reconcileMembership,
    buildPlayerInsert
} from "../../services/supabase/playerMembershipImportService";

function Players() {

    const [players, setPlayers] = useState([]);
    const [clubs, setClubs] = useState([]);

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [importing, setImporting] = useState(false);
    const [importFile, setImportFile] = useState(null);
    const [importResults, setImportResults] = useState(null);

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
     * Membership PDF import / reconciliation
     */
    const handleMembershipImport = async (event) => {

        const file = event.target.files?.[0];
        event.target.value = "";

        if (!file) {
            return;
        }

        if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
            alert("Please select a PDF membership list.");
            return;
        }

        try {
            setImporting(true);
            setImportFile(file);
            setImportResults(null);

            const records = await parseMembershipPdf(file);
            const results = reconcileMembership(records, players, clubs);

            setImportResults(results);
        } catch (error) {
            console.error("Membership PDF import failed:", error);
            alert(`Unable to read the membership PDF.\n\n${error.message}`);
            setImportFile(null);
            setImportResults(null);
        } finally {
            setImporting(false);
        }
    };


    const handleImportNewPlayers = async () => {

        if (!importResults?.newPlayers?.length || saving) {
            return;
        }

        const importable = importResults.newPlayers.filter(player => player.club_id);

        if (!importable.length) {
            alert("None of the new players have a matching BowlPoint club. Please add or correct the clubs first.");
            return;
        }

        const confirmed = window.confirm(
            `Import ${importable.length} new player${importable.length === 1 ? "" : "s"} into BowlPoint?\n\nPlayers without a matching club will not be imported.`
        );

        if (!confirmed) {
            return;
        }

        setSaving(true);

        try {
            const payload = importable.map(buildPlayerInsert);

            const { error } = await supabase
                .from("players")
                .insert(payload);

            if (error) {
                throw error;
            }

            await loadData();

            setImportResults(prev => ({
                ...prev,
                newPlayers: prev.newPlayers.filter(player => !importable.some(
                    imported => imported.bsa_number === player.bsa_number
                ))
            }));

            alert(`${importable.length} new player${importable.length === 1 ? "" : "s"} imported successfully.`);
        } catch (error) {
            console.error("Failed to import new players:", error);
            alert(`Unable to import the new players.\n\n${error.message}`);
        } finally {
            setSaving(false);
        }
    };


    const clearImportResults = () => {
        setImportFile(null);
        setImportResults(null);
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


                <div className="d-flex gap-2">

                    <label className="btn btn-outline-primary mb-0">

                        <i className="bi bi-file-earmark-pdf me-2"></i>

                        {importing ? "Reading PDF..." : "Import Membership PDF"}

                        <input
                            type="file"
                            accept="application/pdf,.pdf"
                            className="d-none"
                            onChange={handleMembershipImport}
                            disabled={importing || saving}
                        />

                    </label>

                    <button
                        type="button"
                        className="btn btn-primary"
                        onClick={handleAddPlayer}
                        disabled={importing}
                    >

                        <i className="bi bi-person-plus-fill me-2"></i>

                        Add Player

                    </button>

                </div>

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


            {/* Membership reconciliation */}

            {importResults && (

                <div className="card shadow-sm border-0 mb-4">

                    <div className="card-header bg-white d-flex justify-content-between align-items-center">

                        <div>
                            <h5 className="mb-1">
                                <i className="bi bi-arrow-left-right me-2"></i>
                                Membership Reconciliation
                            </h5>
                            <div className="small text-muted">
                                {importFile?.name || "Membership PDF"} — no database changes were made by the comparison.
                            </div>
                        </div>

                        <button
                            type="button"
                            className="btn btn-sm btn-outline-secondary"
                            onClick={clearImportResults}
                            disabled={saving}
                        >
                            Close
                        </button>

                    </div>

                    <div className="card-body">

                        <div className="row g-3 mb-4">

                            <div className="col-md-3">
                                <div className="border rounded p-3 h-100">
                                    <div className="text-muted small">Master list</div>
                                    <div className="fs-4 fw-bold">{importResults.masterCount}</div>
                                    <div className="small text-muted">players read from PDF</div>
                                </div>
                            </div>

                            <div className="col-md-3">
                                <div className="border rounded p-3 h-100">
                                    <div className="text-muted small">New players</div>
                                    <div className="fs-4 fw-bold text-primary">{importResults.newPlayers.length}</div>
                                    <div className="small text-muted">in PDF, not in BowlPoint</div>
                                </div>
                            </div>

                            <div className="col-md-3">
                                <div className="border rounded p-3 h-100">
                                    <div className="text-muted small">Missing from master</div>
                                    <div className="fs-4 fw-bold text-danger">{importResults.missingPlayers.length}</div>
                                    <div className="small text-muted">in BowlPoint, not in PDF</div>
                                </div>
                            </div>

                            <div className="col-md-3">
                                <div className="border rounded p-3 h-100">
                                    <div className="text-muted small">Club changes</div>
                                    <div className="fs-4 fw-bold text-warning">{importResults.clubMismatches.length}</div>
                                    <div className="small text-muted">same BSA number, different club</div>
                                </div>
                            </div>

                        </div>

                        {importResults.newPlayers.length > 0 && (

                            <div className="mb-4">
                                <div className="d-flex justify-content-between align-items-center mb-2">
                                    <h6 className="mb-0">New Players</h6>
                                    <button
                                        type="button"
                                        className="btn btn-sm btn-primary"
                                        onClick={handleImportNewPlayers}
                                        disabled={saving || !importResults.newPlayers.some(player => player.club_id)}
                                    >
                                        <i className="bi bi-person-plus me-1"></i>
                                        Import New Players
                                    </button>
                                </div>

                                <div className="table-responsive">
                                    <table className="table table-sm table-hover align-middle mb-0">
                                        <thead>
                                            <tr>
                                                <th>Player</th>
                                                <th>BSA Number</th>
                                                <th>Master Club</th>
                                                <th>Match</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {importResults.newPlayers.map(player => (
                                                <tr key={`new-${player.bsa_number}`}>
                                                    <td>{player.source_name}</td>
                                                    <td>{player.bsa_number}</td>
                                                    <td>{player.club_name || "—"}</td>
                                                    <td>
                                                        {player.club_match ? (
                                                            <span className="badge bg-success">Club matched</span>
                                                        ) : (
                                                            <span className="badge bg-warning text-dark">No club match</span>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                        )}

                        {importResults.missingPlayers.length > 0 && (

                            <div className="mb-4">
                                <h6 className="mb-2">Players in BowlPoint but Missing from Master List</h6>
                                <div className="table-responsive">
                                    <table className="table table-sm table-hover align-middle mb-0">
                                        <thead>
                                            <tr>
                                                <th>Player</th>
                                                <th>BSA Number</th>
                                                <th>Club</th>
                                                <th>Status</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {importResults.missingPlayers.map(player => (
                                                <tr key={`missing-${player.id}`}>
                                                    <td>{player.nickname || player.first_name} {player.last_name}</td>
                                                    <td>{player.bsa_number || "—"}</td>
                                                    <td>{player.clubs?.short_name || player.clubs?.name || "—"}</td>
                                                    <td><span className="badge bg-danger">Review</span></td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                <div className="small text-muted mt-2">
                                    These players are not deleted or deactivated automatically. Review them before making any changes.
                                </div>
                            </div>

                        )}

                        {importResults.clubMismatches.length > 0 && (

                            <div className="mb-2">
                                <h6 className="mb-2">Club Changes</h6>
                                <div className="table-responsive">
                                    <table className="table table-sm table-hover align-middle mb-0">
                                        <thead>
                                            <tr>
                                                <th>Player</th>
                                                <th>BSA Number</th>
                                                <th>Master Club</th>
                                                <th>BowlPoint Club</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {importResults.clubMismatches.map(item => (
                                                <tr key={`club-${item.bsa_number}`}>
                                                    <td>{item.source_name}</td>
                                                    <td>{item.bsa_number}</td>
                                                    <td>{item.club_name || "—"}</td>
                                                    <td>{item.player.clubs?.short_name || item.player.clubs?.name || "—"}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                        )}

                        {importResults.newPlayers.length === 0 && importResults.missingPlayers.length === 0 && importResults.clubMismatches.length === 0 && (
                            <div className="alert alert-success mb-0">
                                <i className="bi bi-check-circle me-2"></i>
                                BowlPoint matches the uploaded master membership list.
                            </div>
                        )}

                    </div>

                </div>

            )}


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