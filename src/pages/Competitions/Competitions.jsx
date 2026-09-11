import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../../context/AuthContext";

function Competitions() {

    const { isAdmin } = useAuth();

    const [competitions, setCompetitions] = useState([]);

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const [showForm, setShowForm] = useState(false);
    const [editingCompetition, setEditingCompetition] = useState(null);

    const [search, setSearch] = useState("");

    const [form, setForm] = useState({
        name: "",
        format: "fours",
        structure: "sectional",
        section_mode: "multiple",
        schedule_type: "weekend",
        min_teams_per_section: 3,
        max_teams_per_section: 6,
        win_points: 2,
        draw_points: 1,
        loss_points: 0,
        skins_enabled: false,
        points_per_skin: 1
    });


    /*
     * Load competitions
     */
    const loadCompetitions = async () => {

        setLoading(true);

        const { data, error } = await supabase
            .from("competitions")
            .select("*")
            .order("created_at", {
                ascending: false
            });


        if (error) {

            console.error(
                "Error loading competitions:",
                error
            );

            alert(
                `Unable to load competitions.\n\n${error.message}`
            );

            setLoading(false);

            return;
        }


        setCompetitions(data || []);

        setLoading(false);

    };


    useEffect(() => {

        loadCompetitions();

    }, []);


    /*
     * Reset form
     */
    const resetForm = () => {

        setForm({
            name: "",
            format: "fours",
            structure: "sectional",
            section_mode: "multiple",
            schedule_type: "weekend",
            min_teams_per_section: 3,
            max_teams_per_section: 6,
            win_points: 2,
            draw_points: 1,
            loss_points: 0,
        skins_enabled: false,
        points_per_skin: 1
        });

        setEditingCompetition(null);

    };


    /*
     * Add competition
     */
    const handleAddCompetition = () => {

        resetForm();

        setShowForm(true);

    };


    /*
     * Edit competition
     */
    const handleEditCompetition = (competition) => {

        const scoring =
            competition.scoring || {};

        setEditingCompetition(competition);

        setForm({

            name:
                competition.name || "",

            format:
                competition.format || "fours",

            structure:
                competition.structure === "round_robin"
                    ? "sectional"
                    : (competition.structure || "sectional"),

            section_mode:
                competition.structure === "round_robin"
                    ? "none"
                    : (competition.section_mode || "multiple"),

            /*
             * Schedule type is stored explicitly.
             * Older competitions without schedule_type are migrated from
             * max_games_per_day: 1 = Midweek, otherwise Weekend.
             */
            schedule_type:
                competition.schedule_type ||
                (Number(competition.max_games_per_day) === 1
                    ? "midweek"
                    : "weekend"),

            min_teams_per_section:
                competition.min_teams_per_section || 3,

            max_teams_per_section:
                competition.max_teams_per_section || 6,

            win_points:
                scoring.win ?? 2,

            draw_points:
                scoring.draw ?? 1,

            loss_points:
                scoring.loss ?? 0,

            skins_enabled:
                scoring.skins?.enabled ?? false,

            points_per_skin:
                scoring.skins?.pointsPerSkin ?? 1

        });

        setShowForm(true);

    };


    /*
     * Form changes
     */
    const handleChange = (e) => {

        const {
            name,
            value
        } = e.target;

        setForm(prev => ({
            ...prev,
            [name]: value,
            ...(name === "structure" && value === "knockout"
                ? { section_mode: "none" }
                : {}),
            ...(name === "structure" && value === "sectional" && prev.section_mode === "none"
                ? { section_mode: "multiple" }
                : {})
        }));

    };


    /*
     * Generate public competition code
     */
    const generatePublicCode = () => {

        const characters =
            "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

        let code = "";

        for (let i = 0; i < 6; i++) {

            code += characters.charAt(
                Math.floor(
                    Math.random() * characters.length
                )
            );

        }

        return code;

    };


    /*
     * Generate unique public code
     */
    const getUniquePublicCode = async () => {

        let code = "";
        let exists = true;

        while (exists) {

            code = generatePublicCode();

            const { data, error } = await supabase
                .from("competitions")
                .select("id")
                .eq("public_code", code)
                .maybeSingle();


            if (error) {

                throw error;

            }

            exists = !!data;

        }

        return code;

    };


    /*
     * Save competition
     */
    const handleSave = async (e) => {

        e.preventDefault();


        if (!form.name.trim()) {

            alert(
                "Please enter a competition name."
            );

            return;

        }


        if (
            form.section_mode === "multiple" &&
            Number(form.min_teams_per_section) >
            Number(form.max_teams_per_section)
        ) {

            alert(
                "Minimum teams per section cannot be greater than the maximum."
            );

            return;

        }


        setSaving(true);


        try {

            const payload = {

                name:
                    form.name.trim(),

                format:
                    form.format,

                structure:
                    form.structure,

                section_mode:
                    form.structure === "knockout" ? "none" : form.section_mode,

                /*
                 * Store the scheduling mode explicitly. max_games_per_day
                 * remains as the capacity hint used by the scheduling engine.
                 */
                schedule_type:
                    form.schedule_type,

                max_games_per_day:
                    form.schedule_type === "midweek"
                        ? 1
                        : 3,

                min_teams_per_section:
                    form.section_mode === "multiple" ? Number(form.min_teams_per_section) : null,

                max_teams_per_section:
                    form.section_mode === "multiple" ? Number(form.max_teams_per_section) : null,

                scoring: {

                    win:
                        Number(form.win_points),

                    draw:
                        Number(form.draw_points),

                    loss:
                        Number(form.loss_points),

                    skins: {
                        enabled: Boolean(form.skins_enabled),
                        pointsPerSkin: Number(form.points_per_skin) || 1
                    },

                    points_type:
                        "match_points"

                }

            };


            let result;


            if (editingCompetition) {

                result = await supabase
                    .from("competitions")
                    .update(payload)
                    .eq(
                        "id",
                        editingCompetition.id
                    );

            } else {

                const publicCode =
                    await getUniquePublicCode();


                result = await supabase
                    .from("competitions")
                    .insert({

                        ...payload,

                        public_code:
                            publicCode,

                        status:
                            "draft"

                    });

            }


            if (result.error) {

                throw result.error;

            }


            setShowForm(false);

            resetForm();

            await loadCompetitions();

        } catch (error) {

            console.error(
                "Error saving competition:",
                error
            );

            alert(
                `Unable to save competition.\n\n${error.message}`
            );

        } finally {

            setSaving(false);

        }

    };


    /*
     * Delete competition.
     *
     * The UI restricts this action to administrators. Supabase RLS
     * must also enforce the same rule so the API cannot be used to
     * bypass the UI.
     */
    const handleDeleteCompetition = async (competition) => {

        if (!isAdmin) {
            return;
        }

        const confirmed = window.confirm(
            `Delete competition "${competition.name}"?\n\n` +
            "This will permanently delete the competition and its " +
            "associated teams, draw, schedule, results and scoring data.\n\n" +
            "This action cannot be undone."
        );

        if (!confirmed) {
            return;
        }

        setSaving(true);

        try {

            const { error } = await supabase.rpc(
                "delete_competition",
                {
                    p_competition_id: competition.id
                }
            );

            if (error) {
                throw error;
            }

            setCompetitions(prev =>
                prev.filter(item => item.id !== competition.id)
            );

        } catch (error) {

            console.error(
                "Error deleting competition:",
                error
            );

            alert(
                `Unable to delete competition.\n\n${error.message}`
            );

        } finally {

            setSaving(false);

        }

    };


    /*
     * Search
     */
    const filteredCompetitions =
        competitions.filter(competition => {

            const searchText =
                search.trim().toLowerCase();


            if (!searchText) {

                return true;

            }


            return (

                competition.name
                    ?.toLowerCase()
                    .includes(searchText)

                ||

                competition.public_code
                    ?.toLowerCase()
                    .includes(searchText)

            );

        });


    /*
     * Format label
     */
    const formatLabel = (format) => {

        const labels = {

            singles: "Singles",
            pairs: "Pairs",
            trips: "Trips",
            fours: "Fours"

        };

        return labels[format] || format;

    };


    /*
     * Structure label
     */
    const structureLabel = (structure) => {

        const labels = {

            sectional: "Sectional",
            round_robin: "Sectional",
            knockout: "Knockout"

        };

        return labels[structure] || structure;

    };


    /*
     * Status badge
     */
    const statusBadge = (status) => {

        const badges = {

            draft: {
                className: "bg-secondary",
                label: "Draft"
            },

            registration: {
                className: "bg-info text-dark",
                label: "Registration"
            },

            draw_generated: {
                className: "bg-primary",
                label: "Draw Confirmed"
            },

            in_progress: {
                className: "bg-warning text-dark",
                label: "In Progress"
            },

            completed: {
                className: "bg-success",
                label: "Completed"
            },

            cancelled: {
                className: "bg-danger",
                label: "Cancelled"
            }

        };


        const badge =
            badges[status] || badges.draft;


        return (

            <span
                className={`badge ${badge.className}`}
            >

                {badge.label}

            </span>

        );

    };


    return (

        <div className="container-fluid py-4">

            {/* Header */}

            <div className="d-flex justify-content-between align-items-center mb-4">

                <div>

                    <h1 className="mb-1">
                        Competitions
                    </h1>

                    <p className="text-muted mb-0">
                        Create and manage BowlPoint competitions.
                    </p>

                </div>


                <button
                    type="button"
                    className="btn btn-primary"
                    onClick={handleAddCompetition}
                >

                    <i className="bi bi-plus-lg me-2"></i>

                    Create Competition

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
                            placeholder="Search competitions..."
                            value={search}
                            onChange={(e) =>
                                setSearch(e.target.value)
                            }
                        />

                    </div>

                </div>

            </div>


            {/* Competition form */}

            {showForm && (

                <div className="card shadow-sm border-0 mb-4">

                    <div className="card-header bg-white">

                        <h5 className="mb-0">

                            <i className="bi bi-trophy-fill me-2 text-warning"></i>

                            {editingCompetition
                                ? "Edit Competition"
                                : "Create Competition"
                            }

                        </h5>

                    </div>


                    <form onSubmit={handleSave}>

                        <div className="card-body">

                            {/* Details */}

                            <h6 className="text-primary mb-3">
                                Competition Details
                            </h6>

                            <div className="row g-3 mb-4">

                                <div className="col-12">

                                    <label className="form-label">
                                        Competition Name
                                    </label>

                                    <input
                                        type="text"
                                        name="name"
                                        className="form-control"
                                        placeholder="e.g. Midweek Mixed Fours"
                                        value={form.name}
                                        onChange={handleChange}
                                        required
                                    />

                                </div>

                            </div>


                            {/* Format */}

                            <h6 className="text-primary mb-3">
                                Competition Format
                            </h6>

                            <div className="row g-3 mb-4">

                                <div className="col-md-6">

                                    <label className="form-label">
                                        Team Format
                                    </label>

                                    <select
                                        name="format"
                                        className="form-select"
                                        value={form.format}
                                        onChange={handleChange}
                                    >

                                        <option value="singles">
                                            Singles
                                        </option>

                                        <option value="pairs">
                                            Pairs
                                        </option>

                                        <option value="trips">
                                            Trips
                                        </option>

                                        <option value="fours">
                                            Fours
                                        </option>

                                    </select>

                                </div>


                                <div className="col-md-6">

                                    <label className="form-label">
                                        Competition Structure
                                    </label>

                                    <select
                                        name="structure"
                                        className="form-select"
                                        value={form.structure}
                                        onChange={handleChange}
                                    >

                                        <option value="sectional">
                                            Sectional
                                        </option>

                                        <option value="knockout">
                                            Knockout
                                        </option>

                                    </select>

                                </div>

                            </div>


                            {/* Section settings */}

                            {form.structure !== "knockout" && (
                                <>
                                    <h6 className="text-primary mb-3">
                                        Sections / Groups
                                    </h6>

                                    <div className="row g-3 mb-3">
                                        <div className="col-md-6">
                                            <label className="form-label">
                                                Sectioning
                                            </label>
                                            <select
                                                name="section_mode"
                                                className="form-select"
                                                value={form.section_mode}
                                                onChange={handleChange}
                                            >
                                                <option value="none">
                                                    One section — all teams together
                                                </option>
                                                <option value="multiple">
                                                    Multiple sections
                                                </option>
                                            </select>
                                            <div className="form-text">
                                                {form.section_mode === "multiple"
                                                    ? "Teams are divided into sections and play a round-robin within their section."
                                                    : "Every participant plays in the same competition pool. Teams play a round-robin within the section."}
                                            </div>
                                        </div>
                                    </div>

                                    {form.section_mode === "multiple" && (
                                    <>
                                    <h6 className="text-primary mb-3">
                                        Section Settings
                                    </h6>

                                    <div className="row g-3 mb-4">

                                        <div className="col-md-6">

                                            <label className="form-label">
                                                Minimum Teams per Section
                                            </label>

                                            <input
                                                type="number"
                                                name="min_teams_per_section"
                                                className="form-control"
                                                min="3"
                                                max="6"
                                                value={form.min_teams_per_section}
                                                onChange={handleChange}
                                            />

                                        </div>


                                        <div className="col-md-6">

                                            <label className="form-label">
                                                Maximum Teams per Section
                                            </label>

                                            <input
                                                type="number"
                                                name="max_teams_per_section"
                                                className="form-control"
                                                min="3"
                                                max="6"
                                                value={form.max_teams_per_section}
                                                onChange={handleChange}
                                            />

                                        </div>


                                    </div>
                                    </>
                                    )}

                                </>

                            )}


                            {/* Scheduling */}

                            <h6 className="text-primary mb-3">
                                Scheduling
                            </h6>

                            <div className="row g-3 mb-4">

                                <div className="col-md-6">

                                    <label className="form-label">
                                        Schedule Type
                                    </label>

                                    <select
                                        name="schedule_type"
                                        className="form-select"
                                        value={form.schedule_type}
                                        onChange={handleChange}
                                    >

                                        <option value="midweek">
                                            Midweek – One Day — 1 round per playing day
                                        </option>

                                        <option value="weekday">
                                            Weekday — up to 3 rounds per playing day (Monday–Friday)
                                        </option>

                                        <option value="weekend">
                                            Weekend — up to 3 rounds per playing day (Saturday/Sunday)
                                        </option>

                                    </select>

                                </div>

                            </div>


                            {/* Scoring */}

                            <h6 className="text-primary mb-3">
                                Match Scoring
                            </h6>

                            <div className="row g-3">

                                <div className="col-md-4">

                                    <label className="form-label">
                                        Win Points
                                    </label>

                                    <input
                                        type="number"
                                        name="win_points"
                                        className="form-control"
                                        min="0"
                                        value={form.win_points}
                                        onChange={handleChange}
                                    />

                                </div>


                                <div className="col-md-4">

                                    <label className="form-label">
                                        Draw Points
                                    </label>

                                    <input
                                        type="number"
                                        name="draw_points"
                                        className="form-control"
                                        min="0"
                                        value={form.draw_points}
                                        onChange={handleChange}
                                    />

                                </div>


                                <div className="col-md-4">

                                    <label className="form-label">
                                        Loss Points
                                    </label>

                                    <input
                                        type="number"
                                        name="loss_points"
                                        className="form-control"
                                        min="0"
                                        value={form.loss_points}
                                        onChange={handleChange}
                                    />

                                </div>

                            </div>

                            <hr className="my-4" />

                            <div className="form-check form-switch mb-3">
                                <input
                                    className="form-check-input"
                                    type="checkbox"
                                    id="enableCompetitionSkins"
                                    name="skins_enabled"
                                    checked={Boolean(form.skins_enabled)}
                                    onChange={e => setForm(prev => ({ ...prev, skins_enabled: e.target.checked }))}
                                />
                                <label className="form-check-label fw-semibold" htmlFor="enableCompetitionSkins">
                                    Enable Skins Competition
                                </label>
                            </div>

                            {form.skins_enabled && (
                                <div className="row">
                                    <div className="col-md-4">
                                        <label className="form-label fw-semibold">Points Per Skin</label>
                                        <input
                                            type="number"
                                            name="points_per_skin"
                                            min="1"
                                            step="1"
                                            className="form-control"
                                            value={form.points_per_skin}
                                            onChange={handleChange}
                                        />
                                    </div>
                                </div>
                            )}

                        </div>


                        <div className="card-footer bg-white d-flex justify-content-end gap-2">

                            <button
                                type="button"
                                className="btn btn-outline-secondary"
                                disabled={saving}
                                onClick={() => {

                                    setShowForm(false);

                                    resetForm();

                                }}
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

                                        {editingCompetition
                                            ? "Save Changes"
                                            : "Create Competition"
                                        }
                                    </>

                                )}

                            </button>

                        </div>

                    </form>

                </div>

            )}


            {/* Competition list */}

            <div className="card shadow-sm border-0">

                <div className="card-header bg-white d-flex justify-content-between align-items-center">

                    <h5 className="mb-0">

                        <i className="bi bi-trophy me-2"></i>

                        Competitions

                    </h5>

                    <span className="badge bg-primary">
                        {filteredCompetitions.length}
                    </span>

                </div>


                <div className="card-body p-0">

                    {loading ? (

                        <div className="text-center py-5">

                            <div
                                className="spinner-border text-primary"
                            ></div>

                            <div className="text-muted mt-2">
                                Loading competitions...
                            </div>

                        </div>

                    ) : filteredCompetitions.length === 0 ? (

                        <div className="text-center py-5">

                            <i
                                className="bi bi-trophy display-4 text-muted"
                            ></i>

                            <h5 className="mt-3">
                                No competitions yet
                            </h5>

                            <p className="text-muted mb-0">
                                Create your first competition to get started.
                            </p>

                        </div>

                    ) : (

                        <div className="table-responsive">

                            <table className="table table-hover mb-0">

                                <thead>

                                    <tr>

                                        <th>
                                            Competition
                                        </th>

                                        <th>
                                            Format
                                        </th>

                                        <th>
                                            Structure
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

                                    {filteredCompetitions.map(
                                        competition => (

                                            <tr
                                                key={competition.id}
                                            >

                                                <td>

                                                    <strong>
                                                        {competition.name}
                                                    </strong>

                                                    {competition.public_code && (

                                                        <div className="small text-muted">
                                                            Code:{" "}
                                                            {competition.public_code}
                                                        </div>

                                                    )}

                                                </td>


                                                <td>
                                                    {formatLabel(
                                                        competition.format
                                                    )}
                                                </td>


                                                <td>
                                                    {structureLabel(
                                                        competition.structure
                                                    )}
                                                </td>


                                                <td>
                                                    {statusBadge(
                                                        competition.status
                                                    )}
                                                </td>


                                                <td className="text-end">

                                                    <div className="d-flex justify-content-end gap-2">

                                                        <Link
                                                            to={`/competitions/${competition.id}`}
                                                            className="btn btn-sm btn-primary"
                                                        >
                                                            <i className="bi bi-folder2-open me-1"></i>
                                                            Open
                                                        </Link>

                                                        <button
                                                            type="button"
                                                            className="btn btn-sm btn-outline-primary"
                                                            onClick={() =>
                                                                handleEditCompetition(
                                                                    competition
                                                                )
                                                            }
                                                        >
                                                            <i className="bi bi-pencil me-1"></i>
                                                            Edit
                                                        </button>

                                                        {isAdmin && (

                                                            <button
                                                                type="button"
                                                                className="btn btn-sm btn-outline-danger"
                                                                onClick={() =>
                                                                    handleDeleteCompetition(
                                                                        competition
                                                                    )
                                                                }
                                                                disabled={saving}
                                                                title="Delete competition"
                                                            >
                                                                <i className="bi bi-trash me-1"></i>
                                                                Delete
                                                            </button>

                                                        )}

                                                    </div>

                                                </td>

                                            </tr>

                                        )
                                    )}

                                </tbody>

                            </table>

                        </div>

                    )}

                </div>

            </div>

        </div>

    );

}

export default Competitions;