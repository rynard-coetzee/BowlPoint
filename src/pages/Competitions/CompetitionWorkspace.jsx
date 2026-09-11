import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";
import { getPlayerDisplayName } from "../../utils/playerDisplay";

function getSectionByeTeam(section, roundNumber) {
    const roundMatches = (section?.matches || []).filter(
        match => (match.round?.round_number || 0) === Number(roundNumber)
    );

    if (!roundMatches.length || !(section?.teams || []).length) return null;

    const playingTeamIds = new Set();
    roundMatches.forEach(match => {
        if (match.team_a_id) playingTeamIds.add(match.team_a_id);
        if (match.team_b_id) playingTeamIds.add(match.team_b_id);
    });

    return (section.teams || []).find(team => !playingTeamIds.has(team.id)) || null;
}
import { generateCompetitionDrawProposal } from "./competitionDrawEngine";
import { buildCompetitionScheduleProposal } from "./competitionScheduleEngine";
import CompetitionLiveCard from "./CompetitionLiveCard";

function CompetitionWorkspace() {
    const { competitionId } = useParams();
    const navigate = useNavigate();

    const [competition, setCompetition] = useState(null);
    const [clubs, setClubs] = useState([]);
    const [participatingClubs, setParticipatingClubs] = useState([]);
    const [teams, setTeams] = useState([]);
    const [players, setPlayers] = useState([]);
    const [playingDays, setPlayingDays] = useState([]);
    const [rounds, setRounds] = useState([]);

    // Draw proposal state. This stage is deliberately local-only:
    // generating a proposal does NOT write sections, rounds or matches to Supabase.
    const [drawProposal, setDrawProposal] = useState(null);
    const [showDrawPlanner, setShowDrawPlanner] = useState(false);
    const [generatingDraw, setGeneratingDraw] = useState(false);
    const [confirmingDraw, setConfirmingDraw] = useState(false);
    const [confirmedDraw, setConfirmedDraw] = useState(null);
    const [scheduleProposal, setScheduleProposal] = useState(null);
    const [scheduleAssignments, setScheduleAssignments] = useState([]);

    // Results / live scoring state.
    const [selectedMatch, setSelectedMatch] = useState(null);
    const [resultForm, setResultForm] = useState({ score_a: "", score_b: "", skins_a: "", skins_b: "" });
    const [savingResult, setSavingResult] = useState(false);
    const [resultSavedMessage, setResultSavedMessage] = useState("");
    const [savingSchedule, setSavingSchedule] = useState(false);

    // Progressive workspace navigation. The active stage is determined from the
    // persisted tournament state so the secretary lands where work is needed.
    const [showSetupDetails, setShowSetupDetails] = useState(false);
    const [collapsedScoringSections, setCollapsedScoringSections] = useState({});
    const scoringSectionRefs = useRef({});
    const pendingSectionToggleRef = useRef(null);

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const [showClubForm, setShowClubForm] = useState(false);
    const [showTeamForm, setShowTeamForm] = useState(false);
    const [showDayForm, setShowDayForm] = useState(false);
    const [showRoundForm, setShowRoundForm] = useState(false);

    const [selectedClubIds, setSelectedClubIds] = useState([]);
    const [editingTeam, setEditingTeam] = useState(null);
    const [editingDay, setEditingDay] = useState(null);
    const [editingRound, setEditingRound] = useState(null);

    const [teamForm, setTeamForm] = useState({
        club_id: "",
        team_name: "",
        players: {}
    });

    const [dayForm, setDayForm] = useState({
        playing_date: "",
        name: "",
        venue_club_id: "",
        status: "scheduled"
    });

    const [roundForm, setRoundForm] = useState({
        competition_day_id: "",
        round_name: "",
        status: "pending"
    });

    /*
     * Positions for each competition format.
     */
    const getPositions = (format) => {
        const positions = {
            singles: [
                {
                    key: "player",
                    label: "Player",
                    order: 1
                }
            ],

            pairs: [
                {
                    key: "lead",
                    label: "Lead",
                    order: 1
                },
                {
                    key: "skip",
                    label: "Skip",
                    order: 2
                }
            ],

            trips: [
                {
                    key: "lead",
                    label: "Lead",
                    order: 1
                },
                {
                    key: "second",
                    label: "Second",
                    order: 2
                },
                {
                    key: "skip",
                    label: "Skip",
                    order: 3
                }
            ],

            fours: [
                {
                    key: "lead",
                    label: "Lead",
                    order: 1
                },
                {
                    key: "second",
                    label: "Second",
                    order: 2
                },
                {
                    key: "third",
                    label: "Third",
                    order: 3
                },
                {
                    key: "skip",
                    label: "Skip",
                    order: 4
                }
            ]
        };

        return positions[format] || positions.fours;
    };

    /*
     * Load all competition data.
     */
    const loadData = async () => {
        setLoading(true);

        const competitionResult = await supabase
            .from("competitions")
            .select("*")
            .eq("id", competitionId)
            .single();

        if (competitionResult.error) {
            console.error(
                "Error loading competition:",
                competitionResult.error
            );

            alert(
                `Unable to load competition.\n\n${competitionResult.error.message}`
            );

            setLoading(false);
            return;
        }

        const clubsResult = await supabase
            .from("clubs")
            .select("*")
            .eq("active", true)
            .order("name");

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

        const participatingResult = await supabase
            .from("competition_clubs")
            .select(`
                id,
                club_id,
                clubs (
                    id,
                    name,
                    short_name,
                    active
                )
            `)
            .eq("competition_id", competitionId)
            .order("created_at");

        if (participatingResult.error) {
            console.error(
                "Error loading participating clubs:",
                participatingResult.error
            );

            alert(
                `Unable to load participating clubs.\n\n${participatingResult.error.message}`
            );

            setLoading(false);
            return;
        }

        const playersResult = await supabase
            .from("players")
            .select(`
                id,
                first_name,
                nickname,
                last_name,
                display_name,
                club_id,
                active
            `)
            .eq("active", true)
            .order("last_name")
            .order("first_name");

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

        const teamsResult = await supabase
            .from("competition_teams")
            .select(`
                id,
                competition_id,
                club_id,
                team_number,
                team_name,
                status,
                created_at,
                clubs (
                    id,
                    name,
                    short_name
                ),
                competition_team_players (
                    id,
                    player_id,
                    position,
                    position_order,
                    players (
                        id,
                        first_name,
                        nickname,
                        last_name,
                        display_name
                    )
                )
            `)
            .eq("competition_id", competitionId)
            .order("team_number");

        if (teamsResult.error) {
            console.error(
                "Error loading teams:",
                teamsResult.error
            );

            alert(
                `Unable to load teams.\n\n${teamsResult.error.message}`
            );

            setLoading(false);
            return;
        }

        const daysResult = await supabase
            .from("competition_days")
            .select(`
                id,
                competition_id,
                day_number,
                playing_date,
                name,
                status,
                venue_club_id,
                clubs (
                    id,
                    name,
                    short_name
                )
            `)
            .eq("competition_id", competitionId)
            .order("day_number");

        if (daysResult.error) {
            console.error(
                "Error loading playing days:",
                daysResult.error
            );

            alert(
                `Unable to load playing days.\n\n${daysResult.error.message}`
            );

            setLoading(false);
            return;
        }

        const roundsResult = await supabase
            .from("competition_rounds")
            .select(`
                id,
                competition_id,
                competition_day_id,
                round_number,
                round_name,
                status,
                competition_days (
                    id,
                    day_number,
                    playing_date,
                    name,
                    venue_club_id,
                    clubs (
                        id,
                        name,
                        short_name
                    )
                )
            `)
            .eq("competition_id", competitionId)
            .order("round_number");

        if (roundsResult.error) {
            console.error(
                "Error loading rounds:",
                roundsResult.error
            );

            alert(
                `Unable to load rounds.\n\n${roundsResult.error.message}`
            );

            setLoading(false);
            return;
        }

        const sectionsResult = await supabase
            .from("competition_sections")
            .select("id, competition_id, section_number, section_name")
            .eq("competition_id", competitionId)
            .order("section_number");

        if (sectionsResult.error) {
            console.error("Error loading draw sections:", sectionsResult.error);
            alert(`Unable to load draw sections.\n\n${sectionsResult.error.message}`);
            setLoading(false);
            return;
        }

        const sectionIds = (sectionsResult.data || []).map(s => s.id);
        const sectionTeamsResult = sectionIds.length
            ? await supabase.from("competition_section_teams").select(`
                id, section_id, competition_team_id,
                competition_teams (id, team_number, team_name, club_id, clubs (id, name, short_name))
              `).in("section_id", sectionIds)
            : { data: [], error: null };

        if (sectionTeamsResult.error) {
            console.error("Error loading section teams:", sectionTeamsResult.error);
            alert(`Unable to load section teams.\n\n${sectionTeamsResult.error.message}`);
            setLoading(false);
            return;
        }

        const matchesResult = await supabase
            .from("competition_matches")
            .select("id, competition_id, round_id, section_id, match_number, team_a_id, team_b_id, score_a, score_b, skins_a, skins_b, completed, next_match_id, next_match_slot")
            .eq("competition_id", competitionId);

        if (matchesResult.error) {
            console.error("Error loading draw matches:", matchesResult.error);
            alert(`Unable to load draw matches.\n\n${matchesResult.error.message}`);
            setLoading(false);
            return;
        }

        const teamById = new Map((teamsResult.data || []).map(team => [team.id, team]));
        const roundById = new Map((roundsResult.data || []).map(round => [round.id, round]));
        const persistedSections = sectionsResult.data || [];
        const persistedMatches = matchesResult.data || [];

        setConfirmedDraw(persistedSections.length ? {
            sections: persistedSections.map(section => ({
                ...section,
                teams: (sectionTeamsResult.data || [])
                    .filter(row => row.section_id === section.id)
                    .map(row => {
                        const sectionTeam = row.competition_teams;
                        const fullTeam = teamById.get(row.competition_team_id);

                        // The section-team query only needs lightweight team data,
                        // so merge it with the fully-loaded competition team. This
                        // preserves competition_team_players for display-name
                        // fallbacks in standings and other section views.
                        if (fullTeam) {
                            return {
                                ...fullTeam,
                                ...(sectionTeam || {}),
                                competition_team_players: fullTeam.competition_team_players || []
                            };
                        }

                        return sectionTeam || null;
                    })
                    .filter(Boolean),
                matches: persistedMatches
                    .filter(match => match.section_id === section.id)
                    .map(match => ({ ...match, round: roundById.get(match.round_id), teamA: teamById.get(match.team_a_id), teamB: teamById.get(match.team_b_id) }))
            })),
            rounds: roundsResult.data || [],
            matches: persistedMatches.map(match => ({ ...match, round: roundById.get(match.round_id), teamA: teamById.get(match.team_a_id), teamB: teamById.get(match.team_b_id) }))
        } : null);

        setCompetition(competitionResult.data);
        setClubs(clubsResult.data || []);
        setParticipatingClubs(participatingResult.data || []);
        setPlayers(playersResult.data || []);
        setTeams(teamsResult.data || []);
        setPlayingDays(daysResult.data || []);
        setRounds(roundsResult.data || []);

        setLoading(false);
    };

    useEffect(() => {
        loadData();
    }, [competitionId]);

    const scheduleAssigned = Boolean(
        confirmedDraw?.rounds?.length &&
        confirmedDraw.rounds.every(round => round.competition_day_id)
    );

    // A round is sectional when its fixtures belong to a section.
    // Do not infer this from the round number: a single 5-team round robin
    // legitimately has 5 sectional rounds, so rounds 4 and 5 are still
    // sectional and must not be treated as playoffs.
    const sectionalMatches = confirmedDraw?.matches?.filter(match =>
        match.section_id !== null && match.section_id !== undefined
    ) || [];

    const playoffMatches = confirmedDraw?.matches?.filter(match =>
        match.section_id === null || match.section_id === undefined
    ) || [];

    const sectionalComplete = Boolean(
        confirmedDraw?.sections?.length &&
        confirmedDraw.sections.every(section => {
            const matches = sectionalMatches.filter(match => match.section_id === section.id);
            return matches.length > 0 && matches.every(match => match.completed);
        })
    );

    const workspaceStage = !confirmedDraw
        ? (teams.filter(team => team.status === "active").length >= 3 ? "draw" : "teams")
        : !scheduleAssigned
            ? "schedule"
            : sectionalComplete
                ? (playoffMatches.length > 0 ? "playoffs" : "scoring")
                : "scoring";

    const workspaceStageInfo = {
        teams: { label: "Teams", icon: "bi-people-fill", target: "workspace-teams" },
        draw: { label: "Draw", icon: "bi-diagram-3", target: confirmedDraw ? "workspace-draw-confirmed" : "workspace-draw-planner" },
        schedule: { label: "Schedule", icon: "bi-calendar3", target: "workspace-schedule" },
        scoring: { label: "Scoring", icon: "bi-pencil-square", target: "workspace-results" },
        playoffs: { label: "Playoffs", icon: "bi-trophy", target: "workspace-results" }
    };

    const focusWorkspaceStage = (stage) => {
        const info = workspaceStageInfo[stage];
        if (!info) return;
        const element = document.getElementById(info.target);
        if (element) {
            element.scrollIntoView({ behavior: "smooth", block: "start" });
        }
    };

    useEffect(() => {
        if (loading || !competition) return;
        const timer = setTimeout(() => focusWorkspaceStage(workspaceStage), 120);
        return () => clearTimeout(timer);
    }, [loading, workspaceStage]);

    useEffect(() => {
        // Automatically roll up a section once all of its sectional games are
        // complete, but only when the user has not manually chosen a state.
        // Leaving incomplete sections undefined is important: it means the
        // render below can derive their open/closed state from `complete`, so
        // the final saved result immediately causes an untouched section to
        // collapse without overwriting a user's manual expand/collapse choice.
        if (!confirmedDraw?.sections?.length) return;

        setCollapsedScoringSections(prev => {
            const next = { ...prev };
            let changed = false;

            confirmedDraw.sections.forEach(section => {
                if (next[section.id] !== undefined) return;

                const matches = sectionalMatches.filter(match => match.section_id === section.id);
                const complete = matches.length > 0 && matches.every(match => match.completed);

                if (complete) {
                    next[section.id] = true;
                    changed = true;
                }
            });

            return changed ? next : prev;
        });
    }, [confirmedDraw, sectionalMatches.length]);

    // Preserve the exact viewport position when a scoring accordion changes
    // height. Browser scroll anchoring can otherwise jump to the bottom/top
    // of the card when its table is inserted or removed.
    useLayoutEffect(() => {
        const pending = pendingSectionToggleRef.current;
        if (!pending) return;

        const element = scoringSectionRefs.current[pending.sectionId];
        if (!element) {
            pendingSectionToggleRef.current = null;
            return;
        }

        const afterTop = element.getBoundingClientRect().top;
        const delta = afterTop - pending.beforeTop;
        if (Math.abs(delta) > 0.5) {
            window.scrollBy(0, delta);
        }
        pendingSectionToggleRef.current = null;
    }, [collapsedScoringSections]);

    const toggleScoringSection = (sectionId) => {
        const element = scoringSectionRefs.current[sectionId];
        pendingSectionToggleRef.current = {
            sectionId,
            beforeTop: element?.getBoundingClientRect().top ?? 0
        };
        setCollapsedScoringSections(prev => ({
            ...prev,
            [sectionId]: !prev[sectionId]
        }));
    };

    useEffect(() => {
        if (!confirmedDraw?.rounds?.length) {
            setScheduleProposal(null);
            return;
        }

        try {
            setScheduleProposal(
                buildCompetitionScheduleProposal({
                    competitionType: competition?.schedule_type || "weekend",
                    rounds: confirmedDraw.rounds,
                    matches: confirmedDraw.matches || []
                })
            );
        } catch (error) {
            console.error("Error building schedule proposal:", error);
            setScheduleProposal(null);
        }
    }, [confirmedDraw, competition?.schedule_type]);

    useEffect(() => {
        if (!scheduleProposal?.days?.length) {
            setScheduleAssignments([]);
            return;
        }

        const assignments = scheduleProposal.days.map((day, index) => {
            const existing = playingDays.find(item => item.day_number === index + 1);

            return {
                key: day.key,
                dayNumber: index + 1,
                label: day.label,
                typeLabel: day.typeLabel,
                playing_date: existing?.playing_date || "",
                name: existing?.name || day.label,
                venue_club_id: existing?.venue_club_id || "",
                status: existing?.status || "scheduled",
                existing_id: existing?.id || null
            };
        });

        setScheduleAssignments(assignments);
    }, [scheduleProposal, playingDays]);

    const handleScheduleAssignmentChange = (index, field, value) => {
        setScheduleAssignments(prev => prev.map((assignment, itemIndex) =>
            itemIndex === index
                ? { ...assignment, [field]: value }
                : assignment
        ));
    };

    const isValidScheduleDate = (dateValue, dayLabel, competitionType) => {
        if (!dateValue) return false;

        const date = new Date(`${dateValue}T12:00:00`);
        const dayOfWeek = date.getDay();

        if (competitionType === "weekend") {
            if (dayLabel.includes("Saturday")) return dayOfWeek === 6;
            if (dayLabel.includes("Sunday")) return dayOfWeek === 0;
            return false;
        }

        return dayOfWeek !== 0 && dayOfWeek !== 6;
    };

    const handleSaveSchedule = async () => {
        if (!scheduleProposal?.days?.length) {
            alert("There is no schedule proposal to assign.");
            return;
        }

        const competitionType = scheduleProposal.competitionType;

        for (const assignment of scheduleAssignments) {
            if (!assignment.playing_date) {
                alert(`Please select a date for ${assignment.label}.`);
                return;
            }

            if (!assignment.venue_club_id) {
                alert(`Please select a venue for ${assignment.label}.`);
                return;
            }

            if (!isValidScheduleDate(assignment.playing_date, assignment.label, competitionType)) {
                if (competitionType === "weekend") {
                    const expected = assignment.label.includes("Saturday") ? "Saturday" : "Sunday";
                    alert(`${assignment.label} must be scheduled on a ${expected}.`);
                } else {
                    alert(`${assignment.label} must be scheduled on a weekday.`);
                }
                return;
            }
        }

        const dates = scheduleAssignments.map(assignment => assignment.playing_date);
        if (new Set(dates).size !== dates.length) {
            alert("Each tournament playing day must have a different date.");
            return;
        }

        const confirmed = window.confirm(
            `Save this tournament schedule?\n\n` +
            `${scheduleAssignments.length} playing day(s) will be created or updated, and the confirmed rounds will be assigned to those days.\n\n` +
            `Your confirmed draw and fixtures will not be changed.`
        );

        if (!confirmed) return;

        setSavingSchedule(true);

        try {
            const savedDays = [];

            for (const assignment of scheduleAssignments) {
                const payload = {
                    competition_id: competitionId,
                    day_number: assignment.dayNumber,
                    playing_date: assignment.playing_date,
                    name: assignment.name?.trim() || assignment.label,
                    venue_club_id: assignment.venue_club_id,
                    status: assignment.status || "scheduled",
                    updated_at: new Date().toISOString()
                };

                let result;

                if (assignment.existing_id) {
                    result = await supabase
                        .from("competition_days")
                        .update(payload)
                        .eq("id", assignment.existing_id)
                        .select(`
                            id,
                            competition_id,
                            day_number,
                            playing_date,
                            name,
                            status,
                            venue_club_id,
                            clubs (id, name, short_name)
                        `)
                        .single();
                } else {
                    result = await supabase
                        .from("competition_days")
                        .insert(payload)
                        .select(`
                            id,
                            competition_id,
                            day_number,
                            playing_date,
                            name,
                            status,
                            venue_club_id,
                            clubs (id, name, short_name)
                        `)
                        .single();
                }

                if (result.error) throw result.error;
                savedDays.push(result.data);
            }

            const dayByRoundNumber = new Map();
            scheduleProposal.days.forEach((day, index) => {
                const savedDay = savedDays[index];
                day.rounds.forEach(round => {
                    dayByRoundNumber.set(round.roundNumber, savedDay.id);
                });
            });

            for (const round of confirmedDraw.rounds) {
                const competitionDayId = dayByRoundNumber.get(round.round_number);

                if (!competitionDayId) {
                    throw new Error(`No playing day was assigned to Round ${round.round_number}.`);
                }

                const { error } = await supabase
                    .from("competition_rounds")
                    .update({
                        competition_day_id: competitionDayId,
                        updated_at: new Date().toISOString()
                    })
                    .eq("id", round.id);

                if (error) throw error;
            }

            alert("Schedule saved successfully. The confirmed rounds are now assigned to the selected dates and venues.");
            await loadData();
        } catch (error) {
            console.error("Error saving tournament schedule:", error);
            alert(`Unable to save tournament schedule.\\n\\n${error.message}`);
        } finally {
            setSavingSchedule(false);
        }
    };

    /*
     * Open a match for result entry.
     */
    const openResultEditor = (match) => {
        if (!match.team_a_id || !match.team_b_id) {
            alert("This fixture is waiting for the teams to be determined.");
            return;
        }

        setSelectedMatch(match);
        setResultForm({
            score_a: match.score_a ?? "",
            score_b: match.score_b ?? "",
            skins_a: match.skins_a ?? "",
            skins_b: match.skins_b ?? ""
        });
    };

    const closeResultEditor = () => {
        if (savingResult) return;
        setSelectedMatch(null);
        setResultForm({ score_a: "", score_b: "", skins_a: "", skins_b: "" });
    };

    const getMatchTeamName = (match, side) => {
        const teamId = side === "a" ? match?.team_a_id : match?.team_b_id;
        if (!teamId) return "TBD";
        const team = teams.find(item => item.id === teamId);
        return getTeamDisplayName(team);
    };

    const getSectionWinner = (sectionId, matchesOverride = null) => {
        const section = confirmedDraw?.sections?.find(item => item.id === sectionId);
        if (!section) return null;

        const sectionMatches = (matchesOverride || confirmedDraw.matches || [])
            .filter(match => match.section_id === sectionId);

        if (!sectionMatches.length || sectionMatches.some(match => !match.completed)) {
            return null;
        }

        const standings = section.teams.map(team => {
            const row = {
                teamId: team.id,
                team,
                played: 0,
                wins: 0,
                draws: 0,
                losses: 0,
                skinsWon: 0,
                points: 0,
                shotsFor: 0,
                shotsAgainst: 0,
                aggregate: 0
            };

            sectionMatches.forEach(match => {
                if (match.team_a_id !== team.id && match.team_b_id !== team.id) return;
                const isA = match.team_a_id === team.id;
                const sf = Number(isA ? match.score_a : match.score_b);
                const sa = Number(isA ? match.score_b : match.score_a);
                row.played += 1;
                row.shotsFor += sf;
                row.shotsAgainst += sa;
                if (competition.scoring?.skins?.enabled) {
                    row.skinsWon += Number(isA ? match.skins_a : match.skins_b) || 0;
                }
                if (sf > sa) {
                    row.wins += 1;
                    row.points += Number(competition.scoring?.win ?? 2);
                } else if (sf === sa) {
                    row.draws += 1;
                    row.points += Number(competition.scoring?.draw ?? 1);
                } else {
                    row.losses += 1;
                }

                if (competition.scoring?.skins?.enabled) {
                    const skinCount = Number(isA ? match.skins_a : match.skins_b) || 0;
                    row.points += skinCount * Number(competition.scoring?.skins?.pointsPerSkin ?? 1);
                }
            });

            row.aggregate = row.shotsFor - row.shotsAgainst;
            return row;
        }).sort((a, b) =>
            b.points - a.points ||
            b.aggregate - a.aggregate ||
            b.shotsFor - a.shotsFor ||
            a.team.team_number - b.team.team_number
        );

        return standings[0] || null;
    };

    const getSectionStandings = (sectionId) => {
        const section = confirmedDraw?.sections?.find(item => item.id === sectionId);
        if (!section) return [];
        const sectionMatches = (confirmedDraw.matches || []).filter(match => match.section_id === sectionId);

        return section.teams.map(team => {
            const row = {
                teamId: team.id,
                team,
                played: 0,
                wins: 0,
                draws: 0,
                losses: 0,
                skinsWon: 0,
                points: 0,
                shotsFor: 0,
                shotsAgainst: 0,
                aggregate: 0
            };

            sectionMatches.forEach(match => {
                if (!match.completed || (match.team_a_id !== team.id && match.team_b_id !== team.id)) return;
                const isA = match.team_a_id === team.id;
                const sf = Number(isA ? match.score_a : match.score_b);
                const sa = Number(isA ? match.score_b : match.score_a);
                row.played += 1;
                row.shotsFor += sf;
                row.shotsAgainst += sa;
                if (competition.scoring?.skins?.enabled) {
                    row.skinsWon += Number(isA ? match.skins_a : match.skins_b) || 0;
                }
                if (sf > sa) {
                    row.wins += 1;
                    row.points += Number(competition.scoring?.win ?? 2);
                } else if (sf === sa) {
                    row.draws += 1;
                    row.points += Number(competition.scoring?.draw ?? 1);
                } else {
                    row.losses += 1;
                }

                if (competition.scoring?.skins?.enabled) {
                    const skinCount = Number(isA ? match.skins_a : match.skins_b) || 0;
                    row.points += skinCount * Number(competition.scoring?.skins?.pointsPerSkin ?? 1);
                }
            });

            row.aggregate = row.shotsFor - row.shotsAgainst;
            return row;
        }).sort((a, b) =>
            b.points - a.points ||
            b.aggregate - a.aggregate ||
            b.shotsFor - a.shotsFor ||
            a.team.team_number - b.team.team_number
        );
    };

    const advanceWinner = async (matchId, winnerTeamId) => {
        const source = (confirmedDraw?.matches || []).find(match => match.id === matchId);
        if (!source?.next_match_id) return;

        const target = (confirmedDraw?.matches || []).find(match => match.id === source.next_match_id);
        if (!target) return;

        const field = source.next_match_slot === "B" ? "team_b_id" : "team_a_id";
        const { error } = await supabase
            .from("competition_matches")
            .update({ [field]: winnerTeamId })
            .eq("id", target.id);

        if (error) throw error;
    };

    const populateSectionWinner = async (sectionId, matchesAfterSave) => {
        const winner = getSectionWinner(sectionId, matchesAfterSave);
        if (!winner) return;

        const sectionNumber = confirmedDraw?.sections?.find(section => section.id === sectionId)?.section_number;
        if (!sectionNumber) return;

        const quarterFinalMap = {
            1: 1,
            3: 1,
            2: 2,
            4: 2,
            5: 3,
            7: 3,
            6: 4,
            8: 4
        };
        const matchNumber = quarterFinalMap[sectionNumber];
        if (!matchNumber) return;

        const quarterRound = confirmedDraw.rounds.find(round => round.round_number === 4);
        if (!quarterRound) return;

        const quarter = (matchesAfterSave || confirmedDraw.matches || []).find(match =>
            match.round_id === quarterRound.id && match.match_number === matchNumber
        );
        if (!quarter) return;

        const field = [1, 3, 5, 7].includes(sectionNumber) ? "team_a_id" : "team_b_id";
        const { error } = await supabase
            .from("competition_matches")
            .update({ [field]: winner.teamId })
            .eq("id", quarter.id);
        if (error) throw error;
    };

    const handleSaveResult = async (event) => {
        event.preventDefault();
        if (!selectedMatch) return;

        const scoreA = Number(resultForm.score_a);
        const scoreB = Number(resultForm.score_b);
        const skinsA = competition?.scoring?.skins?.enabled ? Number(resultForm.skins_a) : null;
        const skinsB = competition?.scoring?.skins?.enabled ? Number(resultForm.skins_b) : null;

        if (!Number.isInteger(scoreA) || !Number.isInteger(scoreB) || scoreA < 0 || scoreB < 0) {
            alert("Please enter valid non-negative whole-number scores for both teams.");
            return;
        }

        if (competition?.scoring?.skins?.enabled &&
            (!Number.isInteger(skinsA) || !Number.isInteger(skinsB) || skinsA < 0 || skinsB < 0)) {
            alert("Please enter valid non-negative whole-number skin scores for both teams.");
            return;
        }

        setSavingResult(true);

        try {
            const selectedRound = confirmedDraw.rounds.find(round => round.id === selectedMatch.round_id);
            const isPlayoff = Boolean(selectedRound && !selectedRound.round_name?.toLowerCase().includes("sectional"));

            if (isPlayoff && scoreA === scoreB) {
                alert("Playoff matches cannot finish level. Enter a result with a winning team.");
                setSavingResult(false);
                return;
            }

            const winPoints = Number(competition?.scoring?.win ?? 2);
            const drawPoints = Number(competition?.scoring?.draw ?? (winPoints / 2));
            const lossPoints = Number(competition?.scoring?.loss ?? 0);
            const pointsA = scoreA > scoreB ? winPoints : scoreA === scoreB ? drawPoints : lossPoints;
            const pointsB = scoreB > scoreA ? winPoints : scoreA === scoreB ? drawPoints : lossPoints;

            const { error } = await supabase
                .from("competition_matches")
                .update({
                    score_a: scoreA,
                    score_b: scoreB,
                    skins_a: skinsA,
                    skins_b: skinsB,
                    points_a: pointsA,
                    points_b: pointsB,
                    shots_for_a: scoreA,
                    shots_for_b: scoreB,
                    completed: true,
                    completed_at: new Date().toISOString()
                })
                .eq("id", selectedMatch.id);

            if (error) throw error;

            // Refresh all matches before deciding the competition status.
            // A competition is completed when every real competition match
            // has a result. Do not rely on a round being named "Final":
            // round-robin competitions (including single-group events) may
            // have no Final round at all.
            const refreshedMatchesResult = await supabase
                .from("competition_matches")
                .select("id, competition_id, round_id, section_id, match_number, team_a_id, team_b_id, score_a, score_b, skins_a, skins_b, points_a, points_b, shots_for_a, shots_for_b, completed, completed_at, next_match_id, next_match_slot")
                .eq("competition_id", competitionId);

            if (refreshedMatchesResult.error) throw refreshedMatchesResult.error;

            let refreshedMatches = refreshedMatchesResult.data || [];

            const hasMatches = refreshedMatches.length > 0;
            const allMatchesCompleted = hasMatches && refreshedMatches.every(match => match.completed === true);
            const newCompetitionStatus = allMatchesCompleted ? "completed" : "in_progress";

            const { error: competitionStatusError } = await supabase
                .from("competitions")
                .update({ status: newCompetitionStatus })
                .eq("id", competitionId);

            if (competitionStatusError) {
                console.warn("Unable to update competition status:", competitionStatusError);
            }

            const isSectional = Boolean(selectedRound?.round_name?.toLowerCase().includes("sectional"));
            let bracketChanged = false;

            if (selectedMatch.section_id && isSectional) {
                const beforeWinner = getSectionWinner(selectedMatch.section_id, refreshedMatches);
                await populateSectionWinner(selectedMatch.section_id, refreshedMatches);
                bracketChanged = Boolean(beforeWinner);
            } else {
                const winnerTeamId = scoreA > scoreB ? selectedMatch.team_a_id : scoreB > scoreA ? selectedMatch.team_b_id : null;
                if (winnerTeamId && selectedMatch.next_match_id) {
                    await advanceWinner(selectedMatch.id, winnerTeamId);
                    bracketChanged = true;
                }
            }

            // If a sectional winner or playoff winner was advanced, fetch the
            // match list once more so the local bracket reflects that change.
            if (bracketChanged) {
                const latestMatchesResult = await supabase
                    .from("competition_matches")
                    .select("id, competition_id, round_id, section_id, match_number, team_a_id, team_b_id, score_a, score_b, skins_a, skins_b, points_a, points_b, shots_for_a, shots_for_b, completed, completed_at, next_match_id, next_match_slot")
                    .eq("competition_id", competitionId);

                if (latestMatchesResult.error) throw latestMatchesResult.error;
                refreshedMatches = latestMatchesResult.data || [];
            }

            // Update only the scoring data in memory. This preserves the
            // current page position/section state and avoids a full workspace
            // reload after every result.
            const roundById = new Map((confirmedDraw.rounds || []).map(round => [round.id, round]));
            const teamById = new Map((teams || []).map(team => [team.id, team]));
            const enrichMatch = match => ({
                ...match,
                round: roundById.get(match.round_id),
                teamA: teamById.get(match.team_a_id),
                teamB: teamById.get(match.team_b_id)
            });

            setConfirmedDraw(prev => {
                if (!prev) return prev;

                const updatedMatches = refreshedMatches.map(enrichMatch);
                return {
                    ...prev,
                    matches: updatedMatches,
                    sections: prev.sections.map(section => ({
                        ...section,
                        matches: updatedMatches.filter(match => match.section_id === section.id)
                    }))
                };
            });

            setCompetition(prev => prev ? { ...prev, status: newCompetitionStatus } : prev);
            setSelectedMatch(null);
            setResultForm({ score_a: "", score_b: "", skins_a: "", skins_b: "" });
            setResultSavedMessage("Result saved successfully.");
            window.setTimeout(() => setResultSavedMessage(""), 1800);
        } catch (error) {
            console.error("Error saving result:", error);
            alert(`Unable to save result.\n\n${error.message}`);
        } finally {
            setSavingResult(false);
        }
    };

    /*
     * Reset team form.
     */
    const resetTeamForm = () => {
        setTeamForm({
            club_id: "",
            team_name: "",
            players: {}
        });

        setEditingTeam(null);
    };

    /*
     * Reset playing day form.
     */
    const resetDayForm = () => {
        setDayForm({
            playing_date: "",
            name: "",
            venue_club_id: "",
            status: "scheduled"
        });

        setEditingDay(null);
    };

    /*
     * Reset round form.
     */
    const resetRoundForm = () => {
        setRoundForm({
            competition_day_id: "",
            round_name: "",
            status: "pending"
        });

        setEditingRound(null);
    };

    /*
     * Add participating club.
     */
    const handleAddClub = async () => {
        if (!selectedClubIds.length) {
            alert("Please select at least one club.");
            return;
        }

        const availableClubIds = new Set(
            availableClubs.map(club => club.id)
        );

        const clubIdsToAdd = selectedClubIds.filter(
            clubId => availableClubIds.has(clubId)
        );

        if (!clubIdsToAdd.length) {
            alert("The selected clubs are already in this competition.");
            return;
        }

        setSaving(true);

        const rows = clubIdsToAdd.map(clubId => ({
            competition_id: competitionId,
            club_id: clubId
        }));

        const { error } = await supabase
            .from("competition_clubs")
            .insert(rows);

        setSaving(false);

        if (error) {
            console.error(
                "Error adding clubs:",
                error
            );

            alert(
                `Unable to add clubs.\n\n${error.message}`
            );

            return;
        }

        setSelectedClubIds([]);
        setShowClubForm(false);

        await loadData();
    };

    /*
     * Remove participating club.
     */
    const handleRemoveClub = async (entry) => {
        const clubName =
            entry.clubs?.name || "this club";

        const clubTeams = teams.filter(
            team =>
                team.club_id === entry.club_id
        );

        if (clubTeams.length > 0) {
            alert(
                `${clubName} has ${clubTeams.length} team(s) entered in this competition.\n\nRemove or withdraw those teams before removing the club.`
            );

            return;
        }

        const confirmed = window.confirm(
            `Remove ${clubName} from this competition?`
        );

        if (!confirmed) {
            return;
        }

        const { error } = await supabase
            .from("competition_clubs")
            .delete()
            .eq("id", entry.id);

        if (error) {
            console.error(
                "Error removing club:",
                error
            );

            alert(
                `Unable to remove club.\n\n${error.message}`
            );

            return;
        }

        await loadData();
    };

    /*
     * Start new team.
     */
    const handleAddTeam = () => {
        resetTeamForm();

        setShowTeamForm(true);

        window.scrollTo({
            top: document.body.scrollHeight,
            behavior: "smooth"
        });
    };

    /*
     * Edit existing team.
     */
    const handleEditTeam = (team) => {
        const playerMap = {};

        (team.competition_team_players || [])
            .forEach(item => {
                playerMap[item.position] =
                    item.player_id;
            });

        setEditingTeam(team);

        setTeamForm({
            club_id: team.club_id || "",
            team_name: team.team_name || "",
            players: playerMap
        });

        setShowTeamForm(true);
    };

    /*
     * Team form change.
     */
    const handleTeamFormChange = (e) => {
        const {
            name,
            value
        } = e.target;

        setTeamForm(prev => ({
            ...prev,
            [name]: value
        }));
    };

    /*
     * Select player for position.
     */
    const handlePlayerChange = (
        position,
        playerId
    ) => {
        setTeamForm(prev => {
            const updatedPlayers = {
                ...prev.players
            };

            if (playerId) {
                updatedPlayers[position] =
                    playerId;
            } else {
                delete updatedPlayers[position];
            }

            return {
                ...prev,
                players: updatedPlayers
            };
        });
    };

    /*
     * Save team.
     */
    const handleSaveTeam = async (e) => {
        e.preventDefault();

        if (!teamForm.club_id) {
            alert("Please select a club.");
            return;
        }

        const positions =
            getPositions(competition.format);

        for (const position of positions) {
            if (!teamForm.players[position.key]) {
                alert(
                    `Please select a player for ${position.label}.`
                );

                return;
            }
        }

        const selectedPlayers =
            Object.values(teamForm.players);

        const uniquePlayers =
            new Set(selectedPlayers);

        if (
            uniquePlayers.size !==
            selectedPlayers.length
        ) {
            alert(
                "A player cannot be assigned to more than one position in the same team."
            );

            return;
        }

        setSaving(true);

        try {
            let competitionTeamId;

            if (!editingTeam) {
                const nextTeamNumber =
                    teams.length > 0
                        ? Math.max(
                            ...teams.map(
                                team =>
                                    team.team_number || 0
                            )
                        ) + 1
                        : 1;

                const teamResult =
                    await supabase
                        .from("competition_teams")
                        .insert({
                            competition_id:
                                competitionId,

                            club_id:
                                teamForm.club_id,

                            team_number:
                                nextTeamNumber,

                            team_name:
                                teamForm.team_name.trim() ||
                                null,

                            status:
                                "active"
                        })
                        .select("id")
                        .single();

                if (teamResult.error) {
                    throw teamResult.error;
                }

                competitionTeamId =
                    teamResult.data.id;

            } else {
                competitionTeamId =
                    editingTeam.id;

                const teamResult =
                    await supabase
                        .from("competition_teams")
                        .update({
                            club_id:
                                teamForm.club_id,

                            team_name:
                                teamForm.team_name.trim() ||
                                null
                        })
                        .eq(
                            "id",
                            editingTeam.id
                        );

                if (teamResult.error) {
                    throw teamResult.error;
                }

                const deleteResult =
                    await supabase
                        .from("competition_team_players")
                        .delete()
                        .eq(
                            "competition_team_id",
                            editingTeam.id
                        );

                if (deleteResult.error) {
                    throw deleteResult.error;
                }
            }

            const playerRows =
                positions.map(position => ({
                    competition_team_id:
                        competitionTeamId,

                    player_id:
                        teamForm.players[
                            position.key
                        ],

                    position:
                        position.key,

                    position_order:
                        position.order
                }));

            const playersResult =
                await supabase
                    .from("competition_team_players")
                    .insert(playerRows);

            if (playersResult.error) {
                if (!editingTeam) {
                    await supabase
                        .from("competition_teams")
                        .delete()
                        .eq(
                            "id",
                            competitionTeamId
                        );
                }

                throw playersResult.error;
            }

            setShowTeamForm(false);
            resetTeamForm();

            await loadData();

        } catch (error) {
            console.error(
                "Error saving team:",
                error
            );

            alert(
                `Unable to save team.\n\n${error.message}`
            );

        } finally {
            setSaving(false);
        }
    };

    /*
     * Change team status.
     */
    const handleChangeTeamStatus = async (
        team,
        status
    ) => {
        const statusText = {
            active: "active",
            withdrawn: "withdrawn",
            eliminated: "eliminated"
        };

        const confirmed = window.confirm(
            `Set Team ${team.team_number} to ${statusText[status]}?`
        );

        if (!confirmed) {
            return;
        }

        const { error } = await supabase
            .from("competition_teams")
            .update({
                status
            })
            .eq("id", team.id);

        if (error) {
            console.error(
                "Error changing team status:",
                error
            );

            alert(
                `Unable to update team status.\n\n${error.message}`
            );

            return;
        }

        await loadData();
    };

    /*
     * Start adding a playing day.
     */
    const handleAddDay = () => {
        resetDayForm();
        setShowDayForm(true);
    };

    /*
     * Edit playing day.
     */
    const handleEditDay = (day) => {
        setEditingDay(day);

        setDayForm({
            playing_date:
                day.playing_date || "",

            name:
                day.name || "",

            venue_club_id:
                day.venue_club_id || "",

            status:
                day.status || "scheduled"
        });

        setShowDayForm(true);
    };

    /*
     * Playing day form change.
     */
    const handleDayFormChange = (e) => {
        const {
            name,
            value
        } = e.target;

        setDayForm(prev => ({
            ...prev,
            [name]: value
        }));
    };

    /*
     * Save playing day.
     */
    const handleSaveDay = async (e) => {
        e.preventDefault();

        if (!dayForm.playing_date) {
            alert("Please select a playing date.");
            return;
        }

        const duplicateDate =
            playingDays.some(
                day =>
                    day.playing_date ===
                        dayForm.playing_date &&
                    day.id !==
                        editingDay?.id
            );

        if (duplicateDate) {
            alert(
                "There is already a playing day scheduled for this date."
            );

            return;
        }

        setSaving(true);

        try {
            if (editingDay) {
                const { error } =
                    await supabase
                        .from("competition_days")
                        .update({
                            playing_date:
                                dayForm.playing_date,

                            name:
                                dayForm.name.trim() ||
                                null,

                            venue_club_id:
                                dayForm.venue_club_id ||
                                null,

                            status:
                                dayForm.status,

                            updated_at:
                                new Date().toISOString()
                        })
                        .eq(
                            "id",
                            editingDay.id
                        );

                if (error) {
                    throw error;
                }

            } else {
                const nextDayNumber =
                    playingDays.length > 0
                        ? Math.max(
                            ...playingDays.map(
                                day =>
                                    day.day_number || 0
                            )
                        ) + 1
                        : 1;

                const { error } =
                    await supabase
                        .from("competition_days")
                        .insert({
                            competition_id:
                                competitionId,

                            day_number:
                                nextDayNumber,

                            playing_date:
                                dayForm.playing_date,

                            name:
                                dayForm.name.trim() ||
                                null,

                            venue_club_id:
                                dayForm.venue_club_id ||
                                null,

                            status:
                                dayForm.status
                        });

                if (error) {
                    throw error;
                }
            }

            setShowDayForm(false);
            resetDayForm();

            await loadData();

        } catch (error) {
            console.error(
                "Error saving playing day:",
                error
            );

            alert(
                `Unable to save playing day.\n\n${error.message}`
            );

        } finally {
            setSaving(false);
        }
    };

    /*
     * Delete playing day.
     */
    const handleDeleteDay = async (day) => {
        const {
            count,
            error: countError
        } = await supabase
            .from("competition_rounds")
            .select(
                "id",
                {
                    count: "exact",
                    head: true
                }
            )
            .eq(
                "competition_day_id",
                day.id
            );

        if (countError) {
            console.error(
                "Error checking rounds:",
                countError
            );

            alert(
                `Unable to check whether this playing day can be deleted.\n\n${countError.message}`
            );

            return;
        }

        if (count > 0) {
            alert(
                `Day ${day.day_number} cannot be deleted because it already has ${count} round(s) assigned to it.\n\nRemove the rounds first.`
            );

            return;
        }

        const confirmed =
            window.confirm(
                `Delete Day ${day.day_number}${day.name ? ` (${day.name})` : ""}?`
            );

        if (!confirmed) {
            return;
        }

        const { error } =
            await supabase
                .from("competition_days")
                .delete()
                .eq(
                    "id",
                    day.id
                );

        if (error) {
            console.error(
                "Error deleting playing day:",
                error
            );

            alert(
                `Unable to delete playing day.\n\n${error.message}`
            );

            return;
        }

        await loadData();
    };

    /*
     * Add round.
     */
    const handleAddRound = () => {
        resetRoundForm();
        setShowRoundForm(true);
    };

    /*
     * Edit round.
     */
    const handleEditRound = (round) => {
        setEditingRound(round);

        setRoundForm({
            competition_day_id:
                round.competition_day_id || "",

            round_name:
                round.round_name || "",

            status:
                round.status || "pending"
        });

        setShowRoundForm(true);
    };

    /*
     * Round form change.
     */
    const handleRoundFormChange = (e) => {
        const {
            name,
            value
        } = e.target;

        setRoundForm(prev => ({
            ...prev,
            [name]: value
        }));
    };

    /*
     * Save round.
     */
    const handleSaveRound = async (e) => {
        e.preventDefault();

        if (!roundForm.competition_day_id) {
            alert(
                "Please select a playing day."
            );

            return;
        }

        let roundNumber;

        if (editingRound) {
            roundNumber =
                editingRound.round_number;

        } else {
            roundNumber =
                rounds.length > 0
                    ? Math.max(
                        ...rounds.map(
                            round =>
                                round.round_number || 0
                        )
                    ) + 1
                    : 1;
        }

        setSaving(true);

        try {
            if (editingRound) {
                const { error } =
                    await supabase
                        .from("competition_rounds")
                        .update({
                            competition_day_id:
                                roundForm.competition_day_id,

                            round_name:
                                roundForm.round_name.trim() ||
                                null,

                            status:
                                roundForm.status,

                            updated_at:
                                new Date().toISOString()
                        })
                        .eq(
                            "id",
                            editingRound.id
                        );

                if (error) {
                    throw error;
                }

            } else {
                const { error } =
                    await supabase
                        .from("competition_rounds")
                        .insert({
                            competition_id:
                                competitionId,

                            competition_day_id:
                                roundForm.competition_day_id,

                            round_number:
                                roundNumber,

                            round_name:
                                roundForm.round_name.trim() ||
                                null,

                            status:
                                "pending"
                        });

                if (error) {
                    throw error;
                }
            }

            setShowRoundForm(false);
            resetRoundForm();

            await loadData();

        } catch (error) {
            console.error(
                "Error saving round:",
                error
            );

            alert(
                `Unable to save round.\n\n${error.message}`
            );

        } finally {
            setSaving(false);
        }
    };

    /*
     * Delete round safely.
     */
    const handleDeleteRound = async (round) => {
        const {
            count,
            error: countError
        } = await supabase
            .from("competition_matches")
            .select(
                "id",
                {
                    count: "exact",
                    head: true
                }
            )
            .eq(
                "round_id",
                round.id
            );

        if (countError) {
            console.error(
                "Error checking matches:",
                countError
            );

            alert(
                `Unable to check whether this round can be deleted.\n\n${countError.message}`
            );

            return;
        }

        if (count > 0) {
            alert(
                `Round ${round.round_number} cannot be deleted because it already has ${count} match(es) assigned to it.`
            );

            return;
        }

        const confirmed =
            window.confirm(
                `Delete Round ${round.round_number}${round.round_name ? ` (${round.round_name})` : ""}?`
            );

        if (!confirmed) {
            return;
        }

        const { error } =
            await supabase
                .from("competition_rounds")
                .delete()
                .eq(
                    "id",
                    round.id
                );

        if (error) {
            console.error(
                "Error deleting round:",
                error
            );

            alert(
                `Unable to delete round.\n\n${error.message}`
            );

            return;
        }

        await loadData();
    };

    /*
     * Generate a draw proposal from the teams currently entered.
     * This is intentionally a preview step only. Nothing is written to Supabase.
     */
    const handleGenerateDraw = () => {
        const activeTeams = teams
            .filter(team => team.status === "active")
            .map(team => ({
                id: team.id,
                name: getTeamBaseName(team),
                playerNames: getTeamPlayerNames(team),
                clubId: team.club_id || null,
                clubName: team.clubs?.name || team.clubs?.short_name || null
            }));

        if (activeTeams.length < 3) {
            alert("At least 3 active teams are required before a draw can be generated.");
            return;
        }

        setGeneratingDraw(true);

        try {
            const proposal = generateCompetitionDrawProposal({
                teams: activeTeams,
                competitionType: competition?.schedule_type || "weekend"
            });

            setDrawProposal(proposal);
            setShowDrawPlanner(true);
        } catch (error) {
            console.error("Error generating draw proposal:", error);
            alert(`Unable to generate draw proposal.\n\n${error.message}`);
        } finally {
            setGeneratingDraw(false);
        }
    };

    const clearDrawProposal = () => {
        setDrawProposal(null);
        setShowDrawPlanner(false);
    };

    /*
     * Persist the reviewed draw proposal.
     * The proposal is the source of truth here: we do not recalculate it.
     * Dates/competition_days remain untouched and can be scheduled later.
     */
    const handleConfirmDraw = async () => {
        if (!drawProposal?.recommendedPlan) {
            alert("Please calculate a draw proposal first.");
            return;
        }

        const plan = drawProposal.recommendedPlan;
        const confirmed = window.confirm(
            `Confirm this draw for ${plan.teamCount} teams?\n\n` +
            `${plan.sectionCount === 1 ? "Single round robin" : `${plan.sectionCount} sections`}\n` +
            `${plan.sectionalRounds} sectional round(s) + ${plan.playoffStages.length} playoff round(s).\n\n` +
            `This will create the sections, section memberships, rounds and fixtures. Dates will NOT be created yet.`
        );

        if (!confirmed) return;

        setConfirmingDraw(true);

        const createdSectionIds = [];
        const createdRoundIds = [];
        const createdMatchIds = [];

        try {
            // Never silently overwrite an existing draw.
            const [sectionsCheck, roundsCheck, matchesCheck] = await Promise.all([
                supabase
                    .from("competition_sections")
                    .select("id", { count: "exact", head: true })
                    .eq("competition_id", competitionId),
                supabase
                    .from("competition_rounds")
                    .select("id", { count: "exact", head: true })
                    .eq("competition_id", competitionId),
                supabase
                    .from("competition_matches")
                    .select("id", { count: "exact", head: true })
                    .eq("competition_id", competitionId)
            ]);

            const checkError = sectionsCheck.error || roundsCheck.error || matchesCheck.error;
            if (checkError) throw checkError;

            if ((sectionsCheck.count || 0) > 0 || (roundsCheck.count || 0) > 0 || (matchesCheck.count || 0) > 0) {
                throw new Error(
                    "This competition already has draw/scheduling records. The existing draw was not changed."
                );
            }

            // Create sections.
            const sectionRows = plan.sections.map(section => ({
                competition_id: competitionId,
                section_number: section.number,
                section_name: `Section ${section.number}`
            }));

            const { data: sectionData, error: sectionError } = await supabase
                .from("competition_sections")
                .insert(sectionRows)
                .select("id, section_number");

            if (sectionError) throw sectionError;
            createdSectionIds.push(...(sectionData || []).map(row => row.id));

            const sectionIdByNumber = new Map(
                (sectionData || []).map(row => [row.section_number, row.id])
            );

            // Create section memberships.
            const sectionTeamRows = [];
            for (const section of plan.sections) {
                const sectionId = sectionIdByNumber.get(section.number);
                for (const team of section.teams) {
                    sectionTeamRows.push({
                        section_id: sectionId,
                        competition_team_id: team.id
                    });
                }
            }

            if (sectionTeamRows.length) {
                const { error } = await supabase
                    .from("competition_section_teams")
                    .insert(sectionTeamRows);
                if (error) throw error;
            }

            // Create one competition_round per playing round. A round can contain
            // matches from multiple sections. No dates are assigned at this stage.
            const roundRows = [];
            for (let roundNumber = 1; roundNumber <= plan.totalRounds; roundNumber++) {
                const isSectional = roundNumber <= plan.sectionalRounds;
                let roundName = isSectional
                    ? `Sectional Round ${roundNumber}`
                    : plan.playoffStages[roundNumber - plan.sectionalRounds - 1]
                        .replaceAll("_", " ")
                        .replace(/\b\w/g, c => c.toUpperCase());

                roundRows.push({
                    competition_id: competitionId,
                    competition_day_id: null,
                    round_number: roundNumber,
                    round_name: roundName,
                    status: "pending"
                });
            }

            const { data: roundData, error: roundError } = await supabase
                .from("competition_rounds")
                .insert(roundRows)
                .select("id, round_number");

            if (roundError) throw roundError;
            createdRoundIds.push(...(roundData || []).map(row => row.id));

            const roundIdByNumber = new Map(
                (roundData || []).map(row => [row.round_number, row.id])
            );

            // Create sectional fixtures exactly as generated by the proposal.
            const sectionalMatchRows = [];
            for (const section of plan.sections) {
                const sectionId = sectionIdByNumber.get(section.number);
                for (const round of section.rounds) {
                    const roundId = roundIdByNumber.get(round.number);
                    for (const match of round.matches) {
                        sectionalMatchRows.push({
                            competition_id: competitionId,
                            round_id: roundId,
                            section_id: sectionId,
                            match_number: sectionalMatchRows.filter(m => m.round_id === roundId).length + 1,
                            team_a_id: match.teamAId,
                            team_b_id: match.teamBId,
                            score_a: null,
                            score_b: null,
                            skins_a: null,
                            skins_b: null,
                            points_a: null,
                            points_b: null,
                            shots_for_a: null,
                            shots_for_b: null,
                            completed: false,
                            completed_at: null,
                            next_match_id: null,
                            next_match_slot: null
                        });
                    }
                }
            }

            if (sectionalMatchRows.length) {
                const { data, error } = await supabase
                    .from("competition_matches")
                    .insert(sectionalMatchRows)
                    .select("id");
                if (error) throw error;
                createdMatchIds.push(...(data || []).map(row => row.id));
            }

            // Create playoff fixtures with unresolved team IDs. Their sources are
            // represented by next_match_id / next_match_slot so later results can
            // advance section/knockout winners into the correct slot.
            const playoffMatchRows = [];
            const playoffMatchKeys = [];

            for (let i = 0; i < plan.playoffStages.length; i++) {
                const stage = plan.playoffStages[i];
                const roundNumber = plan.sectionalRounds + i + 1;
                const roundId = roundIdByNumber.get(roundNumber);
                const stageMatches = plan.playoffMatches.filter(m => m.stage === stage);

                for (const match of stageMatches) {
                    playoffMatchRows.push({
                        competition_id: competitionId,
                        round_id: roundId,
                        section_id: null,
                        match_number: match.matchNumber,
                        team_a_id: null,
                        team_b_id: null,
                        score_a: null,
                        score_b: null,
                        points_a: null,
                        points_b: null,
                        shots_for_a: null,
                        shots_for_b: null,
                        completed: false,
                        completed_at: null,
                        next_match_id: null,
                        next_match_slot: null
                    });
                    playoffMatchKeys.push({ stage, matchNumber: match.matchNumber });
                }
            }

            let playoffData = [];
            if (playoffMatchRows.length) {
                const { data, error } = await supabase
                    .from("competition_matches")
                    .insert(playoffMatchRows)
                    .select("id, round_id, match_number");
                if (error) throw error;
                playoffData = data || [];
                createdMatchIds.push(...playoffData.map(row => row.id));
            }

            const playoffIdByKey = new Map();
            for (let i = 0; i < playoffData.length; i++) {
                const key = playoffMatchKeys[i];
                playoffIdByKey.set(`${key.stage}:${key.matchNumber}`, playoffData[i].id);
            }

            // Link each playoff match to the next playoff match and slot.
            for (const match of plan.playoffMatches) {
                const sourceId = playoffIdByKey.get(`${match.stage}:${match.matchNumber}`);
                if (!sourceId) continue;

                const target = plan.playoffMatches.find(candidate => {
                    return (
                        candidate.sourceA?.type === `${match.stage}_winner` &&
                        candidate.sourceA?.matchNumber === match.matchNumber
                    ) || (
                        candidate.sourceB?.type === `${match.stage}_winner` &&
                        candidate.sourceB?.matchNumber === match.matchNumber
                    );
                });

                if (target) {
                    const targetId = playoffIdByKey.get(`${target.stage}:${target.matchNumber}`);
                    const slot =
                        target.sourceA?.type === `${match.stage}_winner` &&
                        target.sourceA?.matchNumber === match.matchNumber
                            ? "A"
                            : "B";

                    const { error } = await supabase
                        .from("competition_matches")
                        .update({
                            next_match_id: targetId,
                            next_match_slot: slot
                        })
                        .eq("id", sourceId);

                    if (error) throw error;
                }
            }

            const { error: competitionError } = await supabase
                .from("competitions")
                .update({ status: "draw_generated" })
                .eq("id", competitionId);

            if (competitionError) throw competitionError;

            setDrawProposal(null);
            setShowDrawPlanner(false);
            await loadData();

            alert(
                `Draw confirmed successfully.\n\n${plan.sectionCount === 1 ? "Single round robin" : `${plan.sectionCount} sections`}\n${plan.totalRounds} round(s) created.\nDates and venues can now be scheduled.`
            );
        } catch (error) {
            console.error("Error confirming draw:", error);

            // Best-effort rollback of records created by this confirmation.
            try {
                if (createdMatchIds.length) {
                    await supabase
                        .from("competition_matches")
                        .delete()
                        .in("id", createdMatchIds);
                }
                if (createdRoundIds.length) {
                    await supabase
                        .from("competition_rounds")
                        .delete()
                        .in("id", createdRoundIds);
                }
                if (createdSectionIds.length) {
                    await supabase
                        .from("competition_section_teams")
                        .delete()
                        .in("section_id", createdSectionIds);
                    await supabase
                        .from("competition_sections")
                        .delete()
                        .in("id", createdSectionIds);
                }
            } catch (rollbackError) {
                console.error("Draw rollback error:", rollbackError);
            }

            alert(`Unable to confirm draw.\n\n${error.message}`);
        } finally {
            setConfirmingDraw(false);
        }
    };

    /*
     * Player counts by participating club. Counts are based on the players
     * actually assigned to competition teams and are unique per player.
     */
    const getClubPlayerCounts = () => {
        const counts = new Map();

        participatingClubs.forEach(entry => {
            const club = entry.clubs || entry.club || {};
            const clubId = entry.club_id || club.id;

            if (!clubId) return;

            counts.set(clubId, {
                clubId,
                name: club.name || entry.name || "Unknown Club",
                shortName: club.short_name || "",
                playerIds: new Set()
            });
        });

        teams.forEach(team => {
            const clubId = team.club_id;
            if (!clubId) return;

            if (!counts.has(clubId)) {
                const club = team.clubs || {};
                counts.set(clubId, {
                    clubId,
                    name: club.name || "Unknown Club",
                    shortName: club.short_name || "",
                    playerIds: new Set()
                });
            }

            const entry = counts.get(clubId);
            (team.competition_team_players || []).forEach(teamPlayer => {
                if (teamPlayer.player_id) {
                    entry.playerIds.add(teamPlayer.player_id);
                }
            });
        });

        return Array.from(counts.values())
            .map(entry => ({
                ...entry,
                playerCount: entry.playerIds.size
            }))
            .sort((a, b) =>
                a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
            );
    };

    const clubPlayerCounts = getClubPlayerCounts();

    /*
     * Available clubs.
     */
    const availableClubs =
        clubs.filter(
            club =>
                !participatingClubs.some(
                    entry =>
                        entry.club_id ===
                        club.id
                )
        );

    /*
     * Players for selected club.
     */
    const clubPlayers =
        players.filter(
            player =>
                player.club_id ===
                teamForm.club_id
        );

    /*
     * Get player display name.
     */
    const playerName = (player) => {
        if (!player) {
            return "—";
        }

        return getPlayerDisplayName(player) || "—";
    };

    /*
     * Return the players belonging to a competition team in their configured
     * position order.
     */
    const getTeamPlayerNames = (team) => {
        if (!team) return [];

        return (team.competition_team_players || [])
            .slice()
            .sort((a, b) => (a.position_order || 0) - (b.position_order || 0))
            .map(item => playerName(item.players))
            .filter(name => name && name !== "—");
    };

    /*
     * Generate the automatic competition team name.
     *
     * If the secretary leaves Team Name blank, the name becomes the club
     * short code followed by that club's sequence number, e.g. HBC1, HBC2.
     * The sequence is based on the team's order within that club, not the
     * overall competition team number.
     */
    const getTeamBaseName = (team, allTeams = teams) => {
        if (!team) return "TBD";

        const explicitName = team.team_name?.trim();
        if (explicitName) return explicitName;

        const clubCode =
            team.clubs?.short_name?.trim() ||
            team.club_short_name?.trim() ||
            team.clubs?.name?.trim() ||
            team.clubName?.trim() ||
            "TEAM";

        const clubTeams = (allTeams || [])
            .filter(item => item?.club_id && team.club_id && item.club_id === team.club_id)
            .slice()
            .sort((a, b) => {
                const numberA = a.team_number || 0;
                const numberB = b.team_number || 0;
                if (numberA !== numberB) return numberA - numberB;
                return String(a.id || "").localeCompare(String(b.id || ""));
            });

        const sequenceIndex = clubTeams.findIndex(item => item.id === team.id);
        const sequenceNumber = sequenceIndex >= 0
            ? sequenceIndex + 1
            : clubTeams.length + 1;

        // If a club has no short code, use its name as a last resort.
        // This keeps the generated name useful without requiring database
        // changes for clubs that pre-date the short-code field.
        const fallbackCode = clubCode === "TEAM"
            ? (team.team_number ? "TEAM" : "TEAM")
            : clubCode;

        return `${fallbackCode}${sequenceNumber}`;
    };

    /*
     * Plain-text team name used where a string is required by the draw/result
     * logic. Visual team labels should use TeamDisplay below so player names
     * can be rendered in a smaller font.
     */
    const getTeamDisplayName = (team) => {
        return getTeamBaseName(team);
    };

    /*
     * Consistent visual team label: generated/custom team name in the normal
     * font, followed by all players in a smaller muted font.
     */
    const TeamDisplay = ({ team, className = "" }) => {
        if (!team) return <span className={className}>TBD</span>;

        const sourceTeam = teams.find(item => item.id === team.id) || team;
        const baseName = getTeamBaseName(sourceTeam, teams);
        const playerNames = getTeamPlayerNames(sourceTeam).length
            ? getTeamPlayerNames(sourceTeam)
            : (team.playerNames || []);

        return (
            <span className={className}>
                <strong>{baseName}</strong>
                {playerNames.length > 0 && (
                    <span className="d-block small text-muted fw-normal mt-1">
                        ({playerNames.join(", ")})
                    </span>
                )}
            </span>
        );
    };

    /*
     * Competition format label.
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
     * Competition structure label.
     */
    const structureLabel = (structure) => {
        const labels = {
            sectional: "Sectional",
            round_robin: "Round Robin",
            knockout: "Knockout"
        };

        return labels[structure] || structure;
    };

    /*
     * Team status badge.
     */
    const statusBadge = (status) => {
        const badges = {
            active: {
                className: "bg-success",
                label: "Active"
            },

            withdrawn: {
                className: "bg-secondary",
                label: "Withdrawn"
            },

            eliminated: {
                className: "bg-danger",
                label: "Eliminated"
            }
        };

        const badge =
            badges[status] ||
            badges.active;

        return (
            <span
                className={`badge ${badge.className}`}
            >
                {badge.label}
            </span>
        );
    };

    /*
     * Playing day status badge.
     */
    const dayStatusBadge = (status) => {
        const badges = {
            scheduled: {
                className: "bg-primary",
                label: "Scheduled"
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
            badges[status] ||
            badges.scheduled;

        return (
            <span
                className={`badge ${badge.className}`}
            >
                {badge.label}
            </span>
        );
    };

    /*
     * Round status badge.
     */
    const roundStatusBadge = (status) => {
        const badges = {
            pending: {
                className: "bg-secondary",
                label: "Pending"
            },

            in_progress: {
                className: "bg-warning text-dark",
                label: "In Progress"
            },

            completed: {
                className: "bg-success",
                label: "Completed"
            }
        };

        const badge =
            badges[status] ||
            badges.pending;

        return (
            <span
                className={`badge ${badge.className}`}
            >
                {badge.label}
            </span>
        );
    };

    /*
     * Format date.
     */
    const formatDate = (dateString) => {
        if (!dateString) {
            return "—";
        }

        const date =
            new Date(
                `${dateString}T00:00:00`
            );

        return date.toLocaleDateString(
            "en-ZA",
            {
                weekday: "long",
                day: "2-digit",
                month: "long",
                year: "numeric"
            }
        );
    };

    /*
     * Loading.
     */
    if (loading) {
        return (
            <div className="container-fluid py-5">
                <div className="text-center">

                    <div
                        className="spinner-border text-primary"
                    ></div>

                    <div className="text-muted mt-3">
                        Loading competition...
                    </div>

                </div>
            </div>
        );
    }

    /*
     * Competition not found.
     */
    if (!competition) {
        return (
            <div className="container-fluid py-5">
                <div className="text-center">

                    <i className="bi bi-exclamation-triangle display-4 text-warning"></i>

                    <h4 className="mt-3">
                        Competition not found
                    </h4>

                    <button
                        className="btn btn-primary mt-3"
                        onClick={() =>
                            navigate("/competitions")
                        }
                    >
                        Back to Competitions
                    </button>

                </div>
            </div>
        );
    }

    const positions =
        getPositions(
            competition.format
        );

    return (
        <>
            <style>{`
                .workspace-progress { position: sticky; top: 12px; z-index: 20; }
                .workspace-stage-card { scroll-margin-top: 110px; transition: box-shadow .2s ease, opacity .2s ease; }
                .workspace-stage-card.workspace-collapsed > .card-body { display: none; }
                .workspace-stage-card.workspace-collapsed > .card-header { border-bottom: 0; }
                .workspace-stage-card.workspace-collapsed { opacity: .86; }
                .workspace-section-collapsed .table-responsive { display: none; }
                .workspace-section-collapsed { opacity: .92; }
            `}</style>
            <div className="container-fluid py-4">

            {/* Back */}

            <button
                type="button"
                className="btn btn-link text-decoration-none px-0 mb-3"
                onClick={() =>
                    navigate("/competitions")
                }
            >

                <i className="bi bi-arrow-left me-2"></i>

                Back to Competitions

            </button>


            {/* Header */}

            <div className="d-flex justify-content-between align-items-start mb-4">

                <div>

                    <h1 className="mb-1">
                        {competition.name}
                    </h1>

                    <div className="text-muted">

                        {formatLabel(
                            competition.format
                        )}

                        {" • "}

                        {structureLabel(
                            competition.structure
                        )}

                        {competition.start_date && (
                            <>
                                {" • "}
                                {formatDate(
                                    competition.start_date
                                )}

                                {competition.end_date && (
                                    <>
                                        {" – "}
                                        {formatDate(
                                            competition.end_date
                                        )}
                                    </>
                                )}
                            </>
                        )}

                    </div>

                </div>

                <span className="badge bg-secondary fs-6">

                    {competition.status === "draft"
                        ? "Draft"
                        : competition.status
                    }

                </span>

            </div>


            {/* Progressive workspace navigation */}
            <div className="card shadow-sm border-0 mb-4 workspace-progress" id="workspace-progress">
                <div className="card-body py-3">
                    <div className="d-flex flex-wrap align-items-center justify-content-between gap-3">
                        <div>
                            <div className="fw-semibold">Competition Progress</div>
                            <div className="small text-muted">Next action: <strong>{workspaceStageInfo[workspaceStage]?.label || "Setup"}</strong></div>
                        </div>
                        <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => setShowSetupDetails(value => !value)}>
                            <i className={`bi ${showSetupDetails ? "bi-arrows-collapse" : "bi-arrows-expand"} me-1`}></i>
                            {showSetupDetails ? "Collapse setup" : "Show setup"}
                        </button>
                    </div>
                    <div className="d-flex flex-wrap align-items-center gap-1 mt-3">
                        {["teams", "draw", "schedule", "scoring", "playoffs"].map((stage, index) => {
                            const info = workspaceStageInfo[stage];
                            const active = workspaceStage === stage;
                            const stageOrder = ["teams", "draw", "schedule", "scoring", "playoffs"];
                            const completed = stageOrder.indexOf(stage) < stageOrder.indexOf(workspaceStage);
                            return (
                                <div key={stage} className="d-flex align-items-center">
                                    {index > 0 && <i className="bi bi-chevron-right text-muted mx-1"></i>}
                                    <button type="button" className={`btn btn-sm ${active ? "btn-primary" : completed ? "btn-outline-success" : "btn-outline-secondary"}`} onClick={() => focusWorkspaceStage(stage)}>
                                        <i className={`bi ${info.icon} me-1`}></i>{info.label}
                                        {completed && <i className="bi bi-check-lg ms-1"></i>}
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Overview */}

            <div className="row g-3 mb-4">

                <div className="col-md-3">

                    <div className="card shadow-sm border-0 h-100">

                        <div className="card-body">

                            <div className="text-muted small">
                                Participating Clubs
                            </div>

                            <div className="fs-2 fw-bold">
                                {participatingClubs.length}
                            </div>

                        </div>

                    </div>

                </div>


                <div className="col-md-3">

                    <div className="card shadow-sm border-0 h-100">

                        <div className="card-body">

                            <div className="text-muted small">
                                Teams
                            </div>

                            <div className="fs-2 fw-bold">
                                {teams.length}
                            </div>

                        </div>

                    </div>

                </div>


                <div className="col-md-3">

                    <div className="card shadow-sm border-0 h-100">

                        <div className="card-body">

                            <div className="text-muted small">
                                Draw Status
                            </div>

                            <div className="fs-4 fw-bold">
                                {confirmedDraw ? "Confirmed" : drawProposal ? "Proposed" : "Not generated"}
                            </div>

                        </div>

                    </div>

                </div>


                <div className="col-md-3">

                    <div className="card shadow-sm border-0 h-100">

                        <div className="card-body">

                            <div className="text-muted small">
                                Required Rounds
                            </div>

                            <div className="fs-2 fw-bold">
                                {confirmedDraw?.rounds?.length ?? drawProposal?.recommendedPlan?.totalRounds ?? "—"}
                            </div>

                        </div>

                    </div>

                </div>

            </div>


            {/* Players by Club */}

            <div className="card shadow-sm border-0 mb-4">

                <div className="card-header bg-white d-flex justify-content-between align-items-center">
                    <div>
                        <h5 className="mb-0">
                            <i className="bi bi-people me-2"></i>
                            Players by Club
                        </h5>
                        <div className="small text-muted mt-1">
                            Players currently entered into competition teams.
                        </div>
                    </div>
                </div>

                <div className="card-body py-3">
                    {clubPlayerCounts.length === 0 ? (
                        <div className="text-muted small">
                            No participating clubs have been added yet.
                        </div>
                    ) : (
                        <div className="row g-3">
                            {clubPlayerCounts.map(club => (
                                <div className="col-sm-6 col-lg-4 col-xl-3" key={club.clubId}>
                                    <div className="border rounded p-3 h-100 d-flex justify-content-between align-items-center">
                                        <div className="me-3">
                                            <div className="fw-semibold">{club.name}</div>
                                            {club.shortName && (
                                                <div className="small text-muted">{club.shortName}</div>
                                            )}
                                        </div>
                                        <div className="text-end">
                                            <div className="fs-4 fw-bold">{club.playerCount}</div>
                                            <div className="small text-muted">players</div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

            </div>


            {/* Participating Clubs */}

            <div id="workspace-clubs" className={`card shadow-sm border-0 mb-4 workspace-stage-card ${!showSetupDetails && confirmedDraw && workspaceStage !== "teams" ? "workspace-collapsed" : ""}`}>

                <div className="card-header bg-white d-flex justify-content-between align-items-center">

                    <div>

                        <h5 className="mb-0">

                            <i className="bi bi-buildings me-2"></i>

                            Participating Clubs

                        </h5>

                        <div className="small text-muted mt-1">
                            Clubs entering teams into this competition.
                        </div>

                    </div>


                    <button
                        type="button"
                        className="btn btn-primary"
                        onClick={() => {

                            setSelectedClubIds([]);

                            setShowClubForm(
                                !showClubForm
                            );

                        }}
                    >

                        <i className="bi bi-plus-lg me-2"></i>

                        Add Club

                    </button>

                </div>


                {showClubForm && (
                    <div className="card-body border-bottom">

                        <div className="row g-2 align-items-end">

                            <div className="col-md-8">

                                <label className="form-label">
                                    Select Clubs
                                </label>

                                {availableClubs.length === 0 ? (
                                    <div className="text-muted small border rounded p-3">
                                        All available clubs have already been added to this competition.
                                    </div>
                                ) : (
                                    <div className="border rounded p-3">

                                        <div className="d-flex justify-content-between align-items-center mb-2">
                                            <span className="small text-muted">
                                                Select one or more clubs to add together.
                                            </span>

                                            <button
                                                type="button"
                                                className="btn btn-sm btn-outline-secondary"
                                                onClick={() => {
                                                    if (selectedClubIds.length === availableClubs.length) {
                                                        setSelectedClubIds([]);
                                                    } else {
                                                        setSelectedClubIds(
                                                            availableClubs.map(club => club.id)
                                                        );
                                                    }
                                                }}
                                                disabled={saving}
                                            >
                                                {selectedClubIds.length === availableClubs.length
                                                    ? "Clear all"
                                                    : "Select all"}
                                            </button>
                                        </div>

                                        <div className="row g-2">
                                            {availableClubs.map(club => (
                                                <div
                                                    key={club.id}
                                                    className="col-12 col-md-6"
                                                >
                                                    <div className="form-check">
                                                        <input
                                                            id={`competition-club-${club.id}`}
                                                            className="form-check-input"
                                                            type="checkbox"
                                                            checked={selectedClubIds.includes(club.id)}
                                                            onChange={() => {
                                                                setSelectedClubIds(prev =>
                                                                    prev.includes(club.id)
                                                                        ? prev.filter(id => id !== club.id)
                                                                        : [...prev, club.id]
                                                                );
                                                            }}
                                                            disabled={saving}
                                                        />

                                                        <label
                                                            className="form-check-label"
                                                            htmlFor={`competition-club-${club.id}`}
                                                        >
                                                            {club.name}
                                                        </label>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>

                                    </div>
                                )}

                            </div>


                            <div className="col-md-4">

                                <button
                                    type="button"
                                    className="btn btn-success me-2"
                                    onClick={handleAddClub}
                                    disabled={saving || selectedClubIds.length === 0}
                                >

                                    {saving ? (
                                        <>
                                            <span
                                                className="spinner-border spinner-border-sm me-2"
                                            ></span>

                                            Adding...
                                        </>
                                    ) : (
                                        <>
                                            <i className="bi bi-check-lg me-2"></i>
                                            Add {selectedClubIds.length || "Selected"} Club{selectedClubIds.length === 1 ? "" : "s"}
                                        </>
                                    )}

                                </button>


                                <button
                                    type="button"
                                    className="btn btn-outline-secondary"
                                    onClick={() => {
                                        setSelectedClubIds([]);
                                        setShowClubForm(false);
                                    }}
                                    disabled={saving}
                                >
                                    Cancel
                                </button>

                            </div>

                        </div>

                    </div>
                )}


                <div className="card-body p-0">

                    {participatingClubs.length === 0 ? (

                        <div className="text-center py-5">

                            <i
                                className="bi bi-buildings display-4 text-muted"
                            ></i>

                            <h5 className="mt-3">
                                No clubs added yet
                            </h5>

                            <p className="text-muted mb-0">
                                Add the clubs that will be entering teams.
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

                                        <th className="text-end">
                                            Action
                                        </th>

                                    </tr>

                                </thead>

                                <tbody>

                                    {participatingClubs.map(
                                        entry => (

                                            <tr key={entry.id}>

                                                <td>
                                                    <strong>
                                                        {entry.clubs?.name ||
                                                            "Unknown Club"}
                                                    </strong>
                                                </td>

                                                <td>
                                                    {entry.clubs?.short_name ||
                                                        "—"}
                                                </td>

                                                <td className="text-end">

                                                    <button
                                                        type="button"
                                                        className="btn btn-sm btn-outline-danger"
                                                        onClick={() =>
                                                            handleRemoveClub(
                                                                entry
                                                            )
                                                        }
                                                    >

                                                        <i className="bi bi-trash me-1"></i>

                                                        Remove

                                                    </button>

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


            {/* Competition Teams */}

            <div id="workspace-teams" className={`card shadow-sm border-0 mb-4 workspace-stage-card ${!showSetupDetails && confirmedDraw && workspaceStage !== "teams" ? "workspace-collapsed" : ""}`}>

                <div className="card-header bg-white d-flex justify-content-between align-items-center">

                    <div>

                        <h5 className="mb-0">

                            <i className="bi bi-people-fill me-2"></i>

                            Competition Teams

                        </h5>

                        <div className="small text-muted mt-1">
                            Build teams from registered players.
                        </div>

                    </div>


                    <button
                        type="button"
                        className="btn btn-primary"
                        onClick={handleAddTeam}
                        disabled={
                            participatingClubs.length === 0
                        }
                    >

                        <i className="bi bi-plus-lg me-2"></i>

                        Add Team

                    </button>

                </div>


                {showTeamForm && (

                    <div className="card-body border-bottom">

                        <form onSubmit={handleSaveTeam}>

                            <h6 className="text-primary mb-3">

                                {editingTeam
                                    ? `Edit Team ${editingTeam.team_number}`
                                    : "Add Competition Team"
                                }

                            </h6>


                            <div className="row g-3 mb-4">

                                <div className="col-md-6">

                                    <label className="form-label">
                                        Club
                                    </label>

                                    <select
                                        name="club_id"
                                        className="form-select"
                                        value={teamForm.club_id}
                                        onChange={handleTeamFormChange}
                                        required
                                    >

                                        <option value="">
                                            Select club...
                                        </option>

                                        {participatingClubs.map(
                                            entry => (

                                                <option
                                                    key={entry.club_id}
                                                    value={entry.club_id}
                                                >

                                                    {entry.clubs?.name}

                                                </option>

                                            )
                                        )}

                                    </select>

                                </div>


                                <div className="col-md-6">

                                    <label className="form-label">
                                        Team Name
                                        <span className="text-muted">
                                            {" "} (optional)
                                        </span>
                                    </label>

                                    <input
                                        type="text"
                                        name="team_name"
                                        className="form-control"
                                        placeholder={`e.g. ${competition.name} Team`}
                                        value={teamForm.team_name}
                                        onChange={handleTeamFormChange}
                                    />

                                </div>

                            </div>


                            <h6 className="text-primary mb-3">
                                Players
                            </h6>


                            <div className="row g-3">

                                {positions.map(position => {

                                    const selectedPlayerId =
                                        teamForm.players[
                                            position.key
                                        ] || "";

                                    return (
                                        <div
                                            className="col-md-6"
                                            key={position.key}
                                        >

                                            <label className="form-label">
                                                {position.label}
                                            </label>

                                            <select
                                                className="form-select"
                                                value={selectedPlayerId}
                                                onChange={(e) =>
                                                    handlePlayerChange(
                                                        position.key,
                                                        e.target.value
                                                    )
                                                }
                                                disabled={
                                                    !teamForm.club_id
                                                }
                                                required
                                            >

                                                <option value="">

                                                    {teamForm.club_id
                                                        ? `Select ${position.label.toLowerCase()}...`
                                                        : "Select club first..."
                                                    }

                                                </option>


                                                {clubPlayers.map(
                                                    player => {

                                                        const alreadySelected =
                                                            Object.entries(
                                                                teamForm.players
                                                            ).some(
                                                                ([key, value]) =>
                                                                    key !==
                                                                        position.key &&
                                                                    value ===
                                                                        player.id
                                                            );

                                                        return (
                                                            <option
                                                                key={player.id}
                                                                value={player.id}
                                                                disabled={
                                                                    alreadySelected
                                                                }
                                                            >
                                                                {playerName(
                                                                    player
                                                                )}
                                                            </option>
                                                        );

                                                    }
                                                )}

                                            </select>

                                        </div>
                                    );

                                })}

                            </div>


                            {teamForm.club_id &&
                                clubPlayers.length === 0 && (

                                    <div className="alert alert-warning mt-3 mb-0">

                                        <i className="bi bi-exclamation-triangle me-2"></i>

                                        There are no active registered players
                                        for this club.

                                    </div>

                                )}


                            <div className="d-flex justify-content-end gap-2 mt-4">

                                <button
                                    type="button"
                                    className="btn btn-outline-secondary"
                                    onClick={() => {

                                        setShowTeamForm(false);
                                        resetTeamForm();

                                    }}
                                    disabled={saving}
                                >
                                    Cancel
                                </button>


                                <button
                                    type="submit"
                                    className="btn btn-success"
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

                                            {editingTeam
                                                ? "Save Changes"
                                                : "Save Team"
                                            }
                                        </>
                                    )}

                                </button>

                            </div>

                        </form>

                    </div>

                )}


                <div className="card-body p-0">

                    {teams.length === 0 ? (

                        <div className="text-center py-5">

                            <i
                                className="bi bi-people display-4 text-muted"
                            ></i>

                            <h5 className="mt-3">
                                No teams created yet
                            </h5>

                            <p className="text-muted mb-0">
                                Add teams using registered players from the participating clubs.
                            </p>

                        </div>

                    ) : (

                        <div className="table-responsive">

                            <table className="table table-hover mb-0">

                                <thead>

                                    <tr>

                                        <th>
                                            Team
                                        </th>

                                        <th>
                                            Club
                                        </th>

                                        {positions.map(
                                            position => (
                                                <th
                                                    key={position.key}
                                                >
                                                    {position.label}
                                                </th>
                                            )
                                        )}

                                        <th>
                                            Status
                                        </th>

                                        <th className="text-end">
                                            Action
                                        </th>

                                    </tr>

                                </thead>


                                <tbody>

                                    {teams.map(team => (

                                        <tr
                                            key={team.id}
                                        >

                                            <td>

                                                <TeamDisplay team={team} />

                                                {team.team_name && (
                                                    <div className="small text-muted mt-1">
                                                        Team {team.team_number}
                                                    </div>
                                                )}

                                            </td>


                                            <td>

                                                {team.clubs?.short_name ||
                                                    team.clubs?.name ||
                                                    "—"}

                                            </td>


                                            {positions.map(
                                                position => {

                                                    const player =
                                                        (
                                                            team.competition_team_players ||
                                                            []
                                                        ).find(
                                                            item =>
                                                                item.position ===
                                                                position.key
                                                        )?.players;

                                                    return (
                                                        <td
                                                            key={
                                                                position.key
                                                            }
                                                        >
                                                            {playerName(
                                                                player
                                                            )}
                                                        </td>
                                                    );

                                                }
                                            )}


                                            <td>

                                                {statusBadge(
                                                    team.status
                                                )}

                                            </td>


                                            <td className="text-end">

                                                <div className="d-flex justify-content-end gap-1">

                                                    <button
                                                        type="button"
                                                        className="btn btn-sm btn-outline-primary"
                                                        onClick={() =>
                                                            handleEditTeam(
                                                                team
                                                            )
                                                        }
                                                    >

                                                        <i className="bi bi-pencil me-1"></i>

                                                        Edit

                                                    </button>


                                                    {team.status === "active" && (

                                                        <button
                                                            type="button"
                                                            className="btn btn-sm btn-outline-warning"
                                                            onClick={() =>
                                                                handleChangeTeamStatus(
                                                                    team,
                                                                    "withdrawn"
                                                                )
                                                            }
                                                        >

                                                            <i className="bi bi-box-arrow-right me-1"></i>

                                                            Withdraw

                                                        </button>

                                                    )}


                                                    {team.status !== "active" && (

                                                        <button
                                                            type="button"
                                                            className="btn btn-sm btn-outline-success"
                                                            onClick={() =>
                                                                handleChangeTeamStatus(
                                                                    team,
                                                                    "active"
                                                                )
                                                            }
                                                        >

                                                            <i className="bi bi-arrow-counterclockwise me-1"></i>

                                                            Activate

                                                        </button>

                                                    )}

                                                </div>

                                            </td>

                                        </tr>

                                    ))}

                                </tbody>

                            </table>

                        </div>

                    )}

                </div>

            </div>


            {confirmedDraw ? (
                <div id="workspace-draw-confirmed" className={`card shadow-sm border-0 mb-4 workspace-stage-card ${!showSetupDetails && !["draw"].includes(workspaceStage) ? "workspace-collapsed" : ""}`}>
                    <div className="card-header bg-white d-flex justify-content-between align-items-center">
                        <div><h5 className="mb-0"><i className="bi bi-check-circle-fill text-success me-2"></i>Draw Confirmed</h5><div className="small text-muted mt-1">This is the persisted draw loaded from the database.</div></div>
                        <span className="badge bg-success">Confirmed</span>
                    </div>
                    <div className="card-body">
                        <div className="row g-3 mb-4">
                            {[
                                ["Teams", teams.filter(t => t.status === "active").length],
                                ["Sections", confirmedDraw.sections.length],
                                ["Rounds", confirmedDraw.rounds.length],
                                ["Matches", confirmedDraw.matches.length]
                            ].map(([label,value]) => <div className="col-md-3" key={label}><div className="card border h-100"><div className="card-body"><div className="text-muted small">{label}</div><div className="fs-3 fw-bold">{value}</div></div></div></div>)}
                        </div>
                        <div className="alert alert-success"><strong>Draw is confirmed.</strong><div className="small mt-1">Sections, fixtures and playoff rounds below are read directly from Supabase. Dates and venues have not been assigned yet.</div></div>
                        <div className="row g-4">
                            <div className="col-lg-8">
                                <div className="card border"><div className="card-header bg-white"><strong>Sections & Sectional Fixtures</strong></div><div className="card-body">
                                    {confirmedDraw.sections.map(section => {
                                        const roundNumbers=[...new Set((section.matches||[]).map(m=>m.round?.round_number).filter(Boolean))].sort((a,b)=>a-b);
                                        return <div className="border rounded p-3 mb-3" key={section.id}>
                                            <div className="d-flex justify-content-between align-items-center mb-3"><strong>{section.section_name}</strong><span className="badge bg-secondary">{section.teams.length} teams</span></div>
                                            <div className="row g-2 mb-3">{section.teams.map(team=><div className="col-md-6" key={team.id}><div className="small border rounded px-2 py-1 bg-light"><TeamDisplay team={team} />{team.clubs?.name && <span className="text-muted"> — {team.clubs.name}</span>}</div></div>)}</div>
                                            {roundNumbers.map(n=>{ const roundMatches=section.matches.filter(m=>m.round?.round_number===n).sort((a,b)=>a.match_number-b.match_number); const byeTeam=getSectionByeTeam(section,n); return <div className="mb-3" key={n}><div className="fw-semibold small mb-2">Sectional Round {n}</div><div className="table-responsive"><table className="table table-sm table-bordered mb-0"><tbody>{roundMatches.map(m=><tr key={m.id}><td>{m.teamA ? <TeamDisplay team={m.teamA} /> : "TBC"}</td><td className="text-center fw-semibold">vs</td><td>{m.teamB ? <TeamDisplay team={m.teamB} /> : "TBC"}</td></tr>)}{byeTeam && <tr className="table-warning"><td className="fw-semibold"><TeamDisplay team={byeTeam} /></td><td className="text-center fw-semibold">—</td><td className="fw-semibold">BYE</td></tr>}</tbody></table></div></div>;})}
                                        </div>;
                                    })}
                                </div></div>
                            </div>
                            <div className="col-lg-4">
                                <div className="card border mb-3"><div className="card-header bg-white"><strong>Rounds</strong></div><div className="card-body">{confirmedDraw.rounds.map(round=><div className="d-flex justify-content-between align-items-center border-bottom py-2" key={round.id}><strong>{round.round_number}. {round.round_name}</strong><span className="badge bg-light text-dark border">{confirmedDraw.matches.filter(m=>m.round_id===round.id).length} matches</span></div>)}</div></div>
                                <div className="card border"><div className="card-header bg-white"><strong>Playoff Path</strong></div><div className="card-body">{confirmedDraw.rounds.filter(r=>playoffMatches.some(m=>m.round_id===r.id)).map(round=><div className="mb-3" key={round.id}><div className="fw-semibold mb-2">{round.round_name}</div>{confirmedDraw.matches.filter(m=>m.round_id===round.id).sort((a,b)=>a.match_number-b.match_number).map(m=><div className="small border rounded p-2 mb-2" key={m.id}><div>{m.teamA ? <TeamDisplay team={m.teamA} /> : "Winner of previous stage"}</div><div className="text-muted text-center">vs</div><div>{m.teamB ? <TeamDisplay team={m.teamB} /> : "Winner of previous stage"}</div></div>)}</div>)}</div></div>
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                <>
                    {/* Draw Planner */}

            <div id="workspace-draw-planner" className={`card shadow-sm border-0 mb-4 workspace-stage-card ${!showSetupDetails && workspaceStage !== "draw" ? "workspace-collapsed" : ""}`}>

                <div className="card-header bg-white d-flex justify-content-between align-items-center">

                    <div>

                        <h5 className="mb-0">

                            <i className="bi bi-diagram-3 me-2"></i>

                            Draw Planner

                        </h5>

                        <div className="small text-muted mt-1">

                            Calculate the recommended competition structure from the teams entered. Dates and rounds are scheduled after the draw is accepted.

                        </div>

                    </div>


                    <button
                        type="button"
                        className="btn btn-primary"
                        onClick={() => setShowDrawPlanner(!showDrawPlanner)}
                        disabled={teams.filter(team => team.status === "active").length < 3}
                    >

                        <i className="bi bi-magic me-2"></i>

                        Plan Draw

                    </button>

                </div>


                {showDrawPlanner && (

                    <div className="card-body">

                        <div className="alert alert-info mb-4">

                            <div className="fw-semibold mb-1">

                                Draw proposal only

                            </div>

                            <div>

                                BowlPoint will calculate the section structure, sectional rounds,
                                playoff structure and expected playing days. Nothing is saved until
                                the proposed draw is reviewed and confirmed.

                            </div>

                        </div>


                        <div className="row g-3 align-items-end mb-4">

                            <div className="col-md-5">
                                <div className="border rounded p-3 bg-light h-100">
                                    <div className="text-muted small">Schedule Type</div>
                                    <div className="fw-semibold">
                                        {competition?.schedule_type === "weekend"
                                            ? "Weekend Tournament"
                                            : competition?.schedule_type === "weekday" || competition?.schedule_type === "week"
                                                ? "Weekday Tournament"
                                                : "Midweek Tournament"}
                                    </div>
                                    <div className="small text-muted mt-1">
                                        Taken from the tournament setup.
                                    </div>
                                </div>
                            </div>


                            <div className="col-md-4">

                                <div className="text-muted small">

                                    Active Teams

                                </div>

                                <div className="fs-4 fw-bold">

                                    {teams.filter(team => team.status === "active").length}

                                </div>

                            </div>


                            <div className="col-md-3 text-md-end">

                                <button
                                    type="button"
                                    className="btn btn-success"
                                    onClick={handleGenerateDraw}
                                    disabled={generatingDraw || teams.filter(team => team.status === "active").length < 3}
                                >

                                    {generatingDraw ? (
                                        <>
                                            <span className="spinner-border spinner-border-sm me-2"></span>
                                            Calculating...
                                        </>
                                    ) : (
                                        <>
                                            <i className="bi bi-magic me-2"></i>
                                            Calculate Proposal
                                        </>
                                    )}

                                </button>

                            </div>

                        </div>


                        {!drawProposal && (

                            <div className="text-center py-4 text-muted">

                                <i className="bi bi-diagram-3 display-5"></i>

                                <div className="mt-3">

                                    Select the competition type and calculate the first draw proposal.

                                </div>

                            </div>

                        )}


                        {drawProposal && (

                            <>

                                <div className="row g-3 mb-4">

                                    <div className="col-md-3">
                                        <div className="card border h-100">
                                            <div className="card-body">
                                                <div className="text-muted small">Sections</div>
                                                <div className="fs-3 fw-bold">
                                                    {drawProposal.recommendedPlan.sectionCount === 1
                                                        ? "None"
                                                        : drawProposal.recommendedPlan.sectionCount}
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="col-md-3">
                                        <div className="card border h-100">
                                            <div className="card-body">
                                                <div className="text-muted small">Sectional Rounds</div>
                                                <div className="fs-3 fw-bold">
                                                    {drawProposal.recommendedPlan.sectionalRounds}
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="col-md-3">
                                        <div className="card border h-100">
                                            <div className="card-body">
                                                <div className="text-muted small">Playoff Rounds</div>
                                                <div className="fs-3 fw-bold">
                                                    {drawProposal.recommendedPlan.playoffStages.length}
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="col-md-3">
                                        <div className="card border h-100">
                                            <div className="card-body">
                                                <div className="text-muted small">Required Playing Rounds</div>
                                                <div className="fs-3 fw-bold">
                                                    {drawProposal.recommendedPlan.totalRounds}
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                </div>


                                <div className="alert alert-success">

                                    <div className="fw-semibold mb-1">

                                        Recommended Draw

                                    </div>

                                    <div>

                                        {drawProposal.recommendedPlan.schedule.normalSchedule}

                                    </div>

                                    <div className="small mt-2">

                                        {drawProposal.recommendedPlan.schedule.competitionType === "weekend"
                                            ? `${drawProposal.recommendedPlan.schedule.saturdaySectionalRounds} sectional round(s) Saturday + ${drawProposal.recommendedPlan.schedule.sundaySectionalRounds} sectional round(s) Sunday, followed by ${drawProposal.recommendedPlan.schedule.playoffRoundsOnSunday} playoff round(s) where required.`
                                            : drawProposal.recommendedPlan.schedule.competitionType === "weekday" || drawProposal.recommendedPlan.schedule.competitionType === "week"
                                                ? `${drawProposal.recommendedPlan.totalRounds} playing day(s) required at up to 3 rounds per day, Monday–Friday.`
                                                : `${drawProposal.recommendedPlan.totalRounds} playing day(s) required at one round per day.`}

                                    </div>

                                </div>


                                {drawProposal.recommendedPlan.schedule.overflow && (
                                    <div className="alert alert-warning">

                                        <strong>Secretary approval may be required:</strong>{" "}
                                        the sectional stage exceeds the preferred weekend pattern.

                                    </div>
                                )}


                                <div className="row g-4">

                                    <div className="col-lg-8">

                                        <div className="card border">

                                            <div className="card-header bg-white">

                                                <div className="d-flex justify-content-between align-items-center">

                                                    <div>
                                                        <strong>Recommended Section Allocation</strong>
                                                        <div className="small text-muted">
                                                            {drawProposal.recommendedPlan.sectionCount === 1
                                                                ? "Single round robin"
                                                                : `${drawProposal.recommendedPlan.sectionCount} sections • ${drawProposal.recommendedPlan.sectionSizes.join(" / ")} teams`}
                                                        </div>
                                                    </div>

                                                    <span className="badge bg-success">Recommended</span>

                                                </div>

                                            </div>

                                            <div className="card-body">

                                                {drawProposal.recommendedPlan.sections.map(section => (

                                                    <div className="border rounded p-3 mb-3" key={section.number}>

                                                        <div className="d-flex justify-content-between align-items-center mb-2">
                                                            <strong>
                                                                {drawProposal.recommendedPlan.sectionCount === 1
                                                                    ? "Round Robin"
                                                                    : `Section ${section.number}`}
                                                            </strong>
                                                            <span className="badge bg-secondary">
                                                                {section.teams.length} teams • {section.roundCount} rounds
                                                            </span>
                                                        </div>

                                                        <div className="row g-2">
                                                            {section.teams.map(team => (
                                                                <div className="col-md-6" key={team.id}>
                                                                    <div className="small border rounded px-2 py-1 bg-light">
                                                                        <TeamDisplay team={team} />
                                                                        {team.clubName && (
                                                                            <span className="text-muted"> — {team.clubName}</span>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>

                                                    </div>

                                                ))}

                                            </div>

                                        </div>

                                    </div>


                                    <div className="col-lg-4">

                                        <div className="card border mb-3">

                                            <div className="card-header bg-white">
                                                <strong>Playoff Path</strong>
                                            </div>

                                            <div className="card-body">

                                                {drawProposal.recommendedPlan.playoffStages.length === 0 ? (
                                                    <div className="text-muted">No playoffs — the competition is a straight round robin.</div>
                                                ) : (
                                                    <>
                                                        {drawProposal.recommendedPlan.playoffStages.map(stage => (
                                                            <div className="mb-2" key={stage}>
                                                                <span className="badge bg-primary me-2">
                                                                    {stage.replaceAll("_", " ")}
                                                                </span>
                                                            </div>
                                                        ))}

                                                        <hr />

                                                        <div className="small text-muted mb-1">Section winners</div>
                                                        <div className="small">
                                                            Points first, then total Aggregate.
                                                        </div>

                                                        <div className="small mt-2">
                                                            Aggregate = total shots for − total shots against.
                                                        </div>

                                                    </>
                                                )}

                                            </div>

                                        </div>


                                        <div className="card border">

                                            <div className="card-header bg-white">
                                                <strong>Alternative</strong>
                                            </div>

                                            <div className="card-body">

                                                {drawProposal.alternativePlans.length === 0 ? (
                                                    <div className="text-muted small">
                                                        No alternative is required for this team count.
                                                    </div>
                                                ) : (
                                                    <>
                                                        <div className="small text-muted mb-2">
                                                            Same competition structure, different team allocation.
                                                        </div>

                                                        <div className="small">
                                                            Same-club pairs: <strong>{drawProposal.alternativePlans[0].sameClubPairs}</strong>
                                                        </div>

                                                        <div className="small mt-2">
                                                            Section sizes: <strong>{drawProposal.alternativePlans[0].sectionSizes.join(" / ")}</strong>
                                                        </div>

                                                    </>
                                                )}

                                            </div>

                                        </div>

                                    </div>

                                </div>


                                <div className="d-flex justify-content-end gap-2 mt-4">

                                    <button
                                        type="button"
                                        className="btn btn-outline-secondary"
                                        onClick={clearDrawProposal}
                                    >
                                        Clear Proposal
                                    </button>

                                    <button
                                        type="button"
                                        className="btn btn-primary"
                                        onClick={handleConfirmDraw}
                                        disabled={confirmingDraw}
                                    >
                                        {confirmingDraw ? (
                                            <>
                                                <span className="spinner-border spinner-border-sm me-2"></span>
                                                Confirming...
                                            </>
                                        ) : (
                                            <>
                                                <i className="bi bi-check-lg me-2"></i>
                                                Confirm Draw
                                            </>
                                        )}
                                    </button>

                                </div>

                            </>

                        )}

                    </div>

                )}

            </div>
                </>
            )}

            {confirmedDraw && scheduleProposal && (
                <div id="workspace-schedule" className={`card shadow-sm border-0 mb-4 workspace-stage-card ${!showSetupDetails && workspaceStage !== "schedule" ? "workspace-collapsed" : ""}`}>
                    <div className="card-header bg-white d-flex justify-content-between align-items-center">
                        <div>
                            <h5 className="mb-0">
                                <i className="bi bi-calendar3 me-2"></i>
                                Schedule Proposal
                            </h5>
                            <div className="small text-muted mt-1">
                                Calculated from the confirmed draw. No dates or venues are being saved yet.
                            </div>
                        </div>
                        <span className="badge bg-info text-dark">Proposal only</span>
                    </div>

                    <div className="card-body">
                        <div className="row g-3 mb-4">
                            <div className="col-md-3">
                                <div className="border rounded p-3 h-100">
                                    <div className="text-muted small">Tournament Type</div>
                                    <div className="fw-bold">
                                        {scheduleProposal.competitionType === "weekend"
                                            ? "Weekend"
                                            : scheduleProposal.competitionType === "weekday" || scheduleProposal.competitionType === "week"
                                                ? "Weekday"
                                                : "Midweek"}
                                    </div>
                                </div>
                            </div>
                            <div className="col-md-3">
                                <div className="border rounded p-3 h-100">
                                    <div className="text-muted small">Playing Days Required</div>
                                    <div className="fs-4 fw-bold">{scheduleProposal.playingDaysRequired}</div>
                                </div>
                            </div>
                            <div className="col-md-3">
                                <div className="border rounded p-3 h-100">
                                    <div className="text-muted small">Sectional Rounds</div>
                                    <div className="fs-4 fw-bold">{scheduleProposal.sectionalRounds}</div>
                                </div>
                            </div>
                            <div className="col-md-3">
                                <div className="border rounded p-3 h-100">
                                    <div className="text-muted small">Playoff Rounds</div>
                                    <div className="fs-4 fw-bold">{scheduleProposal.playoffRounds}</div>
                                </div>
                            </div>
                        </div>

                        {scheduleProposal.competitionType === "weekend" && (
                            <div className="alert alert-info">
                                <strong>Weekend rule:</strong> maximum 3 rounds Saturday and 3 rounds Sunday.
                                Playoffs are placed on Sunday only when the complete playoff stage fits into the remaining Sunday capacity; otherwise the playoffs move to the next available Saturday.
                            </div>
                        )}

                        {(scheduleProposal.competitionType === "weekday" || scheduleProposal.competitionType === "week") && (
                            <div className="alert alert-info">
                                <strong>Weekday rule:</strong> playing days may be scheduled Monday to Friday, with a maximum of 3 rounds per playing day.
                            </div>
                        )}

                        <div className="row g-3">
                            {scheduleProposal.days.map(day => (
                                <div className="col-lg-4 col-md-6" key={day.key}>
                                    <div className="card border h-100">
                                        <div className="card-header bg-white">
                                            <strong>{day.label}</strong>
                                            <div className="small text-muted">{day.typeLabel}</div>
                                        </div>
                                        <div className="card-body">
                                            {day.rounds.map(round => (
                                                <div className="d-flex align-items-center border rounded p-2 mb-2" key={round.roundNumber}>
                                                    <span className="badge bg-primary me-2">R{round.roundNumber}</span>
                                                    <div>
                                                        <div className="fw-semibold">{round.roundName}</div>
                                                        <div className="small text-muted">{round.matchCount} matches</div>
                                                    </div>
                                                </div>
                                            ))}
                                            {!day.rounds.length && (
                                                <div className="text-muted small">No rounds scheduled.</div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {scheduleProposal.requiresAdditionalWeekend && (
                            <div className="alert alert-warning mt-4 mb-0">
                                <strong>Additional weekend required.</strong> The confirmed draw cannot fit into one weekend under the competition secretary's preferred 3-round Saturday / 3-round Sunday pattern.
                            </div>
                        )}

                        <hr className="my-4" />

                        <div className="d-flex justify-content-between align-items-center mb-3">
                            <div>
                                <h6 className="mb-1">Assign Actual Dates & Venues</h6>
                                <div className="small text-muted">
                                    The draw and round order are already confirmed. You are only assigning the proposed playing days to real calendar dates and venues.
                                </div>
                            </div>
                            <span className={`badge ${scheduleAssignments.length && scheduleAssignments.every(item => item.playing_date && item.venue_club_id) && confirmedDraw.rounds.every(round => round.competition_day_id) ? "bg-success" : "bg-secondary"}`}>
                                {scheduleAssignments.length && scheduleAssignments.every(item => item.playing_date && item.venue_club_id) && confirmedDraw.rounds.every(round => round.competition_day_id) ? "Schedule assigned" : "Dates & venues required"}
                            </span>
                        </div>

                        <div className="row g-3">
                            {scheduleAssignments.map((assignment, index) => (
                                <div className="col-12" key={assignment.key}>
                                    <div className="border rounded p-3">
                                        <div className="row g-3 align-items-end">
                                            <div className="col-lg-3">
                                                <div className="fw-semibold">{assignment.label}</div>
                                                <div className="small text-muted">{assignment.typeLabel}</div>
                                                <div className="small mt-1">
                                                    {scheduleProposal.days[index]?.rounds.map(round => round.roundName).join(" • ")}
                                                </div>
                                            </div>
                                            <div className="col-lg-3">
                                                <label className="form-label">Date</label>
                                                <input
                                                    type="date"
                                                    className="form-control"
                                                    value={assignment.playing_date}
                                                    onChange={e => handleScheduleAssignmentChange(index, "playing_date", e.target.value)}
                                                />
                                                <div className="small text-muted mt-1">
                                                    {scheduleProposal.competitionType === "weekend"
                                                        ? (assignment.label.includes("Saturday") ? "Saturday required" : "Sunday required")
                                                        : "Weekday required"}
                                                </div>
                                            </div>
                                            <div className="col-lg-4">
                                                <label className="form-label">Venue</label>
                                                <select
                                                    className="form-select"
                                                    value={assignment.venue_club_id}
                                                    onChange={e => handleScheduleAssignmentChange(index, "venue_club_id", e.target.value)}
                                                >
                                                    <option value="">Select venue...</option>
                                                    {clubs.map(club => (
                                                        <option key={club.id} value={club.id}>
                                                            {club.name}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div className="col-lg-2">
                                                <label className="form-label">Day Name</label>
                                                <input
                                                    type="text"
                                                    className="form-control"
                                                    value={assignment.name}
                                                    onChange={e => handleScheduleAssignmentChange(index, "name", e.target.value)}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="d-flex justify-content-end gap-2 mt-4">
                            <button
                                type="button"
                                className="btn btn-primary"
                                onClick={handleSaveSchedule}
                                disabled={savingSchedule || !scheduleAssignments.length}
                            >
                                {savingSchedule ? (
                                    <>
                                        <span className="spinner-border spinner-border-sm me-2"></span>
                                        Saving Schedule...
                                    </>
                                ) : (
                                    <>
                                        <i className="bi bi-calendar-check me-2"></i>
                                        Save Schedule
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}


            {confirmedDraw && (
                <div id="workspace-results" className={`card shadow-sm border-0 mb-4 workspace-stage-card ${!showSetupDetails && !["scoring", "playoffs"].includes(workspaceStage) ? "workspace-collapsed" : ""}`}>
                    <div className="card-header bg-white d-flex justify-content-between align-items-center">
                        <div>
                            <h5 className="mb-0">
                                <i className="bi bi-list-check me-2"></i>
                                Fixtures & Schedule
                            </h5>
                            <div className="small text-muted mt-1">
                                The confirmed fixtures grouped by their assigned playing day and round.
                            </div>
                        </div>
                        <span className={`badge ${confirmedDraw.rounds.length && confirmedDraw.rounds.every(round => round.competition_day_id) ? "bg-success" : "bg-secondary"}`}>
                            {confirmedDraw.rounds.length && confirmedDraw.rounds.every(round => round.competition_day_id)
                                ? "Scheduled"
                                : "Awaiting schedule"}
                        </span>
                    </div>

                    <div className="card-body">
                        {(() => {
                            const getTeamLabel = (match, side) => {
                                const team = side === "a" ? match.teamA : match.teamB;
                                if (team) {
                                    return getTeamDisplayName(team);
                                }

                                const roundNumber = match.round?.round_number;
                                const matchNumber = match.match_number;

                                if (roundNumber === 4 && confirmedDraw.sections.length === 8) {
                                    const pairs = [
                                        ["Section 1 Winner", "Section 3 Winner"],
                                        ["Section 2 Winner", "Section 4 Winner"],
                                        ["Section 5 Winner", "Section 7 Winner"],
                                        ["Section 6 Winner", "Section 8 Winner"]
                                    ];
                                    return pairs[matchNumber - 1]?.[side === "a" ? 0 : 1] || "Qualified team";
                                }

                                if (roundNumber === 5 && matchNumber <= 2) {
                                    const pairs = [
                                        ["Quarter Final 1 Winner", "Quarter Final 3 Winner"],
                                        ["Quarter Final 2 Winner", "Quarter Final 4 Winner"]
                                    ];
                                    return pairs[matchNumber - 1]?.[side === "a" ? 0 : 1] || "Quarter-final winner";
                                }

                                if (roundNumber === 6 && matchNumber === 1) {
                                    return side === "a" ? "Semi Final 1 Winner" : "Semi Final 2 Winner";
                                }

                                return "To be determined";
                            };

                            const getDayForRound = (round) =>
                                playingDays.find(day => day.id === round.competition_day_id);

                            const scheduledDays = playingDays
                                .filter(day => confirmedDraw.rounds.some(round => round.competition_day_id === day.id))
                                .sort((a, b) => (a.day_number || 0) - (b.day_number || 0));

                            const unassignedRounds = confirmedDraw.rounds.filter(round => !round.competition_day_id);

                            const renderRound = (round) => {
                                const matches = confirmedDraw.matches
                                    .filter(match => match.round_id === round.id)
                                    .sort((a, b) => (a.match_number || 0) - (b.match_number || 0));

                                return (
                                    <div className="border rounded mb-3" key={round.id}>
                                        <div className="px-3 py-2 bg-light border-bottom d-flex justify-content-between align-items-center">
                                            <div>
                                                <span className="badge bg-primary me-2">R{round.round_number}</span>
                                                <strong>{round.round_name}</strong>
                                            </div>
                                            <span className="small text-muted">{matches.length} {matches.length === 1 ? "match" : "matches"}</span>
                                        </div>

                                        <div className="table-responsive">
                                            <table className="table table-sm table-hover mb-0 align-middle">
                                                <thead>
                                                    <tr>
                                                        <th style={{ width: "70px" }}>Match</th>
                                                        <th>Team A</th>
                                                        <th className="text-center" style={{ width: "60px" }}>vs</th>
                                                        <th>Team B</th>
                                                        <th className="text-center" style={{ width: "145px" }}>Result</th>
                                                        <th className="text-end" style={{ width: "150px" }}>Status</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {matches.map(match => (
                                                        <tr key={match.id}>
                                                            <td className="fw-semibold">{match.match_number}</td>
                                                            <td>{getTeamLabel(match, "a")}</td>
                                                            <td className="text-center text-muted">vs</td>
                                                            <td>{getTeamLabel(match, "b")}</td>
                                                            <td className="text-center fw-semibold">
                                                                {match.score_a !== null && match.score_a !== undefined && match.score_b !== null && match.score_b !== undefined
                                                                    ? `${match.score_a} — ${match.score_b}`
                                                                    : "—"}
                                                            </td>
                                                            <td className="text-end">
                                                                {match.completed ? (
                                                                    <button
                                                                        type="button"
                                                                        className="btn btn-sm btn-outline-secondary"
                                                                        onClick={() => openResultEditor(match)}
                                                                    >
                                                                        Edit Result
                                                                    </button>
                                                                ) : (
                                                                    <button
                                                                        type="button"
                                                                        className="btn btn-sm btn-primary"
                                                                        disabled={!match.team_a_id || !match.team_b_id}
                                                                        onClick={() => openResultEditor(match)}
                                                                    >
                                                                        Enter Result
                                                                    </button>
                                                                )}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                    {!matches.length && (
                                                        <tr>
                                                            <td colSpan="6" className="text-muted text-center py-3">No fixtures found for this round.</td>
                                                        </tr>
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                );
                            };

                            return (
                                <>
                                    {/* Sectional scoring is grouped by section rather than by round.
                                        This makes it much easier for the scorer to find a specific game
                                        when matches finish in a different order to the draw order. */}
                                    {confirmedDraw.sections?.length > 0 && (
                                        <div className="mb-4" style={{ overflowAnchor: "none" }}>
                                            <div className="d-flex justify-content-between align-items-center mb-3">
                                                <div>
                                                    <h5 className="mb-1">Sectional Scoring</h5>
                                                    <div className="small text-muted">
                                                        Games are grouped by section. Completed sections automatically roll up.
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="row g-3">
                                                {confirmedDraw.sections.map(section => {
                                                    const sectionMatches = (section.matches || [])
                                                        .filter(match => match.section_id !== null && match.section_id !== undefined)
                                                        .sort((a, b) => {
                                                            const roundDiff = (a.round?.round_number || 0) - (b.round?.round_number || 0);
                                                            if (roundDiff !== 0) return roundDiff;
                                                            return (a.match_number || 0) - (b.match_number || 0);
                                                        });

                                                    const sectionTeamCount = section.teams?.length || 0;
                                                    const requiredGames = sectionTeamCount > 0 ? sectionTeamCount - 1 : 0;
                                                    const completedGames = sectionMatches.filter(match => match.completed).length;
                                                    const complete = requiredGames > 0 && completedGames === sectionMatches.length && sectionMatches.length === (sectionTeamCount * (sectionTeamCount - 1)) / 2;
                                                    const winner = complete ? getSectionStandings(section.id)[0] : null;
                                                    const manuallyCollapsed = collapsedScoringSections[section.id];
                                                    const collapsed = manuallyCollapsed ?? complete;

                                                    const matchesByRound = sectionMatches.reduce((groups, match) => {
                                                        const roundNumber = match.round?.round_number || 0;
                                                        if (!groups[roundNumber]) groups[roundNumber] = [];
                                                        groups[roundNumber].push(match);
                                                        return groups;
                                                    }, {});

                                                    return (
                                                        <div className="col-12" key={section.id} id={`scoring-section-${section.id}`}>
                                                            <div
                                                                ref={element => { scoringSectionRefs.current[section.id] = element; }}
                                                                className={`card border ${collapsed ? "workspace-section-collapsed" : ""}`}
                                                                style={{ overflowAnchor: "none" }}
                                                            >
                                                                <div className="card-header bg-white d-flex justify-content-between align-items-center">
                                                                    <div>
                                                                        <strong>{section.section_name}</strong>
                                                                        <span className="badge bg-light text-dark border ms-2">{sectionTeamCount} teams</span>
                                                                    </div>
                                                                    <div className="d-flex align-items-center gap-2">
                                                                        {winner ? (
                                                                            <span className="badge bg-success">Winner: <TeamDisplay team={winner.team} /></span>
                                                                        ) : (
                                                                            <span className="badge bg-secondary">{completedGames}/{sectionMatches.length} games complete</span>
                                                                        )}
                                                                        <button
                                                                            type="button"
                                                                            className="btn btn-sm btn-outline-secondary"
                                                                            onClick={() => toggleScoringSection(section.id)}
                                                                            title={collapsed ? "Expand section" : "Collapse section"}
                                                                        >
                                                                            <i className={`bi ${collapsed ? "bi-chevron-down" : "bi-chevron-up"}`}></i>
                                                                        </button>
                                                                    </div>
                                                                </div>

                                                                {!collapsed && (
                                                                    <div className="card-body">
                                                                        {Object.keys(matchesByRound).sort((a, b) => Number(a) - Number(b)).map(roundNumber => {
                                                                            const roundMatches = matchesByRound[roundNumber];
                                                                            const round = confirmedDraw.rounds.find(r => r.round_number === Number(roundNumber));
                                                                            const day = round?.competition_day_id ? playingDays.find(d => d.id === round.competition_day_id) : null;
                                                                            const venue = day?.clubs?.name || clubs.find(club => club.id === day?.venue_club_id)?.name;

                                                                            return (
                                                                                <div className="mb-3" key={roundNumber}>
                                                                                    <div className="d-flex justify-content-between align-items-center mb-2">
                                                                                        <div className="fw-semibold">
                                                                                            <span className="badge bg-primary me-2">R{roundNumber}</span>
                                                                                            {round?.round_name || `Sectional Round ${roundNumber}`}
                                                                                        </div>
                                                                                        <div className="small text-muted">
                                                                                            {day?.playing_date || "Date not assigned"}{venue ? ` • ${venue}` : ""}
                                                                                        </div>
                                                                                    </div>

                                                                                    <div className="table-responsive">
                                                                                        <table className="table table-sm table-hover table-bordered mb-0 align-middle">
                                                                                            <thead>
                                                                                                <tr>
                                                                                                    <th style={{ width: "70px" }}>Match</th>
                                                                                                    <th>Team A</th>
                                                                                                    <th className="text-center" style={{ width: "50px" }}>vs</th>
                                                                                                    <th>Team B</th>
                                                                                                    <th className="text-center" style={{ width: "145px" }}>Result</th>
                                                                                                    <th className="text-end" style={{ width: "150px" }}>Status</th>
                                                                                                </tr>
                                                                                            </thead>
                                                                                            <tbody>
                                                                                                {roundMatches.map(match => (
                                                                                                    <tr key={match.id}>
                                                                                                        <td className="fw-semibold">{match.match_number}</td>
                                                                                                        <td>{getTeamLabel(match, "a")}</td>
                                                                                                        <td className="text-center text-muted">vs</td>
                                                                                                        <td>{getTeamLabel(match, "b")}</td>
                                                                                                        <td className="text-center fw-semibold">
                                                                                                            {match.score_a !== null && match.score_a !== undefined && match.score_b !== null && match.score_b !== undefined ? (
                                                                                                                <div className="bowlpoint-result-display">
                                                                                                                    <div className="bowlpoint-result-score">
                                                                                                                        {match.score_a} <span className="bowlpoint-result-separator">—</span> {match.score_b}
                                                                                                                    </div>
                                                                                                                    {competition?.scoring?.skins?.enabled && (
                                                                                                                        <div className="bowlpoint-result-skins">
                                                                                                                            <span>{match.skins_a ?? 0} {Number(match.skins_a ?? 0) === 1 ? "skin" : "skins"}</span>
                                                                                                                            <span className="bowlpoint-result-skins-separator">—</span>
                                                                                                                            <span>{match.skins_b ?? 0} {Number(match.skins_b ?? 0) === 1 ? "skin" : "skins"}</span>
                                                                                                                        </div>
                                                                                                                    )}
                                                                                                                </div>
                                                                                                            ) : "—"}
                                                                                                        </td>
                                                                                                        <td className="text-end">
                                                                                                            {match.completed ? (
                                                                                                                <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => openResultEditor(match)}>Edit Result</button>
                                                                                                            ) : (
                                                                                                                <button type="button" className="btn btn-sm btn-primary" disabled={!match.team_a_id || !match.team_b_id} onClick={() => openResultEditor(match)}>Enter Result</button>
                                                                                                            )}
                                                                                                        </td>
                                                                                                    </tr>
                                                                                                ))}
                                                                                                {(() => {
                                                                                                    const byeTeam = getSectionByeTeam(section, roundNumber);
                                                                                                    return byeTeam ? (
                                                                                                        <tr key={`bye-${section.id}-${roundNumber}`} className="table-warning">
                                                                                                            <td className="fw-semibold">—</td>
                                                                                                            <td className="fw-semibold">{getTeamLabel({ teamA: byeTeam }, "a")}</td>
                                                                                                            <td className="text-center">—</td>
                                                                                                            <td className="fw-semibold">BYE</td>
                                                                                                            <td className="text-center fw-semibold">—</td>
                                                                                                            <td className="text-end"><span className="badge bg-warning text-dark">BYE</span></td>
                                                                                                        </tr>
                                                                                                    ) : null;
                                                                                                })()}
                                                                                            </tbody>
                                                                                        </table>
                                                                                    </div>
                                                                                </div>
                                                                            );
                                                                        })}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}

                                    {/* Playoffs remain grouped by round because they are not section-specific. */}
                                    {confirmedDraw.rounds.some(round => playoffMatches.some(match => match.round_id === round.id)) && (
                                        <div className="mb-4">
                                            <div className="d-flex justify-content-between align-items-center mb-3">
                                                <div>
                                                    <h5 className="mb-1">Playoff Scoring</h5>
                                                    <div className="small text-muted">Quarter-finals, semi-finals and final.</div>
                                                </div>
                                            </div>
                                            {confirmedDraw.rounds.filter(round => playoffMatches.some(match => match.round_id === round.id)).sort((a, b) => a.round_number - b.round_number).map(renderRound)}
                                        </div>
                                    )}

                                    {confirmedDraw.sections?.length > 0 && (
                                        <div id="workspace-section-standings" className="mt-4 pt-3 border-top" style={{ overflowAnchor: "none" }}>
                                            <div className="d-flex justify-content-between align-items-center mb-3">
                                                <div>
                                                    <h5 className="mb-1">Section Standings</h5>
                                                    <div className="small text-muted">Points first, then Aggregate (Shots For − Shots Against).</div>
                                                </div>
                                            </div>

                                            <div className="row g-3">
                                                {confirmedDraw.sections.map(section => {
                                                    const standings = getSectionStandings(section.id);
                                                    const complete = standings.length > 0 && standings.every(row => row.played === standings.length - 1);
                                                    const winner = complete ? standings[0] : null;

                                                    return (
                                                        <div className="col-12" key={section.id}>
                                                            <div
                                                                ref={element => { scoringSectionRefs.current[section.id] = element; }}
                                                                className={`card border h-100 ${collapsedScoringSections[section.id] ? "workspace-section-collapsed" : ""}`}
                                                                style={{ overflowAnchor: "none" }}
                                                            >
                                                                <div className="card-header bg-white d-flex justify-content-between align-items-center">
                                                                    <strong>{section.section_name}</strong>
                                                                    {winner ? (
                                                                        <span className="badge bg-success">Winner: <TeamDisplay team={winner.team} /></span>
                                                                    ) : (
                                                                        <span className="badge bg-secondary">In progress</span>
                                                                    )}
                                                                    <button type="button" className="btn btn-sm btn-link text-decoration-none ms-2" onClick={() => toggleScoringSection(section.id)}>
                                                                        <i className={`bi ${collapsedScoringSections[section.id] ? "bi-chevron-down" : "bi-chevron-up"}`}></i>
                                                                    </button>
                                                                </div>
                                                                <div className="table-responsive">
                                                                    <table className="table table-sm mb-0 align-middle">
                                                                        <thead>
                                                                            <tr>
                                                                                <th>#</th>
                                                                                <th>Team</th>
                                                                                <th className="text-center">P</th>
                                                                                <th className="text-center">W</th>
                                                                                <th className="text-center">D</th>
                                                                                <th className="text-center">L</th>
                                                                                {competition?.scoring?.skins?.enabled && <th className="text-center">Skins</th>}
                                                                                <th className="text-center">Pts</th>
                                                                                <th className="text-center">Agg</th>
                                                                            </tr>
                                                                        </thead>
                                                                        <tbody>
                                                                            {standings.map((row, index) => (
                                                                                <tr key={row.teamId} className={winner?.teamId === row.teamId ? "table-success" : ""}>
                                                                                    <td>{index + 1}</td>
                                                                                    <td className="fw-semibold"><TeamDisplay team={row.team} /></td>
                                                                                    <td className="text-center">{row.played}</td>
                                                                                    <td className="text-center">{row.wins}</td>
                                                                                    <td className="text-center">{row.draws}</td>
                                                                                    <td className="text-center">{row.losses}</td>
                                                                                    {competition?.scoring?.skins?.enabled && <td className="text-center">{row.skinsWon}</td>}
                                                                                    <td className="text-center fw-bold">{row.points}</td>
                                                                                    <td className="text-center">{row.aggregate > 0 ? `+${row.aggregate}` : row.aggregate}</td>
                                                                                </tr>
                                                                            ))}
                                                                        </tbody>
                                                                    </table>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}

                                    <div className="d-flex justify-content-between align-items-center mt-4 pt-3 border-top">
                                        <div className="small text-muted">
                                            Enter results here. Completed sections automatically roll up so the next active section stays in focus.
                                        </div>
                                        <div className="small text-muted">
                                            Enter completed results to update points and Aggregate. Section winners will advance automatically when their sectional stage is complete.
                                        </div>
                                    </div>
                                </>
                            );
                        })()}
                    </div>
                </div>
            )}


            {resultSavedMessage && (
                <div
                    className="position-fixed bottom-0 end-0 p-3"
                    style={{ zIndex: 1080 }}
                >
                    <div className="alert alert-success shadow-sm mb-0 d-flex align-items-center" role="status">
                        <i className="bi bi-check-circle-fill me-2"></i>
                        {resultSavedMessage}
                    </div>
                </div>
            )}

            {selectedMatch && (
                <div className="modal d-block" tabIndex="-1" style={{ backgroundColor: "rgba(0,0,0,0.45)" }}>
                    <div className="modal-dialog modal-dialog-centered">
                        <div className="modal-content">
                            <div className="modal-header">
                                <h5 className="modal-title">{selectedMatch.completed ? "Edit Result" : "Enter Result"}</h5>
                                <button type="button" className="btn-close" onClick={closeResultEditor} disabled={savingResult}></button>
                            </div>
                            <form onSubmit={handleSaveResult}>
                                <div className="modal-body">
                                    <div className="small text-muted mb-3">
                                        {selectedMatch.round?.round_name || "Match"} • Match {selectedMatch.match_number}
                                    </div>
                                    <div className="row g-3 align-items-end">
                                        <div className={competition?.scoring?.skins?.enabled ? "col-5" : "col-5"}>
                                            <label className="form-label fw-semibold">{getMatchTeamName(selectedMatch, "a")}</label>
                                            <input
                                                type="number" min="0" step="1"
                                                className="form-control form-control-lg text-center"
                                                value={resultForm.score_a}
                                                onChange={e => setResultForm(prev => ({ ...prev, score_a: e.target.value }))}
                                                autoFocus required
                                            />
                                            {competition?.scoring?.skins?.enabled && (
                                                <div className="mt-2">
                                                    <label className="form-label small fw-semibold mb-1">Skins</label>
                                                    <input type="number" min="0" step="1" className="form-control text-center" value={resultForm.skins_a} onChange={e => setResultForm(prev => ({ ...prev, skins_a: e.target.value }))} required />
                                                </div>
                                            )}
                                        </div>
                                        <div className="col-2 text-center pb-2 fw-bold">VS</div>
                                        <div className="col-5">
                                            <label className="form-label fw-semibold">{getMatchTeamName(selectedMatch, "b")}</label>
                                            <input
                                                type="number" min="0" step="1"
                                                className="form-control form-control-lg text-center"
                                                value={resultForm.score_b}
                                                onChange={e => setResultForm(prev => ({ ...prev, score_b: e.target.value }))}
                                                required
                                            />
                                            {competition?.scoring?.skins?.enabled && (
                                                <div className="mt-2">
                                                    <label className="form-label small fw-semibold mb-1">Skins</label>
                                                    <input type="number" min="0" step="1" className="form-control text-center" value={resultForm.skins_b} onChange={e => setResultForm(prev => ({ ...prev, skins_b: e.target.value }))} required />
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <div className="alert alert-light border mt-3 mb-0 small">
                                        Win = {competition?.scoring?.win ?? 2} points, Draw = {competition?.scoring?.draw ?? 1} points, Loss = {competition?.scoring?.loss ?? 0} points.
                                        {competition?.scoring?.skins?.enabled ? ` Each skin is worth ${competition.scoring.skins.pointsPerSkin ?? 1} additional point(s).` : ""}
                                        {" "}Aggregate is calculated from total Shots For minus Shots Against.
                                    </div>
                                </div>
                                <div className="modal-footer">
                                    <button type="button" className="btn btn-outline-secondary" onClick={closeResultEditor} disabled={savingResult}>Cancel</button>
                                    <button type="submit" className="btn btn-primary" disabled={savingResult}>
                                        {savingResult ? "Saving..." : "Save Result"}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            <div className="alert alert-light border mb-4">

                <div className="fw-semibold">Next step</div>

                <div className="small text-muted mt-1">
                    {confirmedDraw ? "Enter match results to update sectional standings and automatically advance section winners into the playoff bracket." : "Once the draw proposal is accepted, BowlPoint will create the sections, rounds and fixtures. Only then will the Playing Schedule be used to assign actual dates and venues."}
                </div>

            </div>

            <div className="row g-4 mb-4 align-items-stretch">

                <div className="col-lg-6">

                    <div className="card shadow-sm border-0 h-100">

                        <div className="card-body p-4">

                            <h5 className="mb-2">
                                <i className="bi bi-bar-chart me-2"></i>
                                Results & Live Scoring
                            </h5>

                            <p className="text-muted mb-3">
                                Capture results and provide live competition standings.
                            </p>

                            <div className="small text-success fw-semibold">
                                Result entry is available from the scheduled fixtures above.
                            </div>

                        </div>

                    </div>

                </div>

                <div className="col-lg-6">

                    <CompetitionLiveCard
                        competition={competition}
                    />

                </div>

            </div>

            </div>
        </>
    );
}

export default CompetitionWorkspace;