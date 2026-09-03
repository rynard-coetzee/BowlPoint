import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";

function teamLabel(team) {
    if (!team) return "TBD";
    return team.team_name || `Team ${team.team_number}`;
}

function calculateStandings(section, matches, scoring) {
    const winPoints = Number(scoring?.win ?? 2);
    const drawPoints = Number(scoring?.draw ?? 1);
    const lossPoints = Number(scoring?.loss ?? 0);

    return (section.teams || []).map(team => {
        const row = {
            team,
            played: 0,
            wins: 0,
            draws: 0,
            losses: 0,
            points: 0,
            shotsFor: 0,
            shotsAgainst: 0,
            aggregate: 0
        };

        matches
            .filter(match => match.section_id === section.id && match.completed)
            .forEach(match => {
                if (match.team_a_id !== team.id && match.team_b_id !== team.id) return;

                const isA = match.team_a_id === team.id;
                const sf = Number(isA ? match.score_a : match.score_b);
                const sa = Number(isA ? match.score_b : match.score_a);

                row.played += 1;
                row.shotsFor += sf;
                row.shotsAgainst += sa;

                if (sf > sa) {
                    row.wins += 1;
                    row.points += winPoints;
                } else if (sf === sa) {
                    row.draws += 1;
                    row.points += drawPoints;
                } else {
                    row.losses += 1;
                    row.points += lossPoints;
                }
            });

        row.aggregate = row.shotsFor - row.shotsAgainst;
        return row;
    }).sort((a, b) =>
        b.points - a.points ||
        b.aggregate - a.aggregate ||
        b.shotsFor - a.shotsFor ||
        (a.team.team_number || 0) - (b.team.team_number || 0)
    );
}

function StatusBadge({ status }) {
    const config = {
        draft: ["bg-secondary", "Draft"],
        registration: ["bg-info text-dark", "Registration"],
        draw_generated: ["bg-primary", "Draw Generated"],
        in_progress: ["bg-warning text-dark", "Live"],
        completed: ["bg-success", "Completed"],
        cancelled: ["bg-danger", "Cancelled"]
    };

    const [className, label] = config[status] || ["bg-secondary", status || "Competition"];
    return <span className={`badge ${className}`}>{label}</span>;
}

