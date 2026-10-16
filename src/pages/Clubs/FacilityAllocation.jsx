import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";

// Four daily sessions. Each session can use all six physical rink labels on
// every green; Direction 2 maps those labels to the perpendicular crosswise lanes.
const SESSIONS = [
  { name: "Morning 1", start: "08:00:00", end: "10:00:00", direction: 1 },
  { name: "Morning 2", start: "10:15:00", end: "12:15:00", direction: 1 },
  { name: "Afternoon 1", start: "13:00:00", end: "15:00:00", direction: 2 },
  { name: "Afternoon 2", start: "15:15:00", end: "17:15:00", direction: 2 },
];
const localIso = (date, time) => new Date(`${date}T${time}+02:00`).toISOString();
const keyFor = (roundId, matchId) => `${roundId}:${matchId}`;
const overlaps = (aStart, aEnd, bStart, bEnd) => new Date(aStart) < new Date(bEnd) && new Date(bStart) < new Date(aEnd);

export default function FacilityAllocation() {
  const { competitionId } = useParams();
  const navigate = useNavigate();
  const [competition, setCompetition] = useState(null);
  const [rounds, setRounds] = useState([]);
  const [matches, setMatches] = useState([]);
  const [competitionTeams, setCompetitionTeams] = useState([]);
  const [sections, setSections] = useState([]);
  const [sectionVenueIds, setSectionVenueIds] = useState({});
  const [greens, setGreens] = useState([]);
  const [clubs, setClubs] = useState([]);
  const [selectedClubIds, setSelectedClubIds] = useState([]);
  const [clubSelectionInitialized, setClubSelectionInitialized] = useState(false);
  const [clubsDropdownOpen, setClubsDropdownOpen] = useState(false);
  const [bookings, setBookings] = useState([]);
  const [allocations, setAllocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [allocating, setAllocating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const [competitionRes, roundsRes, matchesRes, teamsRes, greensRes, bookingsRes, clubsRes, sectionsRes, sectionVenuesRes] = await Promise.all([
        supabase.from("competitions").select("id,name").eq("id", competitionId).maybeSingle(),
        supabase.from("competition_rounds").select("id,round_number,round_name,competition_day_id,competition_days(id,playing_date,name,venue_club_id,clubs(id,name,short_name))").eq("competition_id", competitionId).order("round_number"),
        supabase.from("competition_matches").select("id,round_id,section_id,match_number,team_a_id,team_b_id,completed").eq("competition_id", competitionId).order("match_number"),
        supabase.from("competition_teams").select("id,team_number,team_name,club_id,status,clubs(id,name,short_name)").eq("competition_id", competitionId),
        supabase.from("club_greens").select("id,name,club_id,active,allows_direction_change,clubs(id,name,short_name),green_rinks(id,label,active)").eq("active", true).order("name"),
        supabase.from("facility_bookings").select("id,competition_id,match_id,green_id,rink_id,playing_date,session_name,starts_at,ends_at,direction,status").neq("status", "cancelled"),
        supabase.from("clubs").select("id,name,short_name").order("name"),
        supabase.from("competition_sections").select("id,competition_id,section_number,section_name").eq("competition_id", competitionId).order("section_number"),
        supabase.from("competition_section_venues").select("section_id,club_id").eq("competition_id", competitionId)
      ]);
      for (const result of [roundsRes, matchesRes, teamsRes, greensRes, bookingsRes, clubsRes, sectionsRes, sectionVenuesRes]) if (result.error) throw result.error;
      setCompetition(competitionRes.data || { id: competitionId, name: "Competition" });
      const loadedTeams = teamsRes.data || [];
      setCompetitionTeams(loadedTeams);
      setSections(sectionsRes.data || []);
      setSectionVenueIds(Object.fromEntries((sectionVenuesRes.data || []).map(row => [row.section_id, row.club_id])));
      const teamMap = new Map(loadedTeams.map(t => [t.id, t]));
      const roundRows = (roundsRes.data || []).map(r => ({ ...r, day: r.competition_days }));
      const roundMap = new Map(roundRows.map(r => [r.id, r]));
      setRounds(roundRows);
      setMatches((matchesRes.data || []).map(m => ({ ...m, round: roundMap.get(m.round_id), teamA: teamMap.get(m.team_a_id), teamB: teamMap.get(m.team_b_id) })));
      const activeGreens = (greensRes.data || []).map(g => ({ ...g, rinks: (g.green_rinks || []).filter(r => r.active) })).filter(g => g.rinks.length);
      setGreens(activeGreens);
      const clubRows = clubsRes.data || [];
      setClubs(clubRows);
      const eligibleIds = clubRows.filter(c => activeGreens.some(g => g.club_id === c.id)).map(c => c.id);
      setSelectedClubIds(current => !clubSelectionInitialized ? eligibleIds : current.filter(id => eligibleIds.includes(id)));
      setClubSelectionInitialized(true);
      setBookings(bookingsRes.data || []);
    } catch (e) { setError(`Unable to load rink allocation data: ${e.message}`); }
    finally { setLoading(false); }
  }, [competitionId, clubSelectionInitialized]);

  useEffect(() => { load(); }, [load]);

  // team_number is a competition-wide ordering key, not the number of teams
  // belonging to a club. For generated labels, number each club's teams locally
  // (e.g. MBC1–MBC10), while preserving any explicitly entered custom team name.
  const labelTeam = useCallback((team) => {
    if (!team) return "TBC";
    const customName = String(team.team_name || "").trim();
    if (customName) return customName;

    const clubCode = team.clubs?.short_name?.trim() || team.club_short_name?.trim() || "Team";
    const clubTeams = competitionTeams
      .filter(item => item.club_id && team.club_id && item.club_id === team.club_id)
      .slice()
      .sort((a, b) => {
        const numberDiff = (a.team_number || 0) - (b.team_number || 0);
        return numberDiff || String(a.id || "").localeCompare(String(b.id || ""));
      });
    const localIndex = clubTeams.findIndex(item => item.id === team.id);
    const localNumber = localIndex >= 0 ? localIndex + 1 : 1;
    return `${clubCode}${localNumber}`;
  }, [competitionTeams]);

  // Only allocate fixtures whose team IDs resolve to teams belonging to this
  // competition. Stale/orphaned match rows can remain after team edits/imports;
  // allocating them creates misleading errors for teams that are no longer in
  // the competition.
  // Status values may come from imports/older records with inconsistent casing
  // (e.g. "Withdrawn" instead of "withdrawn"). Only active/unspecified team
  // statuses are eligible for allocation; all known inactive states are excluded.
  const isAllocatableTeam = (team) => {
    if (!team) return false;
    const status = String(team.status || "active").trim().toLowerCase();
    return status === "active";
  };

  const validMatches = useMemo(
    () => matches.filter(m =>
      m.team_a_id &&
      m.team_b_id &&
      m.teamA &&
      m.teamB &&
      isAllocatableTeam(m.teamA) &&
      isAllocatableTeam(m.teamB)
    ),
    [matches]
  );
  const scheduledMatches = useMemo(
    () => validMatches.filter(m => m.round?.day?.playing_date),
    [validMatches]
  );
  const missingScheduleCount = validMatches.length - scheduledMatches.length;
  const ignoredStaleMatchCount = matches.length - validMatches.length;
  const greenById = useMemo(() => new Map(greens.map(g => [g.id, g])), [greens]);
  const allocationByMatch = useMemo(() => new Map(allocations.map(a => [a.match_id, a])), [allocations]);
  const eligibleClubs = useMemo(() => clubs.filter(c => greens.some(g => g.club_id === c.id)), [clubs, greens]);
  const selectedGreens = useMemo(() => greens.filter(g => selectedClubIds.includes(g.club_id)), [greens, selectedClubIds]);
  const toggleClub = (clubId, checked) => setSelectedClubIds(current => checked ? [...new Set([...current, clubId])] : current.filter(id => id !== clubId));

  const saveSectionVenues = async (next = sectionVenueIds) => {
    const payload = sections.filter(section => next[section.id]).map(section => ({
      competition_id: competitionId,
      section_id: section.id,
      club_id: next[section.id],
    }));
    const { error: deleteError } = await supabase.from("competition_section_venues").delete().eq("competition_id", competitionId);
    if (deleteError) throw deleteError;
    if (payload.length) {
      const { error: insertError } = await supabase.from("competition_section_venues").insert(payload);
      if (insertError) throw insertError;
    }
  };

  const buildInitialRows = () => {
    const roundDayOrder = new Map();
    const dayRoundGroups = new Map();
    rounds.forEach(r => {
      if (!r.day?.playing_date) return;
      const k = `${r.day.playing_date}`;
      if (!dayRoundGroups.has(k)) dayRoundGroups.set(k, []);
      dayRoundGroups.get(k).push(r);
    });
    // Allocate up to four rounds per day into four distinct sessions:
    // rounds 1-2 in the morning (Direction 1), rounds 3-4 in the afternoon
    // (Direction 2). No evening session is used.
    for (const group of dayRoundGroups.values()) {
      group.sort((a, b) => a.round_number - b.round_number)
        .forEach((r, i) => roundDayOrder.set(r.id, Math.min(i, SESSIONS.length - 1)));
    }
    return scheduledMatches.map(m => {
      const idx = roundDayOrder.get(m.round_id) ?? 0;
      const session = SESSIONS[idx];
      const date = m.round.day.playing_date;
      const old = bookings.find(b => b.match_id === m.id && b.competition_id === competitionId);
      const oldGreen = old ? greens.find(g => g.id === old.green_id) : null;
      return {
        match_id: m.id, round_id: m.round_id, section_id: m.section_id || null, round_number: m.round.round_number,
        match_number: m.match_number, round_name: m.round.round_name || "", team_a_id: m.team_a_id, team_b_id: m.team_b_id,
        team_a_label: labelTeam(m.teamA), team_b_label: labelTeam(m.teamB),
        playing_date: date, venue_club_id: oldGreen?.club_id || "",
        venue_name: oldGreen?.clubs?.name || "Not yet allocated",
        session_name: session.name,
        starts_at: localIso(date, session.start),
        ends_at: localIso(date, session.end),
        green_id: old?.green_id || "", rink_id: old?.rink_id || "", direction: session.direction,
        booking_id: old?.id || null, status: old?.status || "confirmed", notes: old?.notes || "",
      };
    });
  };

  const runAutoAllocation = async () => {
    setAllocating(true); setError(""); setNotice("");
    try {
      const rows = buildInitialRows().sort((a, b) => `${a.playing_date}:${a.starts_at}:${a.round_number}:${a.match_number}`.localeCompare(`${b.playing_date}:${b.starts_at}:${b.round_number}:${b.match_number}`));
      if (!rows.length) throw new Error("No fixtures have both teams and a saved playing date. Confirm the draw and save the playing dates first.");
      if (!selectedClubIds.length) throw new Error("Select at least one eligible club before allocating rinks.");
      const isSectionalRow = row => Boolean(row.section_id && sections.some(section => section.id === row.section_id) && !/playoff|quarter.?final|semi.?final|grand.?final|final/i.test(row.round_name || ""));
      const sectionalRows = rows.filter(isSectionalRow);
      // Randomly assign each section to one of the selected eligible clubs. The
      // assignment is fixed for every sectional round in this competition and is
      // saved before rink allocation. Clubs with more usable rinks are favoured
      // when that helps balance simultaneous games; ties remain random.
      const sectionIdsInDraw = [...new Set(sectionalRows.map(row => row.section_id))];
      const clubsForSections = eligibleClubs.filter(club => selectedClubIds.includes(club.id));
      if (sectionIdsInDraw.length && !clubsForSections.length) throw new Error("Select at least one eligible club before assigning section venues.");
      const externalBookings = bookings.filter(b => b.status !== "cancelled" && b.competition_id !== competitionId);
      const capacityFor = (clubId, date, sessionName, startsAt, endsAt) => {
        const direction = sessionName.startsWith("Afternoon") ? 2 : 1;
        return selectedGreens.filter(g => g.club_id === clubId && g.active && (direction !== 2 || g.allows_direction_change))
          .reduce((sum, green) => sum + green.rinks.filter(rink => !externalBookings.some(b => {
            if (b.green_id !== green.id || !overlaps(startsAt, endsAt, b.starts_at, b.ends_at)) return false;
            return Number(b.direction) !== direction || b.rink_id === rink.id;
          })).length, 0);
      };
      const sectionDemand = new Map();
      for (const row of sectionalRows) {
        const k = `${row.section_id}|${row.playing_date}|${row.session_name}`;
        sectionDemand.set(k, (sectionDemand.get(k) || 0) + 1);
      }
      const demandBySection = new Map();
      for (const [key, demand] of sectionDemand) {
        const [sectionId, date, sessionName] = key.split("|");
        if (!demandBySection.has(sectionId)) demandBySection.set(sectionId, []);
        const sample = sectionalRows.find(row => row.section_id === sectionId && row.playing_date === date && row.session_name === sessionName);
        demandBySection.get(sectionId).push({ date, sessionName, demand, starts_at: sample.starts_at, ends_at: sample.ends_at });
      }
      const shuffledSections = sectionIdsInDraw.slice().sort(() => Math.random() - 0.5);
      const randomizedVenueMap = {};
      const demandAlreadyAssigned = new Map();
      const utilizationScore = (clubId, sectionId) => {
        const demands = demandBySection.get(sectionId) || [];
        let worstRatio = 0, totalRatio = 0;
        for (const item of demands) {
          const key = `${clubId}|${item.date}|${item.sessionName}`;
          const capacity = capacityFor(clubId, item.date, item.sessionName, item.starts_at, item.ends_at);
          const used = demandAlreadyAssigned.get(key) || 0;
          const ratio = (used + item.demand) / Math.max(1, capacity);
          worstRatio = Math.max(worstRatio, ratio);
          totalRatio += ratio;
        }
        return { worstRatio, totalRatio };
      };
      for (const sectionId of shuffledSections) {
        const rankedClubs = clubsForSections.map(club => ({ club, score: utilizationScore(club.id, sectionId), tie: Math.random() }))
          .sort((a, b) => a.score.worstRatio - b.score.worstRatio || a.score.totalRatio - b.score.totalRatio || a.tie - b.tie);
        const chosenClub = rankedClubs[0]?.club;
        if (!chosenClub) throw new Error("Unable to assign a host club to every section.");
        randomizedVenueMap[sectionId] = chosenClub.id;
        for (const item of demandBySection.get(sectionId) || []) {
          const key = `${chosenClub.id}|${item.date}|${item.sessionName}`;
          demandAlreadyAssigned.set(key, (demandAlreadyAssigned.get(key) || 0) + item.demand);
        }
      }
      await saveSectionVenues(randomizedVenueMap);
      setSectionVenueIds(randomizedVenueMap);
      // Build repeat history in chronological order from this allocation run,
      // rather than counting stale bookings that are about to be replaced.
      const teamRinks = new Map();
      const planned = [];
      for (const row of rows) {
        const afternoon = row.session_name.startsWith("Afternoon");
        const assignedSectionClub = isSectionalRow(row) ? randomizedVenueMap[row.section_id] : null;
        const candidates = selectedGreens.filter(g =>
          g.active &&
          (!assignedSectionClub || g.club_id === assignedSectionClub) &&
          (!afternoon || g.allows_direction_change)
        ).flatMap(g => g.rinks.map(r => ({ green: g, rink: r })));
        if (row.section_id && !assignedSectionClub) {
          const section = sections.find(item => item.id === row.section_id);
          throw new Error(`Assign a host club to ${section?.section_name || "every section"} before allocating sectional rinks.`);
        }
        if (!candidates.length) throw new Error(afternoon ? "No selected club has an active green configured for Direction 2. Enable perpendicular direction changes for an eligible green in Club Facilities." : "None of the selected clubs has active greens with available rinks configured in Club Facilities.");
        // Existing bookings belonging to this competition are being refreshed by this
        // allocation run. Other competitions remain hard conflicts.
        const external = externalBookings;
        const desiredDirection = afternoon ? 2 : 1;
        const ranked = candidates.map(c => {
          const conflict = external.some(b => {
            if (b.green_id !== c.green.id || !overlaps(row.starts_at, row.ends_at, b.starts_at, b.ends_at)) return false;
            // Each direction has six lanes (A1-A6). Same-direction sessions
            // can use separate lanes concurrently; perpendicular directions
            // must never overlap because the playing areas cross.
            return Number(b.direction) !== desiredDirection || b.rink_id === c.rink.id;
          }) || planned.some(b => b.green_id === c.green.id && overlaps(row.starts_at, row.ends_at, b.starts_at, b.ends_at) && (Number(b.direction) !== desiredDirection || b.rink_id === c.rink.id));
          const repeated = [row.team_a_id, row.team_b_id].filter(Boolean).some(id => teamRinks.get(id)?.has(c.rink.id));
          return { ...c, conflict, repeated, score: (conflict ? 100000 : 0) + (repeated ? 100 : 0) + planned.filter(b => b.rink_id === c.rink.id).length };
        }).filter(c => !c.conflict).sort((a, b) => a.score - b.score || a.green.name.localeCompare(b.green.name) || a.rink.label.localeCompare(b.rink.label));
        if (!ranked.length) throw new Error(`No available rink at any configured club for Round ${row.round_number}, ${row.team_a_label} vs ${row.team_b_label} on ${row.playing_date}. Check the shared calendar or adjust the sessions/facility availability.`);
        const chosen = ranked[0];
        const allocation = { ...row, venue_club_id: chosen.green.club_id, venue_name: chosen.green.clubs?.name || "Club", green_id: chosen.green.id, rink_id: chosen.rink.id, direction: desiredDirection, repeat_warning: chosen.repeated };
        planned.push(allocation);
        for (const teamId of [row.team_a_id, row.team_b_id].filter(Boolean)) {
          if (!teamRinks.has(teamId)) teamRinks.set(teamId, new Set());
          teamRinks.get(teamId).add(chosen.rink.id);
        }
      }
      setAllocations(planned);
      const repeats = planned.filter(p => p.repeat_warning).length;
      setNotice(`Allocated ${planned.length} fixtures${repeats ? `; ${repeats} rink repeat(s) were unavoidable or preferred after checking available capacity` : ` without repeating a team's previously assigned rink`}. Review the assignments and save them.`);
    } catch (e) { setError(e.message); }
    finally { setAllocating(false); }
  };

  const updateAllocation = (matchId, field, value) => setAllocations(current => current.map(a => {
    if (a.match_id !== matchId) return a;
    const updated = { ...a, [field]: value };
    if (field === "green_id") {
      const g = greenById.get(value);
      updated.rink_id = g?.rinks?.[0]?.id || "";
      updated.venue_club_id = g?.club_id || "";
      updated.venue_name = g?.clubs?.name || "Not yet allocated";
    }
    if (field === "direction" && Number(value) === 2) updated.repeat_warning = updated.repeat_warning || false;
    return updated;
  }));

  const saveAllocations = async () => {
    if (!allocations.length) { setError("Generate an allocation before saving."); return; }
    setSaving(true); setError(""); setNotice("");
    try {
      const payloads = allocations.map(a => {
        if (!a.green_id || !a.rink_id) throw new Error(`Select a green and rink for Round ${a.round_number}, ${a.team_a_label} vs ${a.team_b_label}.`);
        const green = greenById.get(a.green_id);
        if (!green || green.club_id !== a.venue_club_id) throw new Error(`The selected green does not belong to the host club for Round ${a.round_number}.`);
        if (!selectedClubIds.includes(green.club_id)) throw new Error(`${green.clubs?.name || "The selected club"} is not currently marked eligible. Select that club or choose another green before saving.`);
        if (Number(a.direction) === 2 && !green.allows_direction_change) throw new Error(`${green.name} is not configured for perpendicular direction changes.`);
        return {
          match_id: a.match_id, green_id: a.green_id, rink_id: a.rink_id,
          playing_date: a.playing_date, session_name: a.session_name, starts_at: a.starts_at, ends_at: a.ends_at,
          direction: Number(a.direction), status: "confirmed", notes: a.notes || null,
        };
      });
      // A database function replaces this competition's allocations for the selected
      // fixtures in one transaction. If any cross-competition conflict is detected,
      // the transaction rolls back and the existing bookings remain intact.
      const { error: saveError } = await supabase.rpc("save_competition_facility_bookings", {
        p_competition_id: competitionId,
        p_bookings: payloads,
      });
      if (saveError) throw saveError;
      setNotice("Rink allocations saved. All bookings were validated against every other BowlPoint competition.");
      await load();
      setAllocations([]);
    } catch (e) { setError(`Unable to save rink allocations. No partial replacement was committed. ${e.message}`); }
    finally { setSaving(false); }
  };

  const rowsToShow = allocations.length ? allocations : [];
  // Group the review list by host club, then green and rink so organisers can
  // review each club's complete allocation together rather than by fixture order.
  const allocationGroups = useMemo(() => {
    const clubName = (a) => a.venue_name || greenById.get(a.green_id)?.clubs?.name || "Unassigned club";
    const sessionOrder = new Map(SESSIONS.map((session, index) => [session.name, index]));
    const sorted = [...rowsToShow].sort((a, b) =>
      clubName(a).localeCompare(clubName(b), undefined, { sensitivity: "base" }) ||
      (greenById.get(a.green_id)?.name || "").localeCompare(greenById.get(b.green_id)?.name || "", undefined, { sensitivity: "base" }) ||
      String(a.playing_date).localeCompare(String(b.playing_date)) ||
      (sessionOrder.get(a.session_name) ?? 99) - (sessionOrder.get(b.session_name) ?? 99) ||
      (greenById.get(a.green_id)?.rinks?.find(r => r.id === a.rink_id)?.label || "").localeCompare(greenById.get(b.green_id)?.rinks?.find(r => r.id === b.rink_id)?.label || "", undefined, { numeric: true, sensitivity: "base" }) ||
      a.round_number - b.round_number ||
      a.match_number - b.match_number
    );
    const groups = [];
    for (const row of sorted) {
      const name = clubName(row);
      let group = groups[groups.length - 1];
      if (!group || group.name !== name) {
        group = { name, rows: [] };
        groups.push(group);
      }
      group.rows.push(row);
    }
    return groups;
  }, [rowsToShow, greenById]);
  const rinksForGreen = (greenId) => greenById.get(greenId)?.rinks || [];
  const greensForSelectedClubs = selectedGreens;

  return <div className="container-fluid py-4">
    <div className="d-flex flex-wrap justify-content-between align-items-start gap-3 mb-4">
      <div><h1 className="mb-1">Rink Allocation</h1><p className="text-muted mb-0">{competition?.name || competition?.title || "Competition"} · Allocate confirmed fixtures to shared club facilities.</p></div>
      <div className="d-flex gap-2"><button className="btn btn-outline-secondary" onClick={() => navigate("/facility-calendar")}>Shared Facility Calendar</button><button className="btn btn-outline-secondary" onClick={() => navigate(`/competitions/${competitionId}`)}>Back to Competition</button></div>
    </div>
    {error && <div className="alert alert-danger" role="alert">{error}</div>}
    {notice && <div className="alert alert-info" role="status">{notice}</div>}
    {!loading && ignoredStaleMatchCount > 0 && <div className="alert alert-warning" role="alert">
      {ignoredStaleMatchCount} fixture(s) were ignored because one or both assigned teams are missing or are no longer active in this competition. They will not be included in rink allocation.
    </div>}
    {loading ? <div className="text-muted">Loading competition fixtures and facilities…</div> : <>
      <div className="card border-0 shadow-sm mb-4"><div className="card-body">
        <div className="d-flex flex-wrap align-items-start justify-content-between gap-3">
          <div>
            <h5 className="mb-1">Eligible Clubs</h5>
            <p className="text-muted small mb-0">Choose which clubs may host games in this competition. Automatic allocation will only use greens belonging to the selected clubs.</p>
          </div>
          <div className="dropdown position-relative" style={{ zIndex: clubsDropdownOpen ? 1055 : "auto" }}>
            <button
              className="btn btn-outline-primary dropdown-toggle"
              type="button"
              aria-expanded={clubsDropdownOpen}
              aria-haspopup="true"
              onClick={() => setClubsDropdownOpen(open => !open)}
            >
              Select clubs ({selectedClubIds.length} of {eligibleClubs.length})
            </button>
            {clubsDropdownOpen && <div
              className="dropdown-menu dropdown-menu-end p-3 show"
              style={{
                position: "absolute",
                right: 0,
                left: "auto",
                width: "min(360px, calc(100vw - 32px))",
                minWidth: 0,
                maxWidth: "calc(100vw - 32px)",
                maxHeight: "min(360px, calc(100vh - 120px))",
                overflowY: "auto",
                overflowX: "hidden",
                boxSizing: "border-box",
                zIndex: 1060
              }}
              onClick={e => e.stopPropagation()}
            >
              <div className="d-flex flex-wrap gap-2 mb-2">
                <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => setSelectedClubIds(eligibleClubs.map(c => c.id))}>Select all</button>
                <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => setSelectedClubIds([])}>Clear</button>
                <button type="button" className="btn btn-sm btn-primary ms-auto" onClick={() => setClubsDropdownOpen(false)}>Done</button>
              </div>
              {eligibleClubs.length === 0 && <div className="text-muted small">No clubs with active greens and rinks are configured.</div>}
              {clubs.map(club => {
                const hasActiveRinks = eligibleClubs.some(item => item.id === club.id);
                return <label key={club.id} className={`dropdown-item d-flex align-items-center gap-2 px-1 py-2 ${!hasActiveRinks ? "text-muted" : ""}`} style={{ whiteSpace: "normal", cursor: hasActiveRinks ? "pointer" : "not-allowed" }}>
                  <input className="form-check-input mt-0" type="checkbox" checked={selectedClubIds.includes(club.id)} disabled={!hasActiveRinks} onChange={e => toggleClub(club.id, e.target.checked)} />
                  <span style={{ minWidth: 0, overflowWrap: "anywhere" }}>{club.name}{club.short_name ? <span className="text-muted small"> ({club.short_name})</span> : null}{!hasActiveRinks ? <span className="small"> — no active rinks</span> : null}</span>
                </label>;
              })}
            </div>}
          </div>
        </div>
        {selectedClubIds.length === 0 && <div className="alert alert-warning py-2 mt-3 mb-0">Select at least one club before generating an allocation.</div>}
        {selectedClubIds.length > 0 && <div className="small text-muted mt-2">Eligible venues: {greensForSelectedClubs.map(g => `${g.clubs?.short_name || g.clubs?.name || "Club"} — ${g.name}`).join(", ")}</div>}
      </div></div>
      {sections.length > 0 && <div className="card border-0 shadow-sm mb-4"><div className="card-header bg-white"><h5 className="mb-1">Automatic Section Host Assignment</h5><div className="small text-muted">When you click Automatically Allocate Rinks, BowlPoint randomly assigns each section to one of the selected eligible clubs, balancing sections against available rink capacity. Every sectional round for a section stays at that club; playoff venues can differ.</div></div>{Object.keys(sectionVenueIds).length > 0 && <div className="card-body"><div className="row g-2">{sections.filter(section => sectionVenueIds[section.id]).map(section => { const host = clubs.find(club => club.id === sectionVenueIds[section.id]); return <div className="col-md-6 col-xl-4" key={section.id}><div className="border rounded p-2"><span className="fw-semibold">{section.section_name || `Section ${section.section_number}`}</span><span className="text-muted"> — {host?.name || "Host club assigned"}</span></div></div>; })}</div><div className="small text-muted mt-2">These are the last saved section assignments. Running automatic allocation will randomly assign them again.</div></div>}</div>}
      <div className="card border-0 shadow-sm mb-4"><div className="card-body">
        <div className="row g-3 align-items-center">
          <div className="col-md"><div className="fw-semibold">Fixtures ready for allocation</div><div className="text-muted small">Only matches with both teams and a saved date are allocated. BowlPoint assigns each section to one selected club, then allocates greens and rinks within that club.</div></div>
          <div className="col-md-auto"><span className="badge bg-primary me-2">{scheduledMatches.length} ready</span>{missingScheduleCount > 0 && <span className="badge bg-warning text-dark">{missingScheduleCount} need dates</span>}</div>
          <div className="col-md-auto"><button className="btn btn-primary" onClick={runAutoAllocation} disabled={allocating || !scheduledMatches.length || !selectedClubIds.length}>{allocating ? <><span className="spinner-border spinner-border-sm me-2"/>Allocating…</> : <><i className="bi bi-magic me-2"/>Automatically Allocate Rinks</>}</button></div>
        </div>
      </div></div>
      {rowsToShow.length > 0 && <div className="card border-0 shadow-sm"><div className="card-header bg-white d-flex flex-wrap justify-content-between align-items-center gap-2"><div><h5 className="mb-1">Review Rink Allocations</h5><div className="small text-muted">Change any green, rink or direction before saving. Each green supports six lanes per session: Direction 1 lengthwise in both morning sessions and Direction 2 crosswise in both afternoon sessions.</div></div><button className="btn btn-success" onClick={saveAllocations} disabled={saving}>{saving ? "Saving…" : "Save Allocations"}</button></div>
        <div className="table-responsive"><table className="table table-hover align-middle mb-0"><thead><tr><th>Date / Session</th><th>Round / Fixture</th><th>Green</th><th>Rink</th><th>Direction</th><th>Check</th></tr></thead><tbody>
          {allocationGroups.map(group => <Fragment key={group.name}>
            <tr className="table-primary">
              <th colSpan={6} className="py-2">{group.name} <span className="fw-normal text-muted ms-2">{group.rows.length} game(s)</span></th>
            </tr>
            {group.rows.map(a => <tr key={a.match_id}>
              <td><div>{a.playing_date}</div><div className="small text-muted">{a.session_name}</div></td>
              <td><div className="small text-muted">Round {a.round_number}, Match {a.match_number}</div><div>{a.team_a_label} <span className="text-muted">vs</span> {a.team_b_label}</div></td>
              <td><select className="form-select form-select-sm" value={a.green_id} onChange={e => updateAllocation(a.match_id, "green_id", e.target.value)}><option value="">Select green</option>{greensForSelectedClubs.map(g => <option key={g.id} value={g.id}>{g.clubs?.short_name || g.clubs?.name || "Club"} — {g.name}</option>)}</select></td>
              <td><select className="form-select form-select-sm" value={a.rink_id} onChange={e => updateAllocation(a.match_id, "rink_id", e.target.value)}><option value="">Select rink</option>{rinksForGreen(a.green_id).map(r => <option key={r.id} value={r.id}>{r.label}</option>)}</select></td>
              <td><select className="form-select form-select-sm" value={a.direction} onChange={e => updateAllocation(a.match_id, "direction", Number(e.target.value))}><option value={1}>Direction 1 (lengthwise)</option><option value={2} disabled={!greenById.get(a.green_id)?.allows_direction_change}>Direction 2 (across green)</option></select></td>
              <td>{a.repeat_warning ? <span className="badge bg-warning text-dark">Rink repeat</span> : <span className="badge bg-success">No repeat found</span>}</td>
            </tr>)}
          </Fragment>)}
        </tbody></table></div><div className="card-footer bg-white small text-muted">Allocation is checked against bookings in every competition. Only the selected eligible clubs are used for this competition. If saving stops on a conflict, resolve it and run allocation again.</div></div>}
      {!rowsToShow.length && <div className="alert alert-secondary">Generate an automatic allocation to review and save rink assignments for this competition.</div>}
    </>}
  </div>;
}
