import { useCallback, useEffect, useState } from "react";
import { getAuditLogs } from "../../services/auditService";
import { useAuth } from "../../context/AuthContext";
import "./AuditLogs.css";

const PAGE_SIZE = 100;
const ACTIONS = [
    "INSERT", "UPDATE", "DELETE", "LOGIN", "LOGOUT", "DRAW_GENERATED", "WORKFLOW_ACTION"
];

function formatDate(value) {
    if (!value) return "—";
    return new Date(value).toLocaleString();
}

function downloadCsv(rows) {
    const headers = ["Date/time", "User", "Email", "Action", "Table", "Record ID", "Competition ID", "Summary"];
    const values = rows.map(row => [
        formatDate(row.occurred_at), row.actor_name || "Unknown", row.actor_email || "",
        row.action, row.table_name || "", row.record_id || "", row.competition_id || "", row.summary
    ]);
    const quote = value => `"${String(value ?? "").replace(/"/g, '""')}"`;
    const csv = [headers, ...values].map(line => line.map(quote).join(",")).join("\r\n");
    const blob = new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `bowlpoint-audit-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
}

export default function AuditLogs() {
    const { profile } = useAuth();
    const [rows, setRows] = useState([]);
    const [count, setCount] = useState(0);
    const [page, setPage] = useState(0);
    const [search, setSearch] = useState("");
    const [action, setAction] = useState("");
    const [from, setFrom] = useState("");
    const [to, setTo] = useState("");
    const [selected, setSelected] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const load = useCallback(async (nextPage = page) => {
        setLoading(true);
        setError("");
        try {
            const result = await getAuditLogs({
                search, action, from, to,
                limit: PAGE_SIZE,
                offset: nextPage * PAGE_SIZE
            });
            setRows(result.rows);
            setCount(result.count);
            setPage(nextPage);
        } catch (loadError) {
            console.error("Unable to load audit logs:", loadError);
            setError(loadError.message || "Unable to load audit logs.");
        } finally {
            setLoading(false);
        }
    }, [search, action, from, to, page]);

    const clearFilters = async () => {
        setSearch("");
        setAction("");
        setFrom("");
        setTo("");
        setLoading(true);
        setError("");
        try {
            const result = await getAuditLogs({ limit: PAGE_SIZE, offset: 0 });
            setRows(result.rows);
            setCount(result.count);
            setPage(0);
        } catch (loadError) {
            setError(loadError.message || "Unable to load audit logs.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(0); }, []); // Initial page only; filters are applied with the Search button.

    if (profile?.role !== "admin") return <div className="container-fluid py-4"><div className="alert alert-danger">Administrator access is required.</div></div>;

    return (
        <div className="container-fluid py-4">
            <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
                <div>
                    <h2 className="mb-1">Audit Log</h2>
                    <div className="text-muted">All recorded BowlPoint activity. Records are retained for one year.</div>
                </div>
                <button className="btn btn-outline-primary" type="button" onClick={() => downloadCsv(rows)} disabled={!rows.length}>
                    <i className="bi bi-download me-2" />Export current page
                </button>
            </div>

            <div className="card shadow-sm mb-3">
                <div className="card-body">
                    <div className="row g-2 align-items-end">
                        <div className="col-12 col-md-4">
                            <label className="form-label">Search</label>
                            <input className="form-control" value={search} onChange={e => setSearch(e.target.value)} placeholder="User, action, table or record ID" />
                        </div>
                        <div className="col-6 col-md-2">
                            <label className="form-label">Action</label>
                            <select className="form-select" value={action} onChange={e => setAction(e.target.value)}>
                                <option value="">All actions</option>
                                {ACTIONS.map(item => <option key={item} value={item}>{item.replaceAll("_", " ")}</option>)}
                            </select>
                        </div>
                        <div className="col-6 col-md-2">
                            <label className="form-label">From</label>
                            <input className="form-control" type="date" value={from} onChange={e => setFrom(e.target.value)} />
                        </div>
                        <div className="col-6 col-md-2">
                            <label className="form-label">To</label>
                            <input className="form-control" type="date" value={to} onChange={e => setTo(e.target.value)} />
                        </div>
                        <div className="col-6 col-md-2 d-flex gap-2">
                            <button className="btn btn-primary flex-grow-1" type="button" onClick={() => load(0)} disabled={loading}>Search</button>
                            <button className="btn btn-outline-secondary" type="button" title="Clear filters" onClick={clearFilters}>Clear</button>
                        </div>
                    </div>
                </div>
            </div>

            {error && <div className="alert alert-danger">{error}<div className="small mt-1">If the audit migration has not yet been applied in Supabase, apply the SQL migration included with this update.</div></div>}

            <div className="card shadow-sm">
                <div className="card-header bg-white d-flex justify-content-between align-items-center">
                    <strong>Activity</strong>
                    <span className="text-muted small">{count.toLocaleString()} records</span>
                </div>
                <div className="table-responsive">
                    <table className="table table-hover align-middle mb-0">
                        <thead className="table-light"><tr><th>Date / time</th><th>User</th><th>Action</th><th>Area</th><th>Details</th><th></th></tr></thead>
                        <tbody>
                            {loading ? <tr><td colSpan="6" className="text-center py-4">Loading audit history…</td></tr> : rows.length === 0 ? <tr><td colSpan="6" className="text-center text-muted py-4">No audit records found.</td></tr> : rows.map(row => (
                                <tr key={row.id}>
                                    <td className="text-nowrap">{formatDate(row.occurred_at)}</td>
                                    <td><div>{row.actor_name || "Unknown user"}</div><small className="text-muted">{row.actor_email || "System / service"}</small></td>
                                    <td><span className="badge text-bg-secondary">{row.action.replaceAll("_", " ")}</span></td>
                                    <td>{row.table_name || row.event_source || "Application"}</td>
                                    <td className="audit-summary">{row.summary}</td>
                                    <td><button className="btn btn-sm btn-outline-secondary" onClick={() => setSelected(row)}>Details</button></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <div className="card-footer bg-white d-flex justify-content-between align-items-center">
                    <small className="text-muted">Page {page + 1} of {Math.max(1, Math.ceil(count / PAGE_SIZE))}</small>
                    <div className="btn-group">
                        <button className="btn btn-sm btn-outline-secondary" disabled={loading || page === 0} onClick={() => load(page - 1)}>Previous</button>
                        <button className="btn btn-sm btn-outline-secondary" disabled={loading || (page + 1) * PAGE_SIZE >= count} onClick={() => load(page + 1)}>Next</button>
                    </div>
                </div>
            </div>

            {selected && (
                <div className="audit-modal-backdrop" role="presentation" onClick={() => setSelected(null)}>
                    <div className="audit-modal card shadow-lg" role="dialog" aria-modal="true" aria-labelledby="audit-detail-title" onClick={e => e.stopPropagation()}>
                        <div className="card-header d-flex justify-content-between align-items-center">
                            <strong id="audit-detail-title">Audit entry #{selected.id}</strong>
                            <button className="btn-close" aria-label="Close" onClick={() => setSelected(null)} />
                        </div>
                        <div className="card-body">
                            <dl className="row mb-3">
                                <dt className="col-sm-4">Date / time</dt><dd className="col-sm-8">{formatDate(selected.occurred_at)}</dd>
                                <dt className="col-sm-4">User</dt><dd className="col-sm-8">{selected.actor_name || "Unknown"} {selected.actor_email ? `(${selected.actor_email})` : ""}</dd>
                                <dt className="col-sm-4">Action</dt><dd className="col-sm-8">{selected.action}</dd>
                                <dt className="col-sm-4">Source</dt><dd className="col-sm-8">{selected.event_source}</dd>
                                <dt className="col-sm-4">Table / record</dt><dd className="col-sm-8">{selected.table_name || "—"} / {selected.record_id || "—"}</dd>
                                <dt className="col-sm-4">Competition ID</dt><dd className="col-sm-8">{selected.competition_id || "—"}</dd>
                                <dt className="col-sm-4">Summary</dt><dd className="col-sm-8">{selected.summary}</dd>
                            </dl>
                            <h6>Before</h6><pre className="audit-json">{selected.old_data ? JSON.stringify(selected.old_data, null, 2) : "—"}</pre>
                            <h6 className="mt-3">After</h6><pre className="audit-json">{selected.new_data ? JSON.stringify(selected.new_data, null, 2) : "—"}</pre>
                            {selected.metadata && Object.keys(selected.metadata).length > 0 && <><h6 className="mt-3">Additional details</h6><pre className="audit-json">{JSON.stringify(selected.metadata, null, 2)}</pre></>}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
