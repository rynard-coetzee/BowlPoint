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
  const [sectionGreenIds, setSectionGreenIds] = useState({});
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
  const [activeStage, setActiveStage] = useState("sectional");
  const [playoffVenueIds, setPlayoffVenueIds] = useState({});
  const [savingPlayoffVenues, setSavingPlayoffVenues] = useState(false);
  const [loading, setLoading] = useState(true);
  const [allocating, setAllocating] = useState(false);
  const [allocationAttempted, setAllocationAttempted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const [competitionRes, roundsRes, matchesRes, teamsRes, greensRes, bookingsRes, clubsRes, sectionsRes, sectionVenuesRes, playoffVenuesRes] = await Promise.all([
        supabase.from("competitions").select("id,name").eq("id", competitionId).maybeSingle(),
        supabase.from("competition_rounds").select("id,round_number,round_name,competition_day_id,competition_days(id,playing_date,name,venue_club_id,clubs(id,name,short_name))").eq("competition_id", competitionId).order("round_number"),
        supabase.from("competition_matches").select("id,round_id,section_id,match_number,team_a_id,team_b_id,completed").eq("competition_id", competitionId).order("match_number"),
        supabase.from("competition_teams").select("id,team_number,team_name,club_id,status,clubs(id,name,short_name)").eq("competition_id", competitionId),
        supabase.from("club_greens").select("id,name,club_id,active,allows_direction_change,clubs(id,name,short_name),green_rinks(id,label,active)").eq("active", true).order("name"),
        supabase.from("facility_bookings").select("id,competition_id,match_id,green_id,rink_id,playing_date,session_name,starts_at,ends_at,direction,status,notes,created_by"),
        supabase.from("clubs").select("id,name,short_name").order("name"),
        supabase.from("competition_sections").select("id,competition_id,section_number,section_name").eq("competition_id", competitionId).order("section_number"),
        supabase.from("competition_section_venues").select("section_id,club_id,green_id").eq("competition_id", competitionId),
        supabase.from("competition_playoff_venues").select("round_id,club_id").eq("competition_id", competitionId)
      ]);
      for (const result of [roundsRes, matchesRes, teamsRes, greensRes, bookingsRes, clubsRes, sectionsRes, sectionVenuesRes, playoffVenuesRes]) if (result.error) throw result.error;

      const rawBookings = bookingsRes.data || [];
      const bookingMatchIds = [...new Set(rawBookings.map(booking => booking.match_id).filter(Boolean))];
      let bookingMatchOwners = {};
      if (bookingMatchIds.length) {
        const { data: matchOwnerRows, error: matchOwnerError } = await supabase
          .from("competition_matches")
          .select("id,competition_id")
          .in("id", bookingMatchIds);
        if (matchOwnerError) throw new Error(`Unable to resolve facility booking owners: ${matchOwnerError.message}`);
        bookingMatchOwners = Object.fromEntries((matchOwnerRows || []).map(match => [match.id, match.competition_id]));
      }
      const resolvedBookings = rawBookings.map(booking => ({
        ...booking,
        competition_id: bookingMatchOwners[booking.match_id] || booking.competition_id || null,
        owner_resolution: bookingMatchOwners[booking.match_id] ? "match" : (booking.competition_id ? "booking" : "unresolved")
      }));
      const ownerCompetitionIds = [...new Set(resolvedBookings.map(booking => booking.competition_id).filter(Boolean))];
      let ownerCompetitionNames = {};
      if (ownerCompetitionIds.length) {
        const { data: ownerCompetitions, error: ownerCompetitionError } = await supabase
          .from("competitions").select("id,name").in("id", ownerCompetitionIds);
        if (ownerCompetitionError) {
          // Capacity calculations can still use IDs; names are diagnostic only.
          ownerCompetitionNames = {};
        } else {
          ownerCompetitionNames = Object.fromEntries((ownerCompetitions || []).map(item => [item.id, item.name || "Unnamed competition"]));
        }
      }
      const bookingsWithOwners = resolvedBookings.map(booking => ({
        ...booking,
        competition_name: ownerCompetitionNames[booking.competition_id] ||
          (booking.competition_id ? `Unknown competition (${String(booking.competition_id).slice(0, 8)})` :
            `Unlinked booking (${String(booking.id).slice(0, 8)})`)
      }));

      setCompetition(competitionRes.data || { id: competitionId, name: "Competition" });
      const loadedTeams = teamsRes.data || [];
      setCompetitionTeams(loadedTeams);
      setSections(sectionsRes.data || []);
      setSectionVenueIds(Object.fromEntries((sectionVenuesRes.data || []).map(row => [row.section_id, row.club_id])));
      setSectionGreenIds(Object.fromEntries((sectionVenuesRes.data || []).filter(row => row.green_id).map(row => [row.section_id, row.green_id])));
      setPlayoffVenueIds(Object.fromEntries((playoffVenuesRes.data || []).map(row => [row.round_id, row.club_id])));
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
      setBookings(bookingsWithOwners);
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
  const isSectionalFixture = row => Boolean(
    row.section_id &&
    sections.some(section => section.id === row.section_id) &&
    !/playoff|quarter.?final|semi.?final|grand.?final|final/i.test(row.round_name || "")
  );
  const sectionalScheduledMatches = useMemo(() => scheduledMatches.filter(row => isSectionalFixture(row)), [scheduledMatches, sections]);
  const playoffScheduledMatches = useMemo(() => scheduledMatches.filter(row => !isSectionalFixture(row)), [scheduledMatches, sections]);
  const sectionalMatchIds = useMemo(() => new Set(scheduledMatches.filter(row => isSectionalFixture(row)).map(row => row.id)), [scheduledMatches, sections]);
  const playoffMatchIds = useMemo(() => new Set(scheduledMatches.filter(row => !isSectionalFixture(row)).map(row => row.id)), [scheduledMatches, sections]);
  const ignoredStaleMatchCount = matches.length - validMatches.length;
  const greenById = useMemo(() => new Map(greens.map(g => [g.id, g])), [greens]);
  const allocationByMatch = useMemo(() => new Map(allocations.map(a => [a.match_id, a])), [allocations]);
  const eligibleClubs = useMemo(() => clubs.filter(c => greens.some(g => g.club_id === c.id)), [clubs, greens]);
  const selectedGreens = useMemo(() => greens.filter(g => selectedClubIds.includes(g.club_id)), [greens, selectedClubIds]);

  // Assign every section to exactly one green for the whole sectional stage.
  // This uses a backtracking capacity search: a locally attractive green choice
  // must not prevent a valid overall split across the club's other greens.
  const buildSectionGreenMap = (venueIds, savedGreenIds = sectionGreenIds) => {
    const sectionsByClub = new Map();
    for (const section of [...sections].sort((a, b) =>
      (a.section_number || 0) - (b.section_number || 0)
    )) {
      const clubId = venueIds[section.id];
      if (!clubId) continue;
      if (!sectionsByClub.has(clubId)) sectionsByClub.set(clubId, []);
      sectionsByClub.get(clubId).push(section);
    }

    const roundDayOrder = new Map();
    const dayRoundGroups = new Map();
    rounds.forEach(round => {
      if (!round.day?.playing_date) return;
      const dateKey = String(round.day.playing_date);
      if (!dayRoundGroups.has(dateKey)) dayRoundGroups.set(dateKey, []);
      dayRoundGroups.get(dateKey).push(round);
    });
    for (const group of dayRoundGroups.values()) {
      group.sort((a, b) => (a.round_number || 0) - (b.round_number || 0))
        .forEach((round, index) => roundDayOrder.set(round.id, Math.min(index, SESSIONS.length - 1)));
    }

    const demandBySection = new Map(sections.map(section => [section.id, new Map()]));
    // Count only fixtures that can actually be allocated. Stale fixtures with
    // missing/withdrawn teams must not consume phantom green capacity.
    for (const match of scheduledMatches) {
      if (!match.section_id || !demandBySection.has(match.section_id)) continue;
      const round = match.round || rounds.find(item => item.id === match.round_id);
      if (!round?.day?.playing_date) continue;
      const session = SESSIONS[roundDayOrder.get(round.id) ?? 0];
      const existingBooking = bookings.find(booking =>
        booking.match_id === match.id &&
        booking.competition_id === competitionId &&
        booking.status !== "cancelled" &&
        !playoffMatchIds.has(booking.match_id)
      );
      const date = existingBooking?.playing_date || round.day.playing_date;
      const startsAt = existingBooking?.starts_at || localIso(date, session.start);
      const endsAt = existingBooking?.ends_at || localIso(date, session.end);
      const direction = Number(existingBooking?.direction || session.direction || 1);
      const slotKey = `${date}|${startsAt}|${endsAt}|${direction}`;
      const sectionDemand = demandBySection.get(match.section_id);
      sectionDemand.set(slotKey, (sectionDemand.get(slotKey) || 0) + 1);
    }

    const result = {};
    for (const [clubId, clubSections] of sectionsByClub) {
      const clubGreens = greens
        .filter(green => green.club_id === clubId && green.active && green.rinks.length)
        .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" }));
      if (!clubGreens.length) {
        throw new Error(`${clubs.find(club => club.id === clubId)?.name || "The selected club"} has no active greens with active rinks.`);
      }

      const loads = clubSections.map(section => {
        const slots = demandBySection.get(section.id) || new Map();
        return {
          section,
          slots,
          peak: Math.max(0, ...slots.values()),
          total: [...slots.values()].reduce((sum, count) => sum + count, 0),
        };
      }).sort((a, b) => b.peak - a.peak || b.total - a.total ||
        (a.section.section_number || 0) - (b.section.section_number || 0));

      const capacityCache = new Map();
      const capacityFor = (green, slotKey) => {
        const cacheKey = `${green.id}|${slotKey}`;
        if (capacityCache.has(cacheKey)) return capacityCache.get(cacheKey);
        const [, startsAt, endsAt, directionText] = slotKey.split("|");
        const direction = Number(directionText);
        if (direction === 2 && !green.allows_direction_change) {
          capacityCache.set(cacheKey, 0);
          return 0;
        }
        const external = bookings.filter(booking =>
          (booking.competition_id !== competitionId || playoffMatchIds.has(booking.match_id)) &&
          booking.status !== "cancelled" &&
          booking.green_id === green.id &&
          overlaps(startsAt, endsAt, booking.starts_at, booking.ends_at)
        );
        const capacity = external.some(booking => Number(booking.direction) !== direction)
          ? 0
          : green.rinks.filter(rink => !external.some(booking => booking.rink_id === rink.id)).length;
        capacityCache.set(cacheKey, capacity);
        return capacity;
      };

      const assignedLoad = new Map(clubGreens.map(green => [green.id, new Map()]));
      const clubPlan = {};
      let searchNodes = 0;
      const maxSearchNodes = 200000;
      const search = index => {
        if (index >= loads.length) return true;
        if (++searchNodes > maxSearchNodes) return false;
        const load = loads[index];
        const savedId = savedGreenIds?.[load.section.id];
        const candidates = clubGreens.filter(green =>
          [...load.slots.entries()].every(([slot, count]) => {
            const alreadyAssigned = assignedLoad.get(green.id).get(slot) || 0;
            return alreadyAssigned + count <= capacityFor(green, slot);
          })
        ).sort((a, b) => {
          const score = green => {
            const current = assignedLoad.get(green.id);
            let peak = 0;
            for (const [slot, count] of load.slots) {
              peak = Math.max(peak, ((current.get(slot) || 0) + count) / Math.max(1, capacityFor(green, slot)));
            }
            return peak;
          };
          const scoreDiff = score(a) - score(b);
          if (Math.abs(scoreDiff) > 0.000001) return scoreDiff;
          if (a.id === savedId) return -1;
          if (b.id === savedId) return 1;
          return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" });
        });

        for (const green of candidates) {
          clubPlan[load.section.id] = green.id;
          const current = assignedLoad.get(green.id);
          for (const [slot, count] of load.slots) current.set(slot, (current.get(slot) || 0) + count);
          if (search(index + 1)) return true;
          for (const [slot, count] of load.slots) {
            const remaining = (current.get(slot) || 0) - count;
            if (remaining > 0) current.set(slot, remaining);
            else current.delete(slot);
          }
          delete clubPlan[load.section.id];
        }
        return false;
      };

      if (!search(0)) {
        const demandSummary = loads.map(load => {
          const best = clubGreens.map(green => {
            const shortages = [...load.slots.entries()].map(([slot, count]) => ({
              slot,
              demand: count,
              capacity: capacityFor(green, slot),
            })).sort((a, b) => (a.capacity - a.demand) - (b.capacity - b.demand));
            return { green, worst: shortages[0] };
          }).sort((a, b) => (b.worst.capacity - b.worst.demand) - (a.worst.capacity - a.worst.demand))[0];
          return `${load.section.section_name || `Section ${load.section.section_number}`}: best option ${best.green.name}, peak demand ${best.worst.demand}, available ${best.worst.capacity}`;
        }).join("; ");
        throw new Error(
          `${clubs.find(club => club.id === clubId)?.name || "The selected club"} cannot fit all sections on its available greens for the full sectional schedule. ` +
          `BowlPoint tested whole-section assignments across ${clubGreens.map(green => green.name).join(", ")}. ` +
          `${searchNodes > maxSearchNodes ? "The search limit was reached. " : "No feasible fixed-green split was found. "}${demandSummary}`
        );
      }
      Object.assign(result, clubPlan);
    }
    return result;
  };

  const sectionGreenById = useMemo(() => {
    try { return buildSectionGreenMap(sectionVenueIds, sectionGreenIds); }
    catch { return {}; }
  }, [sections, sectionVenueIds, sectionGreenIds, greens, clubs, rounds, scheduledMatches, bookings, playoffMatchIds]);
  const proposedSectionGreenById = useMemo(() => {
    if (!venueProposalReady) return {};
    try { return buildSectionGreenMap(proposedSectionVenueIds, sectionGreenIds); }
    catch { return {}; }
  }, [venueProposalReady, proposedSectionVenueIds, sectionGreenIds, sections, greens, clubs, rounds, scheduledMatches, bookings, playoffMatchIds]);
  const toggleClub = (clubId, checked) => setSelectedClubIds(current => checked ? [...new Set([...current, clubId])] : current.filter(id => id !== clubId));

  const saveSectionVenues = async (next = sectionVenueIds, greenMap = sectionGreenIds) => {
    const payload = sections.filter(section => next[section.id]).map(section => ({
      competition_id: competitionId,
      section_id: section.id,
      club_id: next[section.id],
      green_id: greenMap[section.id] || null,
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
      const hostCount = new Map();
      let searchNodes = 0;
      const maxSearchNodes = 100000;

      const findHostPlan = (sectionIndex) => {
        if (sectionIndex >= orderedSections.length) return true;
        searchNodes += 1;
        if (searchNodes > maxSearchNodes) return false;

        const section = orderedSections[sectionIndex];
        const demand = new Map();
        for (const slot of slotRows) {
          const count = slot.items.filter(row => row.section_id === section.id).length;
          if (count) demand.set(slot.key, count);
        }

        const candidates = selectedClubIds.map(clubId => {
          let feasible = true;
          let slack = 0;
          let peakUtilisation = 0;
          for (const [slotKey, count] of demand) {
            const capacity = clubCapacityBySlot.get(`${clubId}|${slotKey}`) || 0;
            const current = assignedSlotLoad.get(`${clubId}|${slotKey}`) || 0;
            if (current + count > capacity) feasible = false;
            slack += capacity - current - count;
            peakUtilisation = Math.max(
              peakUtilisation,
              (current + count) / Math.max(1, capacity)
            );
          }
          return {
            clubId,
            feasible,
            slack,
            peakUtilisation,
            load: assignedClubLoad.get(clubId) || 0,
            currentHostCount: hostCount.get(clubId) || 0
          };
        }).filter(candidate => candidate.feasible)
          // Prefer consolidating sections, but backtrack if that choice prevents
          // a complete venue plan. This avoids rejecting a feasible distribution
          // simply because an earlier section was assigned greedily.
          .sort((a, b) =>
            b.currentHostCount - a.currentHostCount ||
            b.load - a.load ||
            a.peakUtilisation - b.peakUtilisation ||
            b.slack - a.slack
          );

        for (const candidate of candidates) {
          const clubId = candidate.clubId;
          proposal[section.id] = clubId;
          hostCount.set(clubId, (hostCount.get(clubId) || 0) + 1);
          assignedClubLoad.set(
            clubId,
            (assignedClubLoad.get(clubId) || 0) + (loadForSection.get(section.id) || 0)
          );
          for (const [slotKey, count] of demand) {
            const key = `${clubId}|${slotKey}`;
            assignedSlotLoad.set(key, (assignedSlotLoad.get(key) || 0) + count);
          }

          if (findHostPlan(sectionIndex + 1)) return true;

          // Undo this choice and try the next eligible club.
          delete proposal[section.id];
          hostCount.set(clubId, Math.max(0, (hostCount.get(clubId) || 1) - 1));
          assignedClubLoad.set(
            clubId,
            Math.max(0, (assignedClubLoad.get(clubId) || 0) - (loadForSection.get(section.id) || 0))
          );
          for (const [slotKey, count] of demand) {
            const key = `${clubId}|${slotKey}`;
            const remaining = (assignedSlotLoad.get(key) || 0) - count;
            if (remaining > 0) assignedSlotLoad.set(key, remaining);
            else assignedSlotLoad.delete(key);
          }
        }
        return false;
      };

      const planFound = findHostPlan(0);
      if (!planFound) {
        const individuallyImpossible = orderedSections.map(section => {
          const demand = new Map();
          for (const slot of slotRows) {
            const count = slot.items.filter(row => row.section_id === section.id).length;
            if (count) demand.set(slot.key, count);
          }
          const clubOptions = selectedClubIds.map(clubId => {
            let feasibleSlots = 0;
            let worstShortfall = 0;
            let worstSlot = null;
            for (const [slotKey, count] of demand) {
              const capacity = clubCapacityBySlot.get(`${clubId}|${slotKey}`) || 0;
              if (capacity >= count) feasibleSlots += 1;
              if (count - capacity > worstShortfall) {
                worstShortfall = count - capacity;
                worstSlot = { slotKey, demand: count, capacity };
              }
            }
            return { clubId, feasibleSlots, worstShortfall, worstSlot };
          });
          const best = clubOptions.sort((a, b) =>
            b.feasibleSlots - a.feasibleSlots || a.worstShortfall - b.worstShortfall
          )[0];
          return { section, demand, best };
        });

        const impossible = individuallyImpossible.find(item =>
          item.best && item.best.feasibleSlots < item.demand.size
        );

        if (impossible?.best?.worstSlot) {
          const [date, start] = impossible.best.worstSlot.slotKey.split("|");
          const clubName = clubs.find(club => club.id === impossible.best.clubId)?.name || "the best eligible club";
          throw new Error(
            `${clubName} cannot host ${impossible.section.section_name || `Section ${impossible.section.section_number}`} ` +
            `on ${date} at ${new Date(start).toLocaleTimeString("en-GB", { timeZone: "Africa/Johannesburg", hour: "2-digit", minute: "2-digit" })}: ` +
            `${impossible.best.worstSlot.demand} simultaneous games are required, but only ${impossible.best.worstSlot.capacity} compatible unbooked rinks are available. ` +
            `Select another eligible club, free additional rinks in the shared Facility Calendar, or adjust the schedule.`
          );
        }

        // Build a session-by-session capacity report so the user can see exactly
        // which other-competition bookings are reducing capacity at each venue.
        const slotDiagnostics = slotRows.map(slot => {
          const demand = slot.items.length;
          const clubDetails = selectedClubIds.map(clubId => {
            const club = clubs.find(item => item.id === clubId);
            const clubGreens = greens.filter(green => green.club_id === clubId && green.active && green.rinks.length);
            const greenDetails = clubGreens.map(green => {
              const external = bookings.filter(booking =>
                booking.competition_id !== competitionId && booking.status !== "cancelled" &&
                booking.green_id === green.id && overlaps(slot.start, slot.end, booking.starts_at, booking.ends_at)
              );
              const wrongDirection = external.some(booking => Number(booking.direction) !== slot.direction);
              const occupiedIds = new Set(external.map(booking => booking.rink_id).filter(Boolean));
              const free = slot.direction === 2 && !green.allows_direction_change ? 0 :
                wrongDirection ? 0 : green.rinks.filter(rink => !occupiedIds.has(rink.id)).length;
              const occupiedLabels = wrongDirection ? ["whole green blocked by opposite-direction booking"] :
                green.rinks.filter(rink => occupiedIds.has(rink.id)).map(rink => rink.label || rink.name || rink.id);
              const bookingOwners = [...new Set(external.map(booking => booking.competition_name || "Unlinked booking"))];
              return `${green.name}: ${free}/${green.rinks.length} free` +
                (occupiedLabels.length ? ` (occupied: ${occupiedLabels.join(", ")})` : "") +
                (bookingOwners.length ? ` [booked by: ${bookingOwners.join("; ")}]` : "") +
                (slot.direction === 2 && !green.allows_direction_change ? " (direction change not permitted)" : "");
            });
            return {
              name: club?.short_name || club?.name || "Club",
              capacity: clubCapacityBySlot.get(`${clubId}|${slot.key}`) || 0,
              greenDetails
            };
          });
          return {
            ...slot, demand,
            totalCapacity: clubDetails.reduce((sum, club) => sum + club.capacity, 0),
            clubDetails
          };
        });
        const bottlenecks = slotDiagnostics.filter(slot => slot.totalCapacity < slot.demand)
          .sort((a, b) => (a.totalCapacity - a.demand) - (b.totalCapacity - b.demand)).slice(0, 8);
        const reportSlots = bottlenecks.length ? bottlenecks : slotDiagnostics.slice(0, 8);
        const details = reportSlots.map(slot => {
          const time = new Date(slot.start).toLocaleTimeString("en-GB", {
            timeZone: "Africa/Johannesburg", hour: "2-digit", minute: "2-digit"
          });
          const clubsText = slot.clubDetails.map(club =>
            `${club.name}: ${club.capacity} free [${club.greenDetails.join("; ") || "no active greens"}]`
          ).join(" | ");
          return `${slot.key.split("|")[0]} ${time}, Direction ${slot.direction}: ${slot.demand} games required, ${slot.totalCapacity} free across selected clubs. ${clubsText}`;
        }).join("\n");
        const reason = bottlenecks.length
          ? "At least one session has fewer free rinks than simultaneous games required."
          : "Each session has enough combined free rinks in isolation, but no fixed section-to-club arrangement works across every session. A supporting club may have spare rinks on some rounds but not all; sections must remain at one club throughout sectional play.";
        throw new Error(
          `BowlPoint could not find a complete section-to-club arrangement using ${selectedClubIds.length} selected eligible club(s). ${reason} ` +
          `Search steps: ${Math.min(searchNodes, maxSearchNodes)}.\n\nCapacity breakdown:\n${details}\n\n` +
          `Review the listed bookings in the Shared Facility Calendar or select another eligible club. No venue changes have been saved.`
        );
      }
      setProposedSectionVenueIds(proposal);
      setVenueProposalReady(true);
      setNotice("Host-club proposal prepared. Each section stays at one club for all sectional rounds. Review the proposal and approve it before allocating individual rinks.");
    } catch (e) { setError(e.message); }
  };

  const validateSectionHostCapacity = (proposal) => {
    const rows = buildInitialRows().filter(isSectionalFixture);
    const sectionGreenMap = buildSectionGreenMap(proposal, proposal === sectionVenueIds ? sectionGreenIds : {});
    const slotLoads = new Map();
    for (const row of rows) {
      const greenId = sectionGreenMap[row.section_id];
      const key = `${greenId}|${row.playing_date}|${row.starts_at}|${row.ends_at}|${Number(row.direction)}`;
      slotLoads.set(key, (slotLoads.get(key) || 0) + 1);
    }
    for (const [key, demand] of slotLoads) {
      const [greenId, date, start, end, direction] = key.split("|");
      const green = greens.find(item => item.id === greenId);
      const usableRinks = green && (Number(direction) !== 2 || green.allows_direction_change)
        ? green.rinks.filter(rink => !bookings.some(b =>
            (b.competition_id !== competitionId || playoffMatchIds.has(b.match_id)) &&
            b.status !== "cancelled" &&
            b.green_id === green.id &&
            overlaps(start, end, b.starts_at, b.ends_at) &&
            (Number(b.direction) !== Number(direction) || b.rink_id === rink.id)
          ))
        : [];
      if (demand > usableRinks.length) {
        const club = clubs.find(c => c.id === green?.club_id)?.name || "Selected club";
        throw new Error(`${club} — ${green?.name || "assigned green"} cannot accommodate ${demand} simultaneous fixture(s) for its assigned sections on ${date} at ${start}. Only ${usableRinks.length} compatible rinks are available on this green. Sections cannot move between greens during the competition; choose another host-club arrangement or review the facility calendar.`);
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
      const proposedGreenMap = buildSectionGreenMap(proposedSectionVenueIds, {});
      validateSectionHostCapacity(proposedSectionVenueIds);
      await saveSectionVenues(proposedSectionVenueIds, proposedGreenMap);
      setSectionVenueIds({ ...proposedSectionVenueIds });
      setSectionGreenIds(proposedGreenMap);
      setVenueProposalReady(false);
      setAllocations([]);
      setNotice("Section host clubs saved. Every section now has one fixed host club and a balanced, permanent green assignment for the entire sectional stage. You can now allocate rinks within those greens.");
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
      const isPlayoff = !isSectionalFixture({ section_id: m.section_id, round_name: m.round.round_name || "" });
      const savedPlayoffClubId = isPlayoff ? playoffVenueIds[m.round_id] : null;
      return {
        match_id: m.id, round_id: m.round_id, section_id: m.section_id || null, round_number: m.round.round_number,
        match_number: m.match_number, round_name: m.round.round_name || "", team_a_id: m.team_a_id, team_b_id: m.team_b_id,
        team_a_label: labelTeam(m.teamA), team_b_label: labelTeam(m.teamB),
        playing_date: date, venue_club_id: savedPlayoffClubId || oldGreen?.club_id || m.round.day?.venue_club_id || "",
        venue_name: clubs.find(club => club.id === savedPlayoffClubId)?.name || oldGreen?.clubs?.name || m.round.day?.clubs?.name || "Not yet allocated",
        session_name: session.name,
        starts_at: old?.starts_at || localIso(date, session.start),
        ends_at: old?.ends_at || localIso(date, session.end),
        green_id: old?.green_id || "", rink_id: old?.rink_id || "", direction: session.direction,
        booking_id: old?.id || null, status: old?.status || "confirmed", notes: old?.notes || "",
      };
    });
  };

  const savePlayoffVenues = async () => {
    setSavingPlayoffVenues(true); setError(""); setNotice("");
    try {
      const playoffRounds = rounds.filter(round => /playoff|quarter.?final|semi.?final|grand.?final|final/i.test(round.round_name || ""));
      const payload = playoffRounds.filter(round => playoffVenueIds[round.id]).map(round => ({ competition_id: competitionId, round_id: round.id, club_id: playoffVenueIds[round.id] }));
      if (payload.length) {
        const { error: upsertError } = await supabase.from("competition_playoff_venues").upsert(payload, { onConflict: "competition_id,round_id" });
        if (upsertError) throw upsertError;
      }
      setNotice("Playoff venues saved. Existing rink bookings have not been changed.");
    } catch (e) { setError(`Unable to save playoff venues: ${e.message}`); }
    finally { setSavingPlayoffVenues(false); }
  };

  const runAutoAllocation = async () => {
    setAllocationAttempted(true);
    setAllocating(true); setError(""); setNotice("");
    try {
      const rows = buildInitialRows().filter(row => activeStage === "sectional" ? isSectionalFixture(row) : !isSectionalFixture(row)).sort((a, b) => `${a.playing_date}:${a.starts_at}:${a.round_number}:${a.match_number}`.localeCompare(`${b.playing_date}:${b.starts_at}:${b.round_number}:${b.match_number}`));
      if (!rows.length) throw new Error("No fixtures have both teams and a saved playing date. Confirm the draw and save the playing dates first.");
      if (!selectedClubIds.length) throw new Error("Select the clubs that are permitted to host this competition before allocating rinks.");
      const isSectionalRow = isSectionalFixture;
      const sectionGreenMap = activeStage === "sectional" ? buildSectionGreenMap(sectionVenueIds, sectionGreenIds) : {};
      if (activeStage === "sectional" && Object.keys(sectionGreenMap).some(sectionId => sectionGreenIds[sectionId] !== sectionGreenMap[sectionId])) {
        await saveSectionVenues(sectionVenueIds, sectionGreenMap);
        setSectionGreenIds(sectionGreenMap);
      }
      const externalBookings = bookings.filter(b => b.status !== "cancelled" && (b.competition_id !== competitionId || (activeStage === "sectional" ? playoffMatchIds.has(b.match_id) : sectionalMatchIds.has(b.match_id))));
      const teamRinkHistory = new Map();
      const planned = [];
      for (const row of rows) {
        const afternoon = Number(row.direction) === 2 || row.session_name.startsWith("Afternoon");
        const desiredDirection = afternoon ? 2 : 1;
        // Keep the existing section venue. For playoffs/non-sectional matches, use
        // the current booking's venue or the saved round-day venue. Never randomize.
        const assignedSectionClub = isSectionalRow(row) ? sectionVenueIds[row.section_id] : null;
        const fixedVenueClub = assignedSectionClub || (activeStage === "playoff" ? playoffVenueIds[row.round_id] : null) || row.venue_club_id || null;
        if (isSectionalRow(row) && !assignedSectionClub) {
          const section = sections.find(item => item.id === row.section_id);
          throw new Error(`No saved host venue is assigned to ${section?.section_name || "a section"}. Set the section venue first; rink-only allocation will not change it.`);
        }
        if (!fixedVenueClub) {
          throw new Error(`No existing venue could be resolved for Round ${row.round_number}, ${row.team_a_label} vs ${row.team_b_label}. Assign its venue first; rink-only allocation will not choose a new venue.`);
        }
        const pinnedGreenId = isSectionalRow(row) ? sectionGreenMap[row.section_id] : null;
        const candidates = selectedGreens.filter(g =>
          g.active &&
          g.club_id === fixedVenueClub &&
          (!pinnedGreenId || g.id === pinnedGreenId) &&
          (!afternoon || g.allows_direction_change)
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
          const relevantHistory = [row.team_a_id, row.team_b_id]
            .filter(Boolean)
            .flatMap(id => (teamRinkHistory.get(id) || []).filter(previous => previous.rink_id === c.rink.id));
          const repeated = relevantHistory.length > 0;
          const sameDirectionRepeat = relevantHistory.some(previous => Number(previous.direction) === desiredDirection);
          const currentPartOfDay = /afternoon/i.test(row.session_name || "") ? "afternoon" : "morning";
          const samePartOfDayRepeat = relevantHistory.some(previous =>
            Number(previous.direction) === desiredDirection && previous.part_of_day === currentPartOfDay
          );
          const repeatPenalty = !repeated ? 0
            : !sameDirectionRepeat ? 20
            : samePartOfDayRepeat ? 100 : 50;
          const sameVenueRinkLoad = planned.filter(b => b.green_id === c.green.id && b.rink_id === c.rink.id).length;
          return { ...c, conflict, repeated, score: (conflict ? 100000 : 0) + repeatPenalty * 100 + sameVenueRinkLoad };
        }).filter(c => !c.conflict).sort((a, b) => a.score - b.score || a.green.name.localeCompare(b.green.name) || a.rink.label.localeCompare(b.rink.label, undefined, { numeric: true }));
        if (!ranked.length) throw new Error(`No available rink at the saved venue for Round ${row.round_number}, ${row.team_a_label} vs ${row.team_b_label} on ${row.playing_date}. Check the shared calendar or adjust the facility configuration. Existing venues and times have not been changed.`);
        const chosen = ranked[0];
        const allocation = { ...row, venue_club_id: chosen.green.club_id, venue_name: chosen.green.clubs?.name || row.venue_name || "Club", green_id: chosen.green.id, rink_id: chosen.rink.id, direction: desiredDirection, repeat_warning: chosen.repeated };
        planned.push(allocation);
        for (const teamId of [row.team_a_id, row.team_b_id].filter(Boolean)) {
          if (!teamRinkHistory.has(teamId)) teamRinkHistory.set(teamId, []);
          teamRinkHistory.get(teamId).push({
            rink_id: chosen.rink.id,
            direction: desiredDirection,
            part_of_day: /afternoon/i.test(row.session_name || "") ? "afternoon" : "morning"
          });
        }
      }
      setAllocations(planned);
      const repeats = planned.filter(p => p.repeat_warning).length;
      setNotice(`Prepared ${planned.length} ${activeStage} rink-only allocations. Existing bookings for the other stage are untouched. Section venues and saved fixture dates/times are preserved. ${repeats ? `${repeats} rink repeat(s) remain because of capacity or availability; review before saving.` : "No team rink repeats were found."} Review the assignments before saving.`);
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
      // Stage-scoped save: only match IDs in this stage's payload are replaced.
      // Existing bookings for the other stage and unrelated matches retain their
      // original database rows and IDs.
      const { error: saveError } = await supabase.rpc("save_competition_facility_bookings_for_matches", {
        p_competition_id: competitionId,
        p_bookings: payloads,
      });
      if (saveError) throw saveError;
      setNotice(`${activeStage === "sectional" ? "Sectional" : "Playoff"} rink allocations saved. Only the fixtures in this allocation were replaced; all other existing bookings were left untouched.`);
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
    {!loading && allocationAttempted && ignoredStaleMatchCount > 0 && <div className="alert alert-warning" role="alert">
      {ignoredStaleMatchCount} fixture(s) were ignored because one or both assigned teams are missing or are no longer active in this competition. They will not be included in rink allocation.
    </div>}
    {loading ? <div className="text-muted">Loading competition fixtures and facilities…</div> : <>
      <div className="btn-group mb-4" role="group" aria-label="Allocation stage">
        <button type="button" className={`btn ${activeStage === "sectional" ? "btn-primary" : "btn-outline-primary"}`} onClick={() => { if (allocations.length && !window.confirm("Discard the unsaved allocation draft and switch stages? Saved bookings will not be changed.")) return; setActiveStage("sectional"); setAllocations([]); setAllocationAttempted(false); setError(""); setNotice(""); }}>Sectional Allocation ({sectionalScheduledMatches.length})</button>
        <button type="button" className={`btn ${activeStage === "playoff" ? "btn-primary" : "btn-outline-primary"}`} onClick={() => { if (allocations.length && !window.confirm("Discard the unsaved allocation draft and switch stages? Saved bookings will not be changed.")) return; setActiveStage("playoff"); setAllocations([]); setAllocationAttempted(false); setError(""); setNotice(""); }}>Playoff Allocation ({playoffScheduledMatches.length})</button>
      </div>
      <div className="alert alert-info py-2">Changing tabs does not alter saved bookings. Saving an allocation only replaces bookings for the fixtures shown in the selected stage.</div>
      {activeStage === "sectional" ? <>
      <div className="card border-0 shadow-sm mb-4"><div className="card-body">
        <div className="d-flex flex-wrap align-items-start justify-content-between gap-3">
          <div>
            <h5 className="mb-1">Eligible Clubs</h5>
            <p className="text-muted small mb-0">Choose any club that may host a section, including clubs already hosting another competition. BowlPoint checks the shared Facility Calendar and uses only genuinely available rinks. Each section stays at one host club and one assigned green for the entire sectional competition.</p>
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
              const assignedGreenId = venueProposalReady
                ? proposedSectionGreenById[section.id]
                : sectionGreenById[section.id];
              const assignedGreen = greens.find(green => green.id === assignedGreenId);
              return <div className="col-md-6 col-xl-4" key={section.id}>
                <div className="border rounded p-3 h-100">
                  <div className="fw-semibold mb-2">{section.section_name || `Section ${section.section_number}`}</div>
                  {venueProposalReady ? <select className="form-select" value={currentId} onChange={e => setProposedSectionVenueIds(current => ({ ...current, [section.id]: e.target.value }))}>
                    <option value="">Choose host club</option>
                    {clubs.filter(club => eligibleClubs.some(item => item.id === club.id)).map(club => <option key={club.id} value={club.id}>{club.name}</option>)}
                  </select> : <div>{host?.name || <span className="text-danger">No host club saved</span>}</div>}
                  {assignedGreen ? <div className="small mt-2"><span className="text-muted">Assigned green:</span> <strong>{assignedGreen.name}</strong></div> : <div className="small text-warning mt-2">Green assignment will be calculated from section demand and available rink capacity.</div>}
                  {sectionHasProposal && <div className="small text-muted mt-1">Proposed host and green for all sectional dates</div>}
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
      </> : <div className="card border-0 shadow-sm mb-4"><div className="card-header bg-white"><h5 className="mb-1">Playoff Round Venues</h5><div className="small text-muted">Choose a venue independently for each playoff round. This does not change sectional host clubs or existing rink bookings.</div></div><div className="card-body"><div className="row g-3">{rounds.filter(round => /playoff|quarter.?final|semi.?final|grand.?final|final/i.test(round.round_name || "")).map(round => <div className="col-md-6 col-xl-4" key={round.id}><label className="form-label fw-semibold">{round.round_name}</label><select className="form-select" value={playoffVenueIds[round.id] || ""} onChange={e => setPlayoffVenueIds(current => ({ ...current, [round.id]: e.target.value }))}><option value="">Use round's scheduled venue</option>{eligibleClubs.map(club => <option key={club.id} value={club.id}>{club.name}</option>)}</select></div>)}</div><button type="button" className="btn btn-outline-primary mt-3" onClick={savePlayoffVenues} disabled={savingPlayoffVenues}>{savingPlayoffVenues ? "Saving venues…" : "Save Playoff Venues"}</button></div></div>}
      <div className="card border-0 shadow-sm mb-4"><div className="card-body">
        <div className="row g-3 align-items-center">
          <div className="col-md"><div className="fw-semibold">Fixtures ready for allocation</div><div className="text-muted small">Only matches in the selected stage with both teams and a saved date are allocated. Existing fixture dates/times and saved venues are retained; only greens and rinks are regenerated.</div></div>
          <div className="col-md-auto"><span className="badge bg-primary me-2">{(activeStage === "sectional" ? sectionalScheduledMatches : playoffScheduledMatches).length} ready</span>{missingScheduleCount > 0 && <span className="badge bg-warning text-dark">{missingScheduleCount} need dates</span>}</div>
          <div className="col-md-auto"><button className="btn btn-primary" onClick={runAutoAllocation} disabled={allocating || !(activeStage === "sectional" ? sectionalScheduledMatches : playoffScheduledMatches).length || !selectedClubIds.length || (activeStage === "sectional" && sections.some(section => !sectionVenueIds[section.id]))}>{allocating ? <><span className="spinner-border spinner-border-sm me-2"/>Allocating…</> : <><i className="bi bi-magic me-2"/>Automatically Allocate Rinks</>}</button></div>
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
              <td><select className="form-select form-select-sm" value={a.green_id} onChange={e => updateAllocation(a.match_id, "green_id", e.target.value)}><option value="">Select green</option>{greensForSelectedClubs.filter(g => !isSectionalFixture(a) || !sectionGreenById[a.section_id] || g.id === sectionGreenById[a.section_id]).map(g => <option key={g.id} value={g.id}>{g.clubs?.short_name || g.clubs?.name || "Club"} — {g.name}</option>)}</select></td>
              <td><select className="form-select form-select-sm" value={a.rink_id} onChange={e => updateAllocation(a.match_id, "rink_id", e.target.value)}><option value="">Select rink</option>{rinksForGreen(a.green_id).map(r => <option key={r.id} value={r.id}>{r.label}</option>)}</select></td>
              <td><select className="form-select form-select-sm" value={a.direction} onChange={e => updateAllocation(a.match_id, "direction", Number(e.target.value))}><option value={1}>Direction 1 (lengthwise)</option><option value={2} disabled={!greenById.get(a.green_id)?.allows_direction_change}>Direction 2 (across green)</option></select></td>
              <td>{a.repeat_warning ? <span className="badge bg-warning text-dark">Rink repeat</span> : <span className="badge bg-success">No repeat found</span>}</td>
            </tr>)}
          </Fragment>)}
        </tbody></table></div><div className="card-footer bg-white small text-muted">Allocation is checked against bookings in every competition, including competitions already using the same club. Saving this stage does not replace bookings for the other stage.</div></div>}
      {!rowsToShow.length && <div className="alert alert-secondary">Generate an automatic allocation to review and save rink assignments for this competition.</div>}
    </>}
  </div>;
}