function CompetitionLive() {
    const { publicCode } = useParams();
    const [competition, setCompetition] = useState(null);
    const [teams, setTeams] = useState([]);
    const [rounds, setRounds] = useState([]);
    const [sections, setSections] = useState([]);
    const [matches, setMatches] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [lastUpdated, setLastUpdated] = useState(null);

    const loadData = useCallback(async () => {
        if (!publicCode) return;

        setError("");

        const competitionResult = await supabase
            .from("competitions")
            .select("id, name, status, public_code, format, structure, scoring, start_date, end_date")
            .eq("public_code", publicCode.toUpperCase())
            .maybeSingle();

        if (competitionResult.error) throw competitionResult.error;
        if (!competitionResult.data) {
            setCompetition(null);
            setError("Competition not found or is not available publicly.");
            setLoading(false);
            return;
        }

        const competitionId = competitionResult.data.id;

        const [teamsResult, roundsResult, sectionsResult, matchesResult] = await Promise.all([
            supabase
                .from("competition_teams")
                .select("id, competition_id, club_id, team_number, team_name, status")
                .eq("competition_id", competitionId)
                .order("team_number"),
            supabase
                .from("competition_rounds")
                .select("id, competition_id, competition_day_id, round_number, round_name, status, competition_days(id, day_number, playing_date, name, venue_club_id)")
                .eq("competition_id", competitionId)
                .order("round_number"),
            supabase
                .from("competition_sections")
                .select("id, competition_id, section_number, section_name")
                .eq("competition_id", competitionId)
                .order("section_number"),
            supabase
                .from("competition_matches")
                .select("id, competition_id, round_id, section_id, match_number, team_a_id, team_b_id, score_a, score_b, completed, completed_at, next_match_id, next_match_slot")
                .eq("competition_id", competitionId)
                .order("match_number")
        ]);

        if (teamsResult.error) throw teamsResult.error;
        if (roundsResult.error) throw roundsResult.error;
        if (sectionsResult.error) throw sectionsResult.error;
        if (matchesResult.error) throw matchesResult.error;

        const teamById = new Map((teamsResult.data || []).map(team => [team.id, team]));
        const roundById = new Map((roundsResult.data || []).map(round => [round.id, round]));

        const sectionIds = (sectionsResult.data || []).map(section => section.id);
        const sectionTeamsResult = sectionIds.length
            ? await supabase
                .from("competition_section_teams")
                .select("id, section_id, competition_team_id")
                .in("section_id", sectionIds)
            : { data: [], error: null };

        if (sectionTeamsResult.error) throw sectionTeamsResult.error;

        const sectionTeams = sectionTeamsResult.data || [];
        const hydratedSections = (sectionsResult.data || []).map(section => ({
            ...section,
            teams: sectionTeams
                .filter(row => row.section_id === section.id)
                .map(row => teamById.get(row.competition_team_id))
                .filter(Boolean)
        }));

        const hydratedMatches = (matchesResult.data || []).map(match => ({
            ...match,
            teamA: teamById.get(match.team_a_id),
            teamB: teamById.get(match.team_b_id),
            round: roundById.get(match.round_id)
        }));

        setCompetition(competitionResult.data);
        setTeams(teamsResult.data || []);
        setRounds(roundsResult.data || []);
        setSections(hydratedSections);
        setMatches(hydratedMatches);
        setLastUpdated(new Date());
        setLoading(false);
    }, [publicCode]);

    useEffect(() => {
        let cancelled = false;

        const run = async () => {
            try {
                if (!cancelled) setLoading(true);
                await loadData();
            } catch (loadError) {
                if (!cancelled) {
                    console.error("Unable to load public competition:", loadError);
                    setError(loadError.message || "Unable to load competition.");
                    setLoading(false);
                }
            }
        };

        run();
        return () => { cancelled = true; };
    }, [loadData]);

    useEffect(() => {
        if (!competition?.id) return undefined;

        const fallbackRefresh = window.setInterval(() => {
            loadData();
        }, 15000);

        const channel = supabase
            .channel(`competition-live-${competition.id}`)
            .on(
                "postgres_changes",
                {
                    event: "*",
                    schema: "public",
                    table: "competition_matches",
                    filter: `competition_id=eq.${competition.id}`
                },
                () => loadData()
            )
            .on(
                "postgres_changes",
                {
                    event: "*",
                    schema: "public",
                    table: "competitions",
                    filter: `id=eq.${competition.id}`
                },
                () => loadData()
            )
            .subscribe();

        return () => {
            window.clearInterval(fallbackRefresh);
            supabase.removeChannel(channel);
        };
    }, [competition?.id, loadData]);

    const sectionalRoundNumber = useMemo(() => {
        const numbers = matches
            .filter(match => match.section_id !== null && match.round?.round_number)
            .map(match => match.round.round_number);
        return numbers.length ? Math.max(...numbers) : 0;
    }, [matches]);

    const currentRound = useMemo(() => {
        return rounds.find(round => {
            const roundMatches = matches.filter(match => match.round_id === round.id);
            return roundMatches.length > 0 && roundMatches.some(match => !match.completed);
        }) || null;
    }, [rounds, matches]);

    const recentResults = useMemo(() => {
        return matches
            .filter(match => match.completed)
            .sort((a, b) => new Date(b.completed_at || 0) - new Date(a.completed_at || 0))
            .slice(0, 8);
    }, [matches]);

    const playoffRounds = useMemo(() => {
        return rounds
            .filter(round => round.round_number > sectionalRoundNumber)
            .map(round => ({
                ...round,
                matches: matches
                    .filter(match => match.round_id === round.id)
                    .sort((a, b) => a.match_number - b.match_number)
            }));
    }, [rounds, matches, sectionalRoundNumber]);

    const sectionalRounds = useMemo(() => {
        return rounds
            .filter(round => round.round_number <= sectionalRoundNumber)
            .map(round => ({
                ...round,
                matches: matches
                    .filter(match => match.round_id === round.id && match.section_id)
                    .sort((a, b) => a.match_number - b.match_number)
            }))
            .filter(round => round.matches.length);
    }, [rounds, matches, sectionalRoundNumber]);

    const competitionProgress = useMemo(() => {
        const completed = matches.filter(match => match.completed).length;
        return {
            completed,
            total: matches.length,
            percent: matches.length ? Math.round((completed / matches.length) * 100) : 0
        };
    }, [matches]);

    if (loading) {
        return (
            <div className="container py-5 text-center">
                <div className="spinner-border text-primary mb-3"></div>
                <div className="text-muted">Loading live competition...</div>
            </div>
        );
    }

    if (error || !competition) {
        return (
            <div className="container py-5">
                <div className="card shadow-sm border-0">
                    <div className="card-body text-center py-5">
                        <i className="bi bi-exclamation-circle fs-1 text-danger"></i>
                        <h2 className="mt-3">Competition unavailable</h2>
                        <p className="text-muted mb-0">{error || "This competition could not be found."}</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-vh-100 bg-light">
            <div className="container py-3 py-md-5" style={{ maxWidth: 1100 }}>
                <div className="card shadow-sm border-0 mb-3 mb-md-4">
                    <div className="card-body p-3 p-md-4">
                        <div className="d-flex justify-content-between align-items-start gap-3 flex-wrap">
                            <div>
                                <div className="text-uppercase small text-muted fw-semibold mb-1">BowlPoint Live Competition</div>
                                <h1 className="h2 mb-2">{competition.name}</h1>
                                <div className="d-flex flex-wrap gap-2 align-items-center">
                                    <StatusBadge status={competition.status} />
                                    {currentRound && <span className="badge bg-light text-dark border">{currentRound.round_name || `Round ${currentRound.round_number}`}</span>}
                                </div>
                            </div>
                            <div className="text-md-end">
                                <div className="small text-muted">Competition code</div>
                                <div className="fs-4 fw-bold font-monospace">{competition.public_code}</div>
                                <div className="small text-muted mt-1">Live updates enabled</div>
                            </div>
                        </div>
                        <div className="mt-4">
                            <div className="d-flex justify-content-between small mb-1">
                                <span className="text-muted">Competition progress</span>
                                <strong>{competitionProgress.completed} / {competitionProgress.total} matches</strong>
                            </div>
                            <div className="progress" style={{ height: 8 }}>
                                <div className="progress-bar bg-success" role="progressbar" style={{ width: `${competitionProgress.percent}%` }} aria-valuenow={competitionProgress.percent} aria-valuemin="0" aria-valuemax="100"></div>
                            </div>
                        </div>
                    </div>
                </div>

                {currentRound && (
                    <div className="alert alert-primary border-0 shadow-sm mb-3 mb-md-4">
                        <i className="bi bi-broadcast me-2"></i>
                        <strong>Live now:</strong> {currentRound.round_name || `Round ${currentRound.round_number}`}
                        {currentRound.competition_days?.playing_date ? ` • ${currentRound.competition_days.playing_date}` : ""}
                    </div>
                )}

                {sections.length > 0 && (
                    <>
                        <div className="d-flex justify-content-between align-items-end mb-2">
                            <div>
                                <h2 className="h4 mb-1">Section Standings</h2>
                                <div className="text-muted small">Points first, then aggregate, then shots for.</div>
                            </div>
                        </div>

                        <div className="row g-3 mb-4">
                            {sections.map(section => {
                                const standings = calculateStandings(section, matches, competition.scoring);
                                const sectionMatches = matches.filter(match => match.section_id === section.id);
                                const complete = sectionMatches.length > 0 && sectionMatches.every(match => match.completed);

                                return (
                                    <div className="col-12 col-lg-6" key={section.id}>
                                        <div className="card shadow-sm border-0 h-100">
                                            <div className="card-header bg-white d-flex justify-content-between align-items-center">
                                                <strong>{section.section_name}</strong>
                                                <span className={`badge ${complete ? "bg-success" : "bg-secondary"}`}>
                                                    {complete ? "Complete" : `${sectionMatches.filter(match => match.completed).length}/${sectionMatches.length}`}
                                                </span>
                                            </div>
                                            <div className="table-responsive">
                                                <table className="table table-sm mb-0 align-middle">
                                                    <thead className="table-light">
                                                        <tr>
                                                            <th style={{ width: 42 }}>#</th>
                                                            <th>Team</th>
                                                            <th className="text-center">P</th>
                                                            <th className="text-center">Pts</th>
                                                            <th className="text-center">Agg</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {standings.map((row, index) => (
                                                            <tr key={row.team.id} className={index === 0 && complete ? "table-success" : ""}>
                                                                <td className="fw-semibold">{index + 1}</td>
                                                                <td>
                                                                    <div className="fw-semibold">{teamLabel(row.team)}</div>
                                                                </td>
                                                                <td className="text-center">{row.played}</td>
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
                    </>
                )}

                {sectionalRounds.length > 0 && (
                    <div className="card shadow-sm border-0 mb-4">
                        <div className="card-header bg-white d-flex justify-content-between align-items-center">
                            <div>
                                <h2 className="h5 mb-1"><i className="bi bi-grid-3x3-gap me-2"></i>Sectional Fixtures & Results</h2>
                                <div className="small text-muted">Games are grouped by section so spectators can quickly find a specific match.</div>
                            </div>
                            <span className="badge bg-primary">{sectionalRounds.length} rounds</span>
                        </div>
                        <div className="card-body">
                            {sections.map(section => {
                                const sectionMatches = matches
                                    .filter(match => match.section_id === section.id)
                                    .sort((a, b) => (a.round?.round_number || 0) - (b.round?.round_number || 0) || a.match_number - b.match_number);
                                if (!sectionMatches.length) return null;
                                return (
                                    <div className="border rounded mb-3" key={section.id}>
                                        <div className="bg-light border-bottom px-3 py-2 d-flex justify-content-between align-items-center">
                                            <strong>{section.section_name}</strong>
                                            <span className="small text-muted">{sectionMatches.filter(m => m.completed).length}/{sectionMatches.length} complete</span>
                                        </div>
                                        <div className="table-responsive">
                                            <table className="table table-sm align-middle mb-0">
                                                <thead className="table-light">
                                                    <tr>
                                                        <th>Round</th>
                                                        <th>Match</th>
                                                        <th className="text-end">Team A</th>
                                                        <th className="text-center">Score</th>
                                                        <th>Team B</th>
                                                        <th className="text-end">Status</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {sectionMatches.map(match => (
                                                        <tr key={match.id}>
                                                            <td className="small">{match.round?.round_name || `Round ${match.round?.round_number || ""}`}</td>
                                                            <td className="small">#{match.match_number}</td>
                                                            <td className="text-end fw-semibold">{teamLabel(match.teamA)}</td>
                                                            <td className="text-center fw-bold">{match.completed ? `${match.score_a} — ${match.score_b}` : "vs"}</td>
                                                            <td className="fw-semibold">{teamLabel(match.teamB)}</td>
                                                            <td className="text-end">
                                                                <span className={`badge ${match.completed ? "bg-success" : match.team_a_id && match.team_b_id ? "bg-primary" : "bg-secondary"}`}>
                                                                    {match.completed ? "Final" : match.team_a_id && match.team_b_id ? "Scheduled" : "TBD"}
                                                                </span>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                <div className="row g-3 mb-4">
                    <div className="col-12 col-lg-7">
                        <div className="card shadow-sm border-0 h-100">
                            <div className="card-header bg-white">
                                <h2 className="h5 mb-0"><i className="bi bi-clock-history me-2"></i>Recent Results</h2>
                            </div>
                            <div className="card-body p-0">
                                {recentResults.length === 0 ? (
                                    <div className="p-4 text-muted text-center">No results have been recorded yet.</div>
                                ) : (
                                    <div className="list-group list-group-flush">
                                        {recentResults.map(match => (
                                            <div className="list-group-item px-3 px-md-4" key={match.id}>
                                                <div className="row align-items-center g-2">
                                                    <div className="col-5 text-end fw-semibold">{teamLabel(match.teamA)}</div>
                                                    <div className="col-2 text-center"><span className="badge bg-dark fs-6">{match.score_a} — {match.score_b}</span></div>
                                                    <div className="col-5 fw-semibold">{teamLabel(match.teamB)}</div>
                                                </div>
                                                <div className="small text-muted text-center mt-1">{match.round?.round_name || `Round ${match.round?.round_number || ""}`}</div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="col-12 col-lg-5">
                        <div className="card shadow-sm border-0 h-100">
                            <div className="card-header bg-white">
                                <h2 className="h5 mb-0"><i className="bi bi-info-circle me-2"></i>Competition</h2>
                            </div>
                            <div className="card-body">
                                <div className="row g-3">
                                    <div className="col-6"><div className="small text-muted">Teams</div><div className="fs-5 fw-bold">{teams.length}</div></div>
                                    <div className="col-6"><div className="small text-muted">Matches</div><div className="fs-5 fw-bold">{matches.length}</div></div>
                                    <div className="col-6"><div className="small text-muted">Completed</div><div className="fs-5 fw-bold">{matches.filter(match => match.completed).length}</div></div>
                                    <div className="col-6"><div className="small text-muted">Remaining</div><div className="fs-5 fw-bold">{matches.filter(match => !match.completed).length}</div></div>
                                </div>
                                {lastUpdated && <div className="small text-muted mt-4">Updated {lastUpdated.toLocaleTimeString()}</div>}
                            </div>
                        </div>
                    </div>
                </div>

                {playoffRounds.length > 0 && (
                    <div className="card shadow-sm border-0 mb-4">
                        <div className="card-header bg-white">
                            <h2 className="h5 mb-0"><i className="bi bi-trophy me-2"></i>Playoffs</h2>
                        </div>
                        <div className="card-body">
                            <div className="row g-3">
                                {playoffRounds.map(round => (
                                    <div className="col-12 col-md-6 col-xl-4" key={round.id}>
                                        <div className="border rounded h-100 p-3">
                                            <div className="fw-bold mb-2">{round.round_name || `Round ${round.round_number}`}</div>
                                            {round.matches.length === 0 ? (
                                                <div className="small text-muted">No fixtures yet.</div>
                                            ) : round.matches.map(match => (
                                                <div className="border rounded p-2 mb-2" key={match.id}>
                                                    <div className="d-flex justify-content-between gap-2">
                                                        <span>{teamLabel(match.teamA)}</span>
                                                        <strong>{match.completed ? match.score_a : ""}</strong>
                                                    </div>
                                                    <div className="d-flex justify-content-between gap-2 mt-1">
                                                        <span>{teamLabel(match.teamB)}</span>
                                                        <strong>{match.completed ? match.score_b : ""}</strong>
                                                    </div>
                                                    <div className="small text-muted mt-1">
                                                        {match.completed ? "Completed" : match.team_a_id && match.team_b_id ? "Ready" : "Waiting for previous result"}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                <div className="text-center text-muted small pb-3">
                    BowlPoint Live • Results update automatically while this page is open.
                </div>
            </div>
        </div>
    );
}

export default CompetitionLive;
