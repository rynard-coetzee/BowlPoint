import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

const emptyGreen = { name: "", rink_count: 6, active: true, allows_direction_change: true };
const greenPrefix = (name) => {
  const match = String(name || "").trim().match(/(?:green\s*)?([a-z])$/i);
  return match ? match[1].toUpperCase() : "A";
};

export default function Facilities() {
  const [clubs, setClubs] = useState([]);
  const [greens, setGreens] = useState([]);
  const [rinks, setRinks] = useState([]);
  const [selectedClubId, setSelectedClubId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [showGreenForm, setShowGreenForm] = useState(false);
  const [editingGreen, setEditingGreen] = useState(null);
  const [greenForm, setGreenForm] = useState(emptyGreen);

  const loadClubs = useCallback(async () => {
    setLoading(true); setError("");
    const { data, error: loadError } = await supabase.from("clubs").select("id,name,short_name,active").order("name");
    if (loadError) { setError(`Unable to load clubs: ${loadError.message}`); setLoading(false); return; }
    const activeClubs = (data || []).filter(c => c.active !== false);
    setClubs(activeClubs);
    setSelectedClubId(current => current && activeClubs.some(c => c.id === current) ? current : (activeClubs[0]?.id || ""));
    setLoading(false);
  }, []);

  const loadFacilities = useCallback(async () => {
    if (!selectedClubId) { setGreens([]); setRinks([]); return; }
    setError("");
    const { data: greenData, error: greenError } = await supabase.from("club_greens").select("*").eq("club_id", selectedClubId).order("name");
    if (greenError) { setError(`Unable to load greens. Run the facility migration first. ${greenError.message}`); setGreens([]); setRinks([]); return; }
    const greenRows = greenData || [];
    setGreens(greenRows);
    if (!greenRows.length) { setRinks([]); return; }
    const { data: rinkData, error: rinkError } = await supabase.from("green_rinks").select("*").in("green_id", greenRows.map(g => g.id)).order("label");
    if (rinkError) { setError(`Unable to load rinks: ${rinkError.message}`); setRinks([]); return; }
    setRinks(rinkData || []);
  }, [selectedClubId]);

  useEffect(() => { loadClubs(); }, [loadClubs]);
  useEffect(() => { loadFacilities(); }, [loadFacilities]);

  const selectedClub = useMemo(() => clubs.find(c => c.id === selectedClubId), [clubs, selectedClubId]);
  const rinksByGreen = useMemo(() => rinks.reduce((acc, rink) => { (acc[rink.green_id] ||= []).push(rink); return acc; }, {}), [rinks]);

  const startAddGreen = () => { setEditingGreen(null); setGreenForm({ ...emptyGreen, name: `Green ${String.fromCharCode(65 + greens.length)}` }); setShowGreenForm(true); setNotice(""); };
  const startEditGreen = (green) => { setEditingGreen(green); setGreenForm({ name: green.name, rink_count: (rinksByGreen[green.id] || []).length, active: green.active, allows_direction_change: green.allows_direction_change }); setShowGreenForm(true); setNotice(""); };

  const saveGreen = async (event) => {
    event.preventDefault();
    const count = Number(greenForm.rink_count);
    if (!selectedClubId || !greenForm.name.trim()) { setError("Select a club and enter a green name."); return; }
    if (!Number.isInteger(count) || count < 1 || count > 12) { setError("Each green must have between 1 and 12 rinks."); return; }
    setSaving(true); setError(""); setNotice("");
    const payload = { club_id: selectedClubId, name: greenForm.name.trim(), active: greenForm.active, allows_direction_change: greenForm.allows_direction_change };
    let greenId = editingGreen?.id;
    let result;
    if (editingGreen) result = await supabase.from("club_greens").update(payload).eq("id", greenId).select("id").single();
    else result = await supabase.from("club_greens").insert(payload).select("id").single();
    if (result.error) { setError(`Unable to save green: ${result.error.message}`); setSaving(false); return; }
    greenId = result.data.id;
    const currentRinks = rinksByGreen[greenId] || [];
    const prefix = greenPrefix(greenForm.name);
    // Use familiar labels such as A1-A6 for Green A and B1-B6 for Green B.
    // Existing labels are retained rather than renamed, preserving any future booking references.
    const inserts = [];
    for (let i = 1; i <= count; i++) {
      const label = `${prefix}${i}`;
      if (!currentRinks.some(r => r.label === label)) inserts.push({ green_id: greenId, label, active: true });
    }
    if (inserts.length) {
      const { error: rinkCreateError } = await supabase.from("green_rinks").insert(inserts);
      if (rinkCreateError) { setError(`Green saved, but some rinks could not be created: ${rinkCreateError.message}`); setSaving(false); await loadFacilities(); return; }
    }
    // Rink count reduction is intentionally non-destructive; deactivate higher-numbered rinks instead.
    const toDeactivate = currentRinks.filter(r => r.label.startsWith(prefix) && Number((r.label.match(/(\d+)$/) || [])[1]) > count && r.active);
    const toActivate = currentRinks.filter(r => r.label.startsWith(prefix) && Number((r.label.match(/(\d+)$/) || [])[1]) <= count && !r.active);
    for (const rink of toDeactivate) {
      const { error: deactivateError } = await supabase.from("green_rinks").update({ active: false }).eq("id", rink.id);
      if (deactivateError) { setError(`Green saved, but a rink could not be deactivated: ${deactivateError.message}`); setSaving(false); await loadFacilities(); return; }
    }
    for (const rink of toActivate) {
      const { error: activateError } = await supabase.from("green_rinks").update({ active: true }).eq("id", rink.id);
      if (activateError) { setError(`Green saved, but a rink could not be activated: ${activateError.message}`); setSaving(false); await loadFacilities(); return; }
    }
    setSaving(false); setShowGreenForm(false); setEditingGreen(null); setNotice("Green and rink configuration saved."); await loadFacilities();
  };

  const toggleRink = async (rink) => {
    setError(""); setNotice("");
    const { error: updateError } = await supabase.from("green_rinks").update({ active: !rink.active }).eq("id", rink.id);
    if (updateError) { setError(`Unable to update rink: ${updateError.message}`); return; }
    setRinks(current => current.map(r => r.id === rink.id ? { ...r, active: !r.active } : r));
  };

  const toggleGreen = async (green) => {
    setError(""); setNotice("");
    const { error: updateError } = await supabase.from("club_greens").update({ active: !green.active }).eq("id", green.id);
    if (updateError) { setError(`Unable to update green: ${updateError.message}`); return; }
    setGreens(current => current.map(g => g.id === green.id ? { ...g, active: !g.active } : g));
  };

  return <div className="container-fluid py-4">
    <div className="d-flex flex-wrap justify-content-between align-items-start gap-3 mb-4">
      <div><h1 className="mb-1">Club Facilities</h1><p className="text-muted mb-0">Configure greens, rinks and direction-change capability for shared competition scheduling.</p></div>
      <button className="btn btn-primary" onClick={startAddGreen} disabled={!selectedClubId}><i className="bi bi-plus-lg me-2" />Add Green</button>
    </div>
    {error && <div className="alert alert-danger" role="alert">{error}</div>}
    {notice && <div className="alert alert-success" role="status">{notice}</div>}
    <div className="card shadow-sm mb-4"><div className="card-body">
      <label className="form-label" htmlFor="facility-club">Club</label>
      <select id="facility-club" className="form-select" value={selectedClubId} onChange={e => { setSelectedClubId(e.target.value); setShowGreenForm(false); setNotice(""); }} disabled={loading || !clubs.length}>
        {!clubs.length && <option value="">No active clubs available</option>}
        {clubs.map(club => <option key={club.id} value={club.id}>{club.name}{club.short_name ? ` (${club.short_name})` : ""}</option>)}
      </select>
      {selectedClub && <div className="form-text">Facilities configured for {selectedClub.name}. Changes here are shared by all competitions.</div>}
    </div></div>

    {showGreenForm && <div className="card shadow-sm mb-4"><div className="card-header bg-white"><h2 className="h5 mb-0">{editingGreen ? "Edit Green" : "Add Green"}</h2></div><div className="card-body">
      <form onSubmit={saveGreen}>
        <div className="row g-3">
          <div className="col-md-5"><label className="form-label" htmlFor="green-name">Green name</label><input id="green-name" className="form-control" value={greenForm.name} onChange={e => setGreenForm(f => ({ ...f, name: e.target.value }))} required maxLength={80} placeholder="e.g. Green A" /></div>
          <div className="col-md-3"><label className="form-label" htmlFor="rink-count">Number of rinks</label><input id="rink-count" type="number" min="1" max="12" className="form-control" value={greenForm.rink_count} onChange={e => setGreenForm(f => ({ ...f, rink_count: e.target.value }))} required /><div className="form-text">1–12; six is the usual default.</div></div>
          <div className="col-md-4 d-flex flex-column justify-content-center gap-2"><div className="form-check"><input id="direction-change" className="form-check-input" type="checkbox" checked={greenForm.allows_direction_change} onChange={e => setGreenForm(f => ({ ...f, allows_direction_change: e.target.checked }))} /><label className="form-check-label" htmlFor="direction-change">Can be played in a second (perpendicular) direction</label></div><div className="form-check"><input id="green-active" className="form-check-input" type="checkbox" checked={greenForm.active} onChange={e => setGreenForm(f => ({ ...f, active: e.target.checked }))} /><label className="form-check-label" htmlFor="green-active">Green available for scheduling</label></div></div>
        </div>
        <div className="d-flex justify-content-end gap-2 mt-4"><button type="button" className="btn btn-outline-secondary" onClick={() => setShowGreenForm(false)} disabled={saving}>Cancel</button><button type="submit" className="btn btn-primary" disabled={saving}>{saving ? "Saving…" : "Save Green"}</button></div>
      </form>
    </div></div>}

    {loading ? <div className="text-muted py-4">Loading clubs…</div> : !selectedClubId ? <div className="alert alert-info">Add an active club first, then configure its greens here.</div> : greens.length === 0 ? <div className="card"><div className="card-body text-center py-5"><i className="bi bi-grid-3x3-gap display-5 text-muted"/><h2 className="h5 mt-3">No greens configured</h2><p className="text-muted">Add the first green for {selectedClub?.name}. You can configure one or more greens and their rink labels.</p><button className="btn btn-primary" onClick={startAddGreen}>Add Green</button></div></div> : <div className="row g-3">
      {greens.map(green => <div className="col-12 col-xl-6" key={green.id}><div className="card h-100 shadow-sm"><div className="card-header bg-white d-flex justify-content-between align-items-center gap-2"><div><h2 className="h5 mb-1">{green.name}</h2><div className="small text-muted">{(rinksByGreen[green.id] || []).filter(r => r.active).length} active rinks · {green.allows_direction_change ? "Perpendicular direction enabled" : "Single direction only"}</div></div><span className={`badge ${green.active ? "text-bg-success" : "text-bg-secondary"}`}>{green.active ? "Available" : "Unavailable"}</span></div><div className="card-body"><div className="d-flex flex-wrap gap-2">
        {(rinksByGreen[green.id] || []).map(rink => <button type="button" key={rink.id} onClick={() => toggleRink(rink)} className={`btn btn-sm ${rink.active ? "btn-outline-primary" : "btn-outline-secondary"}`} title={rink.active ? "Click to mark this rink unavailable" : "Click to make this rink available"}><i className={`bi ${rink.active ? "bi-check-circle" : "bi-slash-circle"} me-1`}/>Rink {rink.label}{!rink.active ? " · Off" : ""}</button>)}
      </div><div className="form-text mt-2">Select a rink to toggle its availability. Existing rink records are retained so booking history can remain intact.</div></div><div className="card-footer bg-white d-flex justify-content-end gap-2"><button className="btn btn-sm btn-outline-secondary" onClick={() => toggleGreen(green)}>{green.active ? "Mark green unavailable" : "Make green available"}</button><button className="btn btn-sm btn-outline-primary" onClick={() => startEditGreen(green)}>Edit configuration</button></div></div></div>)}
    </div>}
    <div className="alert alert-info mt-4 mb-0"><strong>Scheduling foundation:</strong> This stage configures facility data. Automatic match allocation and the shared calendar will be connected in the next stage. Direction 2 is modelled as a perpendicular layout on the same green, not as a separate physical green.</div>
  </div>;
}
