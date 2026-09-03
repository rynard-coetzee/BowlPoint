import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

function Clubs() {

    const [clubs, setClubs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [search, setSearch] = useState("");

    const [showForm, setShowForm] = useState(false);

    const [editingClub, setEditingClub] = useState(null);

    const [form, setForm] = useState({
        name: "",
        short_name: "",
        contact_name: "",
        contact_email: "",
        contact_phone: "",
        active: true
    });


    /*
     * Load clubs
     */
    const loadClubs = async () => {

        setLoading(true);

        const { data, error } = await supabase
            .from("clubs")
            .select("*")
            .order("name");

        if (error) {

            console.error("Error loading clubs:", error);

            alert(
                `Unable to load clubs.\n\n${error.message}`
            );

            setLoading(false);

            return;
        }

        setClubs(data || []);

        setLoading(false);
    };


    useEffect(() => {

        loadClubs();

    }, []);


    /*
     * Reset form
     */
    const resetForm = () => {

        setForm({
            name: "",
            short_name: "",
            contact_name: "",
            contact_email: "",
            contact_phone: "",
            active: true
        });

        setEditingClub(null);

    };


    /*
     * Open Add form
     */
    const handleAddClub = () => {

        resetForm();

        setShowForm(true);

    };


    /*
     * Open Edit form
     */
    const handleEditClub = (club) => {

        setEditingClub(club);

        setForm({
            name: club.name || "",
            short_name: club.short_name || "",
            contact_name: club.contact_name || "",
            contact_email: club.contact_email || "",
            contact_phone: club.contact_phone || "",
            active: club.active ?? true
        });

        setShowForm(true);

    };


    /*
     * Form change
     */
    const handleChange = (e) => {

        const { name, value, type, checked } = e.target;

        setForm(prev => ({
            ...prev,
            [name]:
                type === "checkbox"
                    ? checked
                    : value
        }));

    };


    /*
     * Save club
     */
    const handleSave = async (e) => {

        e.preventDefault();

        if (!form.name.trim()) {

            alert("Please enter a club name.");

            return;

        }


        setSaving(true);


        const payload = {
            name: form.name.trim(),
            short_name: form.short_name.trim() || null,
            contact_name: form.contact_name.trim() || null,
            contact_email: form.contact_email.trim() || null,
            contact_phone: form.contact_phone.trim() || null,
            active: form.active
        };


        let error;


        if (editingClub) {

            const result = await supabase
                .from("clubs")
                .update(payload)
                .eq("id", editingClub.id);

            error = result.error;

        } else {

            const result = await supabase
                .from("clubs")
                .insert(payload);

            error = result.error;

        }


        setSaving(false);


        if (error) {

            console.error("Error saving club:", error);

            alert(
                `Unable to save club.\n\n${error.message}`
            );

            return;

        }


        setShowForm(false);

        resetForm();

        await loadClubs();

    };


    /*
     * Filter clubs
     */
    const filteredClubs = clubs.filter(club => {

        const searchText =
            search.trim().toLowerCase();

        if (!searchText) {
            return true;
        }

        return (
            club.name
                ?.toLowerCase()
                .includes(searchText) ||

            club.short_name
                ?.toLowerCase()
                .includes(searchText) ||

            club.contact_name
                ?.toLowerCase()
                .includes(searchText)
        );

    });


    return (

        <div className="container-fluid py-4">

            {/* Header */}

            <div className="d-flex justify-content-between align-items-center mb-4">

                <div>

                    <h1 className="mb-1">
                        Clubs
                    </h1>

                    <p className="text-muted mb-0">
                        Manage the clubs registered with BowlPoint.
                    </p>

                </div>


                <button
                    type="button"
                    className="btn btn-primary"
                    onClick={handleAddClub}
                >

                    <i className="bi bi-plus-lg me-2"></i>

                    Add Club

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
                            placeholder="Search clubs..."
                            value={search}
                            onChange={(e) =>
                                setSearch(e.target.value)
                            }
                        />

                    </div>

                </div>

            </div>


            {/* Club form */}

            {showForm && (

                <div className="card shadow-sm border-0 mb-4">

                    <div className="card-header bg-white">

                        <h5 className="mb-0">

                            <i className="bi bi-building me-2"></i>

                            {editingClub
                                ? "Edit Club"
                                : "Add Club"
                            }

                        </h5>

                    </div>


                    <form onSubmit={handleSave}>

                        <div className="card-body">

                            <div className="row g-3">

                                <div className="col-md-8">

                                    <label className="form-label">
                                        Club Name
                                    </label>

                                    <input
                                        type="text"
                                        name="name"
                                        className="form-control"
                                        value={form.name}
                                        onChange={handleChange}
                                        placeholder="Enter club name"
                                        required
                                    />

                                </div>


                                <div className="col-md-4">

                                    <label className="form-label">
                                        Short Name
                                    </label>

                                    <input
                                        type="text"
                                        name="short_name"
                                        className="form-control"
                                        value={form.short_name}
                                        onChange={handleChange}
                                        placeholder="Optional"
                                    />

                                </div>


                                <div className="col-md-6">

                                    <label className="form-label">
                                        Contact Name
                                    </label>

                                    <input
                                        type="text"
                                        name="contact_name"
                                        className="form-control"
                                        value={form.contact_name}
                                        onChange={handleChange}
                                        placeholder="Optional"
                                    />

                                </div>


                                <div className="col-md-6">

                                    <label className="form-label">
                                        Contact Email
                                    </label>

                                    <input
                                        type="email"
                                        name="contact_email"
                                        className="form-control"
                                        value={form.contact_email}
                                        onChange={handleChange}
                                        placeholder="Optional"
                                    />

                                </div>


                                <div className="col-md-6">

                                    <label className="form-label">
                                        Contact Phone
                                    </label>

                                    <input
                                        type="text"
                                        name="contact_phone"
                                        className="form-control"
                                        value={form.contact_phone}
                                        onChange={handleChange}
                                        placeholder="Optional"
                                    />

                                </div>


                                <div className="col-md-6 d-flex align-items-end">

                                    <div className="form-check mb-2">

                                        <input
                                            type="checkbox"
                                            className="form-check-input"
                                            id="clubActive"
                                            name="active"
                                            checked={form.active}
                                            onChange={handleChange}
                                        />

                                        <label
                                            className="form-check-label"
                                            htmlFor="clubActive"
                                        >
                                            Active club
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

                                        {editingClub
                                            ? "Save Changes"
                                            : "Save Club"
                                        }

                                    </>

                                )}

                            </button>

                        </div>

                    </form>

                </div>

            )}


            {/* Clubs */}

            <div className="card shadow-sm border-0">

                <div className="card-header bg-white d-flex justify-content-between align-items-center">

                    <h5 className="mb-0">

                        <i className="bi bi-buildings me-2"></i>

                        Registered Clubs

                    </h5>

                    <span className="badge bg-primary">
                        {filteredClubs.length}
                    </span>

                </div>


                <div className="card-body p-0">

                    {loading ? (

                        <div className="text-center py-5">

                            <div
                                className="spinner-border text-primary"
                            ></div>

                            <div className="text-muted mt-2">
                                Loading clubs...
                            </div>

                        </div>

                    ) : filteredClubs.length === 0 ? (

                        <div className="text-center py-5">

                            <i
                                className="bi bi-building display-4 text-muted"
                            ></i>

                            <h5 className="mt-3">
                                No clubs found
                            </h5>

                            <p className="text-muted mb-0">

                                {search
                                    ? "Try changing your search."
                                    : "Add your first club to get started."
                                }

                            </p>

                        </div>

                    ) : (

                        <div className="table-responsive">

                            <table className="table table-hover mb-0">

                                <thead>

                                    <tr>

                                        <th>
                                            Club
                                        </th>

                                        <th>
                                            Short Name
                                        </th>

                                        <th>
                                            Contact
                                        </th>

                                        <th>
                                            Phone
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

                                    {filteredClubs.map(club => (

                                        <tr key={club.id}>

                                            <td>

                                                <strong>
                                                    {club.name}
                                                </strong>

                                            </td>


                                            <td>
                                                {club.short_name || "—"}
                                            </td>


                                            <td>

                                                {club.contact_name || "—"}

                                                {club.contact_email && (

                                                    <div className="small text-muted">
                                                        {club.contact_email}
                                                    </div>

                                                )}

                                            </td>


                                            <td>
                                                {club.contact_phone || "—"}
                                            </td>


                                            <td>

                                                {club.active ? (

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
                                                        handleEditClub(club)
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

export default Clubs;