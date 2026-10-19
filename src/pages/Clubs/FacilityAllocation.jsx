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
  const [proposedSectionVenueIds, setProposedSectionVenueIds] = useState({});
  const [venueProposalReady, setVenueProposalReady] = useState(false);
  const [savingVenues, setSavingVenues] = useState(false);
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
    if (payload.length) {
      const { error: upsertError } = await supabase
        .from("competition_section_venues")
        .upsert(payload, { onConflict: "competition_id,section_id" });
      if (upsertError) throw upsertError;
    }
  };

  // Propose one host club per section for the entire sectional stage. Capacity is
  // checked per date/session across all sections already assigned to a club.
  const proposeSectionHosts = () => {
    setError(""); setNotice(""); setVenueProposalReady(false);
    try {
      if (!sections.length) throw new Error("No sections exist for this competition.");
      if (!selectedClubIds.length) throw new Error("Select the clubs that may host this competition first.");
      const rows = buildInitialRows().filter(row => row.section_id && !/playoff|quarter.?final|semi.?final|grand.?final|final/i.test(row.round_name || ""));
      if (!rows.length) throw new Error("No dated sectional fixtures are available. Save the playing dates first.");
      const sectionIds = new Set(sections.map(section => section.id));
      const sectionRows = rows.filter(row => sectionIds.has(row.section_id));
      const slots = new Map();
      for (const row of sectionRows) {
        const slot = `${row.playing_date}|${row.starts_at}|${row.ends_at}|${Number(row.direction)}`;
        if (!slots.has(slot)) slots.set(slot, []);
        slots.get(slot).push(row);
      }
      const slotRows = [...slots.entries()].map(([key, items]) => ({ key, items, direction: Number(items[0].direction), start: items[0].starts_at, end: items[0].ends_at }));
      const clubCapacityBySlot = new Map();
      for (const clubId of selectedClubIds) {
        const clubGreens = greens.filter(g => g.club_id === clubId && g.active && g.rinks.length);
        for (const slot of slotRows) {
          const usableGreens = clubGreens.filter(g => slot.direction !== 2 || g.allows_direction_change);
          let capacity = 0;
          for (const green of usableGreens) {
            for (const rink of green.rinks) {
              const occupied = bookings.some(b => b.competition_id !== competitionId && b.status !== "cancelled" &&
                b.green_id === green.id && overlaps(slot.start, slot.end, b.starts_at, b.ends_at) &&
                (Number(b.direction) !== slot.direction || b.rink_id === rink.id));
              if (!occupied) capacity += 1;
            }
          }
          clubCapacityBySlot.set(`${clubId}|${slot.key}`, capacity);
        }
      }
      const loadForSection = new Map(sections.map(section => [section.id, sectionRows.filter(row => row.section_id === section.id).length]));
      const orderedSections = [...sections].sort((a, b) => (loadForSection.get(b.id) || 0) - (loadForSection.get(a.id) || 0) || a.section_number - b.section_number);
      const proposal = {};
      const assignedSlotLoad = new Map();
      const assignedClubLoad = new Map();
      for (const section of orderedSections) {
        const demand = new Map();
        for (const slot of slotRows) {
          const count = slot.items.filter(row => row.section_id === section.id).length;
          if (count) demand.set(slot.key, count);
        }
        const candidates = selectedClubIds.map(clubId => {
          let feasible = true;
          let slack = 0;
          for (const [slotKey, count] of demand) {
            const capacity = clubCapacityBySlot.get(`${clubId}|${slotKey}`) || 0;
            const current = assignedSlotLoad.get(`${clubId}|${slotKey}`) || 0;
            if (current + count > capacity) feasible = false;
            slack += capacity - current - count;
          }
          return { clubId, feasible, slack, load: assignedClubLoad.get(clubId) || 0, currentHostCount: Object.values(proposal).filter(id => id === clubId).length };
        }).filter(candidate => candidate.feasible)
          // Consolidate the tournament at as few clubs as possible. Once a club
          // is hosting a section, prefer filling its remaining capacity before
          // opening another host, provided every session remains feasible.
          .sort((a, b) => b.currentHostCount - a.currentHostCount || b.load - a.load || b.slack - a.slack);
        if (!candidates.length) {
          throw new Error(`No eligible club has enough available rink capacity to host ${section.section_name || `Section ${section.section_number}`} for every scheduled session. Select more eligible clubs, check facility capacity/bookings, or adjust the schedule.`);
        }
        const chosen = candidates[0].clubId;
        proposal[section.id] = chosen;
        assignedClubLoad.set(chosen, (assignedClubLoad.get(chosen) || 0) + (loadForSection.get(section.id) || 0));
        for (const [slotKey, count] of demand) {
          const key = `${chosen}|${slotKey}`;
          assignedSlotLoad.set(key, (assignedSlotLoad.get(key) || 0) + count);
        }
      }
      setProposedSectionVenueIds(proposal);
      setVenueProposalReady(true);
      setNotice("Host-club proposal prepared. Each section stays at one club for all sectional rounds. Review the proposal and approve it before allocating individual rinks.");
    } catch (e) { setError(e.message); }
  };

  const validateSectionHostCapacity = (proposal) => {
    const rows = buildInitialRows().filter(row => row.section_id && !/playoff|quarter.?final|semi.?final|grand.?final|final/i.test(row.round_name || ""));
    const slotLoads = new Map();
    for (const row of rows) {
      const slot = `${row.playing_date}|${row.starts_at}|${row.ends_at}|${Number(row.direction)}`;
      const key = `${proposal[row.section_id]}|${slot}`;
      slotLoads.set(key, (slotLoads.get(key) || 0) + 1);
    }
    for (const [key, demand] of slotLoads) {
      const [clubId, date, start, end, direction] = key.split("|");
      const usableGreens = greens.filter(g => g.club_id === clubId && g.active && g.rinks.length && (Number(direction) !== 2 || g.allows_direction_change));
      let capacity = 0;
      for (const green of usableGreens) {
        for (const rink of green.rinks) {
          const occupied = bookings.some(b => b.competition_id !== competitionId && b.status !== "cancelled" &&
            b.green_id === green.id && overlaps(start, end, b.starts_at, b.ends_at) &&
            (Number(b.direction) !== Number(direction) || b.rink_id === rink.id));
          if (!occupied) capacity += 1;
        }
      }
      if (demand > capacity) {
        const club = clubs.find(c => c.id === clubId)?.name || "Selected club";
        throw new Error(`${club} cannot accommodate ${demand} simultaneous fixture(s) on ${date} at ${start}. Only ${capacity} compatible rinks are available. Change the host club or review the facility calendar.`);
      }
    }
  };

  const approveSectionHosts = async () => {
    if (sections.some(section => !proposedSectionVenueIds[section.id])) {
      setError("Assign a host club to every section before approving the venue plan.");
      return;
    }
    setSavingVenues(true); setError(""); setNotice("");
    try {
      for (const section of sections) {
        if (!selectedClubIds.includes(proposedSectionVenueIds[section.id])) {
          throw new Error(`The proposed host for ${section.section_name || `Section ${section.section_number}`} is not in the eligible club list.`);
        }
      }
      validateSectionHostCapacity(proposedSectionVenueIds);
      await saveSectionVenues(proposedSectionVenueIds);
      setSectionVenueIds({ ...proposedSectionVenueIds });
      setVenueProposalReady(false);
      setAllocations([]);
      setNotice("Section host clubs saved. Every section now has one fixed venue for the entire sectional stage. You can now allocate individual greens and rinks.");
    } catch (e) { setError(`Unable to save section host clubs: ${e.message}`); }
    finally { setSavingVenues(false); }
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
    // Fallback only for fixtures without an existing booking. Existing booking
    // date/time/session/direction are retained exactly when rink-only reallocation
    // is run, so the allocator does not silently change the competition schedule.
    for (const group of dayRoundGroups.values()) {
      group.sort((a, b) => a.round_number - b.round_number)
        .forEach((r, i) => roundDayOrder.set(r.id, Math.min(i, SESSIONS.length - 1)));
    }
    return scheduledMatches.map(m => {
      const idx = roundDayOrder.get(m.round_id) ?? 0;
      const fallbackSession = SESSIONS[idx];
      const old = bookings.find(b => b.match_id === m.id && b.competition_id === competitionId && b.status !== "cancelled");
      const oldGreen = old ? greens.find(g => g.id === old.green_id) : null;
      const date = old?.playing_date || m.round.day.playing_date;
      const session = old ? {
        name: old.session_name || fallbackSession.name,
        start: old.starts_at ? new Date(old.starts_at).toLocaleTimeString("en-GB", { timeZone: "Africa/Johannesburg", hour12: false }) : fallbackSession.start,
        end: old.ends_at ? new Date(old.ends_at).toLocaleTimeString("en-GB", { timeZone: "Africa/Johannesburg", hour12: false }) : fallbackSession.end,
        direction: Number(old.direction) || fallbackSession.direction,
      } : fallbackSession;
      return {
        match_id: m.id, round_id: m.round_id, section_id: m.section_id || null, round_number: m.round.round_number,
        match_number: m.match_number, round_name: m.round.round_name || "", team_a_id: m.team_a_id, team_b_id: m.team_b_id,
        team_a_label: labelTeam(m.teamA), team_b_label: labelTeam(m.teamB),
        playing_date: date, venue_club_id: oldGreen?.club_id || m.round.day?.venue_club_id || "",
        venue_name: oldGreen?.clubs?.name || m.round.day?.clubs?.name || "Not yet allocated",
        session_name: session.name,
        starts_at: old?.starts_at || localIso(date, session.start),
        ends_at: old?.ends_at || localIso(date, session.end),
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
      if (!selectedClubIds.length) throw new Error("Select the clubs that are permitted to host this competition before allocating rinks.");
      const isSectionalRow = row => Boolean(row.section_id && sections.some(section => section.id === row.section_id) && !/playoff|quarter.?final|semi.?final|grand.?final|final/i.test(row.round_name || ""));
      const externalBookings = bookings.filter(b => b.status !== "cancelled" && b.competition_id !== competitionId);
      const teamRinks = new Map();
      const planned = [];
      for (const row of rows) {
        const afternoon = Number(row.direction) === 2 || row.session_name.startsWith("Afternoon");
        const desiredDirection = afternoon ? 2 : 1;
        // Keep the existing section venue. For playoffs/non-sectional matches, use
        // the current booking's venue or the saved round-day venue. Never randomize.
        const assignedSectionClub = isSectionalRow(row) ? sectionVenueIds[row.section_id] : null;
        const fixedVenueClub = assignedSectionClub || row.venue_club_id || null;
        if (isSectionalRow(row) && !assignedSectionClub) {
          const section = sections.find(item => item.id === row.section_id);
          throw new Error(`No saved host venue is assigned to ${section?.section_name || "a section"}. Set the section venue first; rink-only allocation will not change it.`);
        }
        if (!fixedVenueClub) {
          throw new Error(`No existing venue could be resolved for Round ${row.round_number}, ${row.team_a_label} vs ${row.team_b_label}. Assign its venue first; rink-only allocation will not choose a new venue.`);
        }
        const candidates = selectedGreens.filter(g =>
          g.active && g.club_id === fixedVenueClub && (!afternoon || g.allows_direction_change)
        ).flatMap(g => g.rinks.map(r => ({ green: g, rink: r })));
        if (!candidates.length) {
          const venueName = clubs.find(c => c.id === fixedVenueClub)?.name || "the saved venue";
          throw new Error(`No active green/rinks are available at ${venueName} for Round ${row.round_number}. Check its configured greens, active rinks, and direction-change setting. The venue will not be changed.`);
        }
        const ranked = candidates.map(c => {
          const conflict = externalBookings.some(b => {
            if (b.green_id !== c.green.id || !overlaps(row.starts_at, row.ends_at, b.starts_at, b.ends_at)) return false;
            // Different directions cross the same green and conflict; same-direction
            // sessions conflict only when the same physical rink is already booked.
            return Number(b.direction) !== desiredDirection || b.rink_id === c.rink.id;
          }) || planned.some(b => b.green_id === c.green.id && overlaps(row.starts_at, row.ends_at, b.starts_at, b.ends_at) && (Number(b.direction) !== desiredDirection || b.rink_id === c.rink.id));
          const repeated = [row.team_a_id, row.team_b_id].filter(Boolean).some(id => teamRinks.get(id)?.has(c.rink.id));
          const sameVenueRinkLoad = planned.filter(b => b.green_id === c.green.id && b.rink_id === c.rink.id).length;
          return { ...c, conflict, repeated, score: (conflict ? 100000 : 0) + (repeated ? 100 : 0) + sameVenueRinkLoad };
        }).filter(c => !c.conflict).sort((a, b) => a.score - b.score || a.green.name.localeCompare(b.green.name) || a.rink.label.localeCompare(b.rink.label, undefined, { numeric: true }));
        if (!ranked.length) throw new Error(`No available rink at the saved venue for Round ${row.round_number}, ${row.team_a_label} vs ${row.team_b_label} on ${row.playing_date}. Check the shared calendar or adjust the facility configuration. Existing venues and times have not been changed.`);
        const chosen = ranked[0];
        const allocation = { ...row, venue_club_id: chosen.green.club_id, venue_name: chosen.green.clubs?.name || row.venue_name || "Club", green_id: chosen.green.id, rink_id: chosen.rink.id, direction: desiredDirection, repeat_warning: chosen.repeated };
        planned.push(allocation);
        for (const teamId of [row.team_a_id, row.team_b_id].filter(Boolean)) {
          if (!teamRinks.has(teamId)) teamRinks.set(teamId, new Set());
          teamRinks.get(teamId).add(chosen.rink.id);
        }
      }
      setAllocations(planned);
      const repeats = planned.filter(p => p.repeat_warning).length;
      setNotice(`Prepared ${planned.length} rink-only allocations. Section venues and saved fixture dates/times are preserved. ${repeats ? `${repeats} rink repeat(s) remain because of capacity or availability; review before saving.` : "No team rink repeats were found."} Review the assignments before saving.`);
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
            <p className="text-muted small mb-0">Choose which clubs may be used for rink allocation. BowlPoint will keep each section at its already assigned venue; it will not move sections to other clubs.</p>
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
      {sections.length > 0 && <div className="card border-0 shadow-sm mb-4">
        <div className="card-header bg-white">
          <h5 className="mb-1">Section Host Club Proposal</h5>
          <div className="small text-muted">BowlPoint proposes a host club for each section using scheduled fixture demand, active greens/rinks, direction rules and existing bookings. Each section must remain at the same club for every sectional round.</div>
        </div>
        <div className="card-body">
          <div className="d-flex flex-wrap gap-2 mb-3">
            <button type="button" className="btn btn-outline-primary" onClick={proposeSectionHosts} disabled={loading || savingVenues}>
              <i className="bi bi-magic me-2"/>Propose Host Clubs
            </button>
            {venueProposalReady && <button type="button" className="btn btn-success" onClick={approveSectionHosts} disabled={savingVenues}>
              {savingVenues ? "Saving venue plan…" : "Approve Host Clubs"}
            </button>}
          </div>
          {venueProposalReady && <div className="alert alert-info py-2">Review every section below. Changing a club is allowed, but approval will save one host club per section for the full sectional stage.</div>}
          <div className="row g-2">
            {sections.map(section => {
              const currentId = venueProposalReady ? proposedSectionVenueIds[section.id] || "" : sectionVenueIds[section.id] || "";
              const host = clubs.find(club => club.id === currentId);
              const sectionHasProposal = venueProposalReady && Boolean(currentId);
              return <div className="col-md-6 col-xl-4" key={section.id}>
                <div className="border rounded p-3 h-100">
                  <div className="fw-semibold mb-2">{section.section_name || `Section ${section.section_number}`}</div>
                  {venueProposalReady ? <select className="form-select" value={currentId} onChange={e => setProposedSectionVenueIds(current => ({ ...current, [section.id]: e.target.value }))}>
                    <option value="">Choose host club</option>
                    {clubs.filter(club => eligibleClubs.some(item => item.id === club.id)).map(club => <option key={club.id} value={club.id}>{club.name}</option>)}
                  </select> : <div>{host?.name || <span className="text-danger">No host club saved</span>}</div>}
                  {sectionHasProposal && <div className="small text-muted mt-2">Proposed host for all sectional dates</div>}
                </div>
              </div>;
            })}
          </div>
          {venueProposalReady && <div className="mt-3">
            {(() => {
              const sectionalRows = scheduledMatches.filter(row =>
                row.section_id &&
                sections.some(section => section.id === row.section_id) &&
                !/playoff|quarter.?final|semi.?final|grand.?final|final/i.test(row.round?.round_name || "")
              );
              const scorecardsByClub = new Map();
              for (const section of sections) {
                const clubId = proposedSectionVenueIds[section.id];
                if (!clubId) continue;
                const count = sectionalRows.filter(row => row.section_id === section.id).length;
                scorecardsByClub.set(clubId, (scorecardsByClub.get(clubId) || 0) + count);
              }
              const totalScorecards = [...scorecardsByClub.values()].reduce((sum, count) => sum + count, 0);
              return <div className="card border-primary-subtle">
                <div className="card-header bg-light d-flex flex-wrap justify-content-between align-items-center gap-2">
                  <div>
                    <div className="fw-semibold">Scorecards Required by Host Club</div>
                    <div className="small text-muted">Allow one scorecard per sectional game. Counts cover the full sectional stage.</div>
                  </div>
                  <span className="badge bg-primary">{totalScorecards} scorecards total</span>
                </div>
                <div className="card-body py-2">
                  <div className="row g-2">
                    {[...scorecardsByClub.entries()].sort((a, b) => (clubs.find(c => c.id === a[0])?.name || "").localeCompare(clubs.find(c => c.id === b[0])?.name || "")).map(([clubId, count]) => {
                      const club = clubs.find(item => item.id === clubId);
                      return <div className="col-sm-6 col-lg-4" key={clubId}>
                        <div className="border rounded p-2 h-100 d-flex justify-content-between align-items-center gap-2">
                          <span>{club?.name || "Selected club"}</span>
                          <span className="badge bg-secondary fs-6">{count}</span>
                        </div>
                      </div>;
                    })}
                  </div>
                </div>
              </div>;
            })()}
          </div>}
          {!venueProposalReady && Object.keys(sectionVenueIds).length > 0 && <div className="small text-muted mt-3">Saved host clubs remain fixed during rink allocation. To change them, generate and approve a new host-club proposal.</div>}
        </div>
      </div>}
      <div className="card border-0 shadow-sm mb-4"><div className="card-body">
        <div className="row g-3 align-items-center">
          <div className="col-md"><div className="fw-semibold">Fixtures ready for allocation</div><div className="text-muted small">Only matches with both teams and a saved date are allocated. Existing fixture dates/times and section venues are retained; only greens and rinks are regenerated.</div></div>
          <div className="col-md-auto"><span className="badge bg-primary me-2">{scheduledMatches.length} ready</span>{missingScheduleCount > 0 && <span className="badge bg-warning text-dark">{missingScheduleCount} need dates</span>}</div>
          <div className="col-md-auto"><button className="btn btn-primary" onClick={runAutoAllocation} disabled={allocating || !scheduledMatches.length || !selectedClubIds.length || sections.some(section => !sectionVenueIds[section.id])}>{allocating ? <><span className="spinner-border spinner-border-sm me-2"/>Allocating…</> : <><i className="bi bi-magic me-2"/>Automatically Allocate Rinks</>}</button></div>
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
