import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";

export default function FacilityCalendar() {
  const navigate = useNavigate();
  const [bookings, setBookings] = useState([]);
  const [clubs, setClubs] = useState([]);
  const [competitions, setCompetitions] = useState({});
  const [date, setDate] = useState(new Date().toLocaleDateString("en-CA"));
  const [clubId, setClubId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const [bookingRes, clubRes] = await Promise.all([
        supabase.from("facility_bookings").select("id,competition_id,match_id,playing_date,session_name,starts_at,ends_at,direction,status,green_id,rink_id,green_rinks(label),club_greens(id,name,club_id,clubs(id,name,short_name))").neq("status", "cancelled").order("starts_at"),
        supabase.from("clubs").select("id,name,short_name,active").order("name")
      ]);
      if (bookingRes.error) throw bookingRes.error;
      if (clubRes.error) throw clubRes.error;
      const rows = bookingRes.data || [];
      setBookings(rows); setClubs((clubRes.data || []).filter(c => c.active !== false));
      const ids = [...new Set(rows.map(b => b.competition_id).filter(Boolean))];
      if (ids.length) {
        const { data, error: compError } = await supabase.from("competitions").select("id,name").in("id", ids);
        if (!compError) setCompetitions(Object.fromEntries((data || []).map(c => [c.id, c.name || c.title || "Competition"])));
      }
    } catch (e) { setError(`Unable to load shared facility calendar: ${e.message}`); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);
  const filtered = useMemo(() => bookings.filter(b => (!date || b.playing_date === date) && (!clubId || b.club_greens?.club_id === clubId)).sort((a,b) => String(a.starts_at).localeCompare(String(b.starts_at))), [bookings,date,clubId]);
  return <div className="container-fluid py-4">
    <div className="d-flex flex-wrap justify-content-between align-items-start gap-3 mb-4"><div><h1 className="mb-1">Shared Facility Calendar</h1><p className="text-muted mb-0">All rink bookings across BowlPoint competitions, including men's and ladies' events.</p></div><button className="btn btn-outline-secondary" onClick={() => navigate("/facilities")}>Manage Facilities</button></div>
    {error && <div className="alert alert-danger">{error}</div>}
    <div className="card border-0 shadow-sm mb-4"><div className="card-body"><div className="row g-3"><div className="col-md-4"><label className="form-label">Playing date</label><input type="date" className="form-control" value={date} onChange={e => setDate(e.target.value)}/></div><div className="col-md-5"><label className="form-label">Club</label><select className="form-select" value={clubId} onChange={e => setClubId(e.target.value)}><option value="">All clubs</option>{clubs.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div><div className="col-md-3 d-flex align-items-end"><button className="btn btn-outline-primary w-100" onClick={load}>Refresh calendar</button></div></div></div></div>
    <div className="card border-0 shadow-sm"><div className="card-header bg-white d-flex justify-content-between align-items-center"><h5 className="mb-0">Facility Bookings</h5><span className="badge bg-primary">{filtered.length} booking(s)</span></div>
      {loading ? <div className="p-4 text-muted">Loading bookings…</div> : <div className="table-responsive"><table className="table table-hover align-middle mb-0"><thead><tr><th>Date</th><th>Time / Session</th><th>Club</th><th>Green / Rink</th><th>Direction</th><th>Competition</th><th>Status</th></tr></thead><tbody>{filtered.map(b => <tr key={b.id}><td>{b.playing_date}</td><td><div>{new Date(b.starts_at).toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"})}–{new Date(b.ends_at).toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"})}</div><div className="small text-muted">{b.session_name}</div></td><td>{b.club_greens?.clubs?.name || "Club"}</td><td>{b.club_greens?.name || "Green"} / {b.green_rinks?.label || "Rink"}</td><td>{Number(b.direction) === 2 ? "Direction 2 — across green" : "Direction 1 — lengthwise"}</td><td>{competitions[b.competition_id] || "Competition"}</td><td><span className={`badge ${b.status === "confirmed" ? "bg-success" : "bg-secondary"}`}>{b.status}</span></td></tr>)}</tbody></table>{!filtered.length && <div className="p-4 text-muted">No facility bookings match the selected filters.</div>}</div>}
    </div>
  </div>;
}
