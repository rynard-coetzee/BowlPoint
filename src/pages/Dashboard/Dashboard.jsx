import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";

function Dashboard() {
    const [competitions, setCompetitions] = useState([]);
    const [competitionStats, setCompetitionStats] = useState({});
    const [todayFixtures, setTodayFixtures] = useState([]);
    const [loading, setLoading] = useState(true);

    const today = new Date().toISOString().slice(0, 10);

    const loadDashboard = async () => {
        setLoading(true);

        try {
            const { data: competitionRows, error: competitionError } =
                await supabase
                    .from("competitions")
                    .select("*")
                    .order("created_at", { ascending: false });

            if (competitionError) throw competitionError;

            const rows = competitionRows || [];
            setCompetitions(rows);

            const stats = {};
            const statsResults = await Promise.all(
                rows.map(async (competition) => {
                    const [teamsResult, matchesResult] = await Promise.all([
                        supabase
                            .from("competition_teams")
                            .select("id", { count: "exact", head: true })
                            .eq("competition_id", competition.id)
                            .eq("status", "active"),

                        supabase
                            .from("competition_matches")
                            .select("id, completed", { count: "exact" })
                            .eq("competition_id", competition.id)
                    ]);

                    return {
                        id: competition.id,
                        teamCount: teamsResult.error ? 0 : (teamsResult.count || 0),
                        matches: matchesResult.error ? [] : (matchesResult.data || [])
                    };
                })
            );

            statsResults.forEach((result) => {
                stats[result.id] = {
                    teamCount: result.teamCount,
                    matchCount: result.matches.length,
                    completedCount: result.matches.filter(match => match.completed).length
                };
            });

            setCompetitionStats(stats);

            await loadTodayFixtures(rows);
        } catch (error) {
            console.error("Unable to load dashboard:", error);
            setCompetitions([]);
            setCompetitionStats({});
            setTodayFixtures([]);
        } finally {
            setLoading(false);
        }
    };

    const loadTodayFixtures = async (competitionRows) => {
        try {
            const { data: days, error: daysError } = await supabase
                .from("competition_days")
                .select("id, competition_id, day_number, playing_date, name, venue_club_id, clubs (id, name, short_name)")
                .eq("playing_date", today)
                .order("day_number");

            if (daysError) throw daysError;

            if (!days?.length) {
                setTodayFixtures([]);
                return;
            }

            const dayIds = days.map(day => day.id);

            const { data: rounds, error: roundsError } = await supabase
                .from("competition_rounds")
                .select("id, competition_id, competition_day_id, round_number, round_name")
                .in("competition_day_id", dayIds)
                .order("round_number");

            if (roundsError) throw roundsError;

            if (!rounds?.length) {
                setTodayFixtures([]);
                return;
            }

            const roundIds = rounds.map(round => round.id);

            const { data: matches, error: matchesError } = await supabase
                .from("competition_matches")
                .select("id, competition_id, round_id, match_number, team_a_id, team_b_id, score_a, score_b, completed")
                .in("round_id", roundIds)
                .order("match_number");

            if (matchesError) throw matchesError;

            const competitionIds = [
                ...new Set((matches || []).map(match => match.competition_id))
            ];

            const teamRows = [];
            for (const competitionId of competitionIds) {
                const { data, error } = await supabase
                    .from("competition_teams")
                    .select("id, team_number, team_name")
                    .eq("competition_id", competitionId)
                    .eq("status", "active");

                if (!error && data) {
                    teamRows.push(...data);
                }
            }

            const teamMap = new Map(teamRows.map(team => [team.id, team]));
            const roundMap = new Map((rounds || []).map(round => [round.id, round]));
            const dayMap = new Map((days || []).map(day => [day.id, day]));
            const competitionMap = new Map(
                (competitionRows || []).map(competition => [competition.id, competition])
            );

            const fixtureRows = (matches || []).map(match => {
                const round = roundMap.get(match.round_id);
                const day = round ? dayMap.get(round.competition_day_id) : null;
                const competition = competitionMap.get(match.competition_id);

                return {
                    ...match,
                    competition,
                    round,
                    day,
                    teamA: teamMap.get(match.team_a_id),
                    teamB: teamMap.get(match.team_b_id)
                };
            });

            setTodayFixtures(fixtureRows);
        } catch (error) {
            console.warn("Unable to load today's fixtures:", error);
            setTodayFixtures([]);
        }
    };

    useEffect(() => {
        loadDashboard();
    }, []);

    const activeCompetition = useMemo(() => {
        return competitions.find(
            competition => competition.status === "in_progress"
        ) || null;
    }, [competitions]);

    const needsAttention = useMemo(() => {
        return competitions
            .filter(competition => {
                if (competition.status === "cancelled" || competition.status === "completed") {
                    return false;
                }

                const stats = competitionStats[competition.id];

                if (competition.status === "draft") return true;
                if (competition.status === "draw_generated") return true;

                if (competition.status === "in_progress" && stats) {
                    return stats.completedCount < stats.matchCount;
                }

                return false;
            })
            .slice(0, 4);
    }, [competitions, competitionStats]);

    const recentCompetitions = useMemo(() => {
        return competitions
            .filter(competition => !activeCompetition || competition.id !== activeCompetition.id)
            .slice(0, 6);
    }, [competitions, activeCompetition]);

    const formatDate = (value) => {
        if (!value) return "Date not set";

        return new Date(`${value}T12:00:00`).toLocaleDateString(
            undefined,
            {
                day: "numeric",
                month: "short",
                year: "numeric"
            }
        );
    };

    const statusInfo = (status) => {
        const map = {
            draft: {
                label: "Setup Required",
                className: "bg-secondary"
            },
            draw_generated: {
                label: "Draw Ready",
                className: "bg-primary"
            },
            in_progress: {
                label: "In Progress",
                className: "bg-warning text-dark"
            },
            completed: {
                label: "Completed",
                className: "bg-success"
            },
            cancelled: {
                label: "Cancelled",
                className: "bg-danger"
            }
        };

        return map[status] || {
            label: status || "Unknown",
            className: "bg-secondary"
        };
    };

    const getCompetitionAction = (competition) => {
        if (competition.status === "in_progress") {
            return "Continue Scoring";
        }

        if (competition.status === "draft") {
            return "Continue Setup";
        }

        if (competition.status === "draw_generated") {
            return "Continue Competition";
        }

        return "View Competition";
    };

    const activeStats = activeCompetition
        ? competitionStats[activeCompetition.id] || {
            teamCount: 0,
            matchCount: 0,
            completedCount: 0
        }
        : null;

    const activeRemaining = activeStats
        ? Math.max(activeStats.matchCount - activeStats.completedCount, 0)
        : 0;

    return (
        <div className="container-fluid py-4">
            <div className="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-4">
                <div>
                    <h1 className="mb-1">BowlPoint Dashboard</h1>
                    <p className="text-muted mb-0">
                        Your competition control centre.
                    </p>
                </div>

                <div className="d-flex gap-2">
                    <Link to="/quick-score" className="btn btn-outline-primary">
                        <i className="bi bi-lightning-charge-fill me-2"></i>
                        Quick Score
                    </Link>

                    <Link to="/competitions" className="btn btn-primary">
                        <i className="bi bi-plus-lg me-2"></i>
                        Create Competition
                    </Link>
                </div>
            </div>

            {loading ? (
                <div className="card border-0 shadow-sm">
                    <div className="card-body text-center py-5">
                        <div className="spinner-border text-primary"></div>
                        <div className="text-muted mt-3">
                            Loading your dashboard...
                        </div>
                    </div>
                </div>
            ) : (
                <>
                    {activeCompetition ? (
                        <div className="card border-0 shadow-sm mb-4">
                            <div className="card-body p-4">
                                <div className="d-flex flex-wrap justify-content-between align-items-start gap-3">
                                    <div>
                                        <div className="text-muted small text-uppercase fw-semibold">
                                            Active Competition
                                        </div>
                                        <h2 className="mb-1 mt-1">
                                            <i className="bi bi-trophy-fill text-warning me-2"></i>
                                            {activeCompetition.name}
                                        </h2>
                                        <div className="text-muted">
                                            {formatDate(activeCompetition.start_date)}
                                            {activeCompetition.end_date &&
                                                activeCompetition.end_date !== activeCompetition.start_date &&
                                                ` – ${formatDate(activeCompetition.end_date)}`}
                                        </div>
                                    </div>

                                    <span className="badge bg-warning text-dark fs-6">
                                        In Progress
                                    </span>
                                </div>

                                <div className="row g-3 mt-2">
                                    <div className="col-sm-6 col-lg-3">
                                        <div className="border rounded p-3 h-100">
                                            <div className="text-muted small">Teams</div>
                                            <div className="fs-3 fw-bold">
                                                {activeStats.teamCount}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="col-sm-6 col-lg-3">
                                        <div className="border rounded p-3 h-100">
                                            <div className="text-muted small">Matches</div>
                                            <div className="fs-3 fw-bold">
                                                {activeStats.matchCount}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="col-sm-6 col-lg-3">
                                        <div className="border rounded p-3 h-100">
                                            <div className="text-muted small">Results Entered</div>
                                            <div className="fs-3 fw-bold">
                                                {activeStats.completedCount}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="col-sm-6 col-lg-3">
                                        <div className="border rounded p-3 h-100">
                                            <div className="text-muted small">Remaining</div>
                                            <div className="fs-3 fw-bold text-primary">
                                                {activeRemaining}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="d-flex justify-content-between align-items-center mt-4 mb-2">
                                    <span className="small text-muted">Competition progress</span>
                                    <strong>
                                        {activeStats.matchCount > 0
                                            ? Math.round(
                                                (activeStats.completedCount / activeStats.matchCount) * 100
                                            )
                                            : 0}%
                                    </strong>
                                </div>

                                <div className="progress" style={{ height: "10px" }}>
                                    <div
                                        className="progress-bar bg-success"
                                        style={{
                                            width: `${activeStats.matchCount > 0
                                                ? (activeStats.completedCount / activeStats.matchCount) * 100
                                                : 0}%`
                                        }}
                                    ></div>
                                </div>

                                <div className="d-flex justify-content-end mt-4">
                                    <Link
                                        to={`/competitions/${activeCompetition.id}`}
                                        className="btn btn-primary"
                                    >
                                        Continue Competition
                                        <i className="bi bi-arrow-right ms-2"></i>
                                    </Link>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="card border-0 shadow-sm mb-4">
                            <div className="card-body p-4">
                                <div className="row align-items-center">
                                    <div className="col-lg-8">
                                        <div className="text-muted small text-uppercase fw-semibold">
                                            No Active Competition
                                        </div>
                                        <h2 className="mt-1 mb-2">
                                            Ready to run your next competition?
                                        </h2>
                                        <p className="text-muted mb-0">
                                            Create a competition and BowlPoint will guide you through teams,
                                            draw, schedule, scoring and playoffs.
                                        </p>
                                    </div>

                                    <div className="col-lg-4 text-lg-end mt-3 mt-lg-0">
                                        <Link to="/competitions" className="btn btn-primary">
                                            <i className="bi bi-plus-lg me-2"></i>
                                            Create Competition
                                        </Link>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="row g-4 mb-4">
                        <div className="col-lg-6">
                            <div className="card border-0 shadow-sm h-100">
                                <div className="card-header bg-white py-3">
                                    <h5 className="mb-0">
                                        <i className="bi bi-exclamation-circle text-warning me-2"></i>
                                        Needs Your Attention
                                    </h5>
                                </div>

                                <div className="card-body">
                                    {needsAttention.length === 0 ? (
                                        <div className="text-center py-4">
                                            <i className="bi bi-check-circle text-success display-6"></i>
                                            <div className="fw-semibold mt-3">
                                                Nothing needs your attention
                                            </div>
                                            <div className="text-muted small mt-1">
                                                Your competitions are up to date.
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="list-group list-group-flush">
                                            {needsAttention.map(competition => {
                                                const stats = competitionStats[competition.id];
                                                const status = statusInfo(competition.status);

                                                let message = "Competition setup needs attention.";

                                                if (competition.status === "draw_generated") {
                                                    message = "Draw is ready. Continue with the competition setup.";
                                                } else if (competition.status === "in_progress" && stats) {
                                                    const remaining = Math.max(
                                                        stats.matchCount - stats.completedCount,
                                                        0
                                                    );

                                                    message = `${remaining} result${remaining === 1 ? "" : "s"} outstanding.`;
                                                }

                                                return (
                                                    <div
                                                        key={competition.id}
                                                        className="list-group-item px-0 py-3"
                                                    >
                                                        <div className="d-flex justify-content-between align-items-start gap-3">
                                                            <div>
                                                                <div className="fw-semibold">
                                                                    {competition.name}
                                                                </div>
                                                                <div className="small text-muted mt-1">
                                                                    {message}
                                                                </div>
                                                            </div>

                                                            <Link
                                                                to={`/competitions/${competition.id}`}
                                                                className="btn btn-sm btn-outline-primary flex-shrink-0"
                                                            >
                                                                {getCompetitionAction(competition)}
                                                            </Link>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="col-lg-6">
                            <div className="card border-0 shadow-sm h-100">
                                <div className="card-header bg-white py-3 d-flex justify-content-between align-items-center">
                                    <h5 className="mb-0">
                                        <i className="bi bi-calendar-event me-2"></i>
                                        Today's Fixtures
                                    </h5>

                                    <span className="badge bg-light text-dark border">
                                        {new Date().toLocaleDateString(undefined, {
                                            day: "numeric",
                                            month: "short"
                                        })}
                                    </span>
                                </div>

                                <div className="card-body p-0">
                                    {todayFixtures.length === 0 ? (
                                        <div className="text-center py-5 px-3">
                                            <i className="bi bi-calendar2-check text-muted display-6"></i>
                                            <div className="fw-semibold mt-3">
                                                No fixtures scheduled today
                                            </div>
                                            <div className="text-muted small mt-1">
                                                Today's playing schedule will appear here when available.
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="list-group list-group-flush">
                                            {todayFixtures.slice(0, 8).map(fixture => (
                                                <div
                                                    key={fixture.id}
                                                    className="list-group-item py-3"
                                                >
                                                    <div className="d-flex justify-content-between align-items-start gap-3">
                                                        <div>
                                                            <div className="small text-muted">
                                                                {fixture.competition?.name} •{" "}
                                                                {fixture.round?.round_name || `Round ${fixture.round?.round_number || ""}`}
                                                            </div>

                                                            <div className="fw-semibold mt-1">
                                                                {fixture.teamA?.team_name || "TBD"}
                                                                <span className="text-muted mx-2">vs</span>
                                                                {fixture.teamB?.team_name || "TBD"}
                                                            </div>
                                                        </div>

                                                        <div className="text-end flex-shrink-0">
                                                            {fixture.completed ? (
                                                                <>
                                                                    <div className="fw-bold">
                                                                        {fixture.score_a} — {fixture.score_b}
                                                                    </div>
                                                                    <span className="badge bg-success">
                                                                        Complete
                                                                    </span>
                                                                </>
                                                            ) : (
                                                                <span className="badge bg-primary">
                                                                    Upcoming
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}

                                            {todayFixtures.length > 8 && (
                                                <div className="text-center small text-muted py-2">
                                                    + {todayFixtures.length - 8} more fixture(s)
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="card border-0 shadow-sm mb-4">
                        <div className="card-header bg-white py-3 d-flex justify-content-between align-items-center">
                            <h5 className="mb-0">
                                <i className="bi bi-trophy me-2"></i>
                                Recent Competitions
                            </h5>

                            <Link to="/competitions" className="btn btn-sm btn-outline-primary">
                                View All
                            </Link>
                        </div>

                        <div className="card-body p-0">
                            {recentCompetitions.length === 0 ? (
                                <div className="text-center py-5 text-muted">
                                    No previous competitions yet.
                                </div>
                            ) : (
                                <div className="table-responsive">
                                    <table className="table table-hover align-middle mb-0">
                                        <thead className="table-light">
                                            <tr>
                                                <th>Competition</th>
                                                <th>Date</th>
                                                <th>Status</th>
                                                <th className="text-end">Action</th>
                                            </tr>
                                        </thead>

                                        <tbody>
                                            {recentCompetitions.map(competition => {
                                                const status = statusInfo(competition.status);

                                                return (
                                                    <tr key={competition.id}>
                                                        <td>
                                                            <strong>{competition.name}</strong>
                                                            {competition.public_code && (
                                                                <div className="small text-muted">
                                                                    Code: {competition.public_code}
                                                                </div>
                                                            )}
                                                        </td>

                                                        <td>
                                                            {formatDate(competition.start_date)}
                                                        </td>

                                                        <td>
                                                            <span className={`badge ${status.className}`}>
                                                                {status.label}
                                                            </span>
                                                        </td>

                                                        <td className="text-end">
                                                            <Link
                                                                to={`/competitions/${competition.id}`}
                                                                className="btn btn-sm btn-outline-primary"
                                                            >
                                                                Open
                                                            </Link>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="row g-4">
                        <div className="col-md-4">
                            <Link
                                to="/competitions"
                                className="card border-0 shadow-sm h-100 text-decoration-none text-dark"
                            >
                                <div className="card-body">
                                    <i className="bi bi-trophy-fill text-primary fs-2"></i>
                                    <h5 className="mt-3">Competitions</h5>
                                    <p className="text-muted mb-0">
                                        Create, configure and manage your competitions.
                                    </p>
                                </div>
                            </Link>
                        </div>

                        <div className="col-md-4">
                            <Link
                                to="/players"
                                className="card border-0 shadow-sm h-100 text-decoration-none text-dark"
                            >
                                <div className="card-body">
                                    <i className="bi bi-person-fill text-primary fs-2"></i>
                                    <h5 className="mt-3">Players</h5>
                                    <p className="text-muted mb-0">
                                        Manage the players available for your competitions.
                                    </p>
                                </div>
                            </Link>
                        </div>

                        <div className="col-md-4">
                            <Link
                                to="/quick-score"
                                className="card border-0 shadow-sm h-100 text-decoration-none text-dark"
                            >
                                <div className="card-body">
                                    <i className="bi bi-diagram-3-fill text-primary fs-2"></i>
                                    <h5 className="mt-3">Quick Score</h5>
                                    <p className="text-muted mb-0">
                                        Run a quick tournament without the full competition workflow.
                                    </p>
                                </div>
                            </Link>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}

export default Dashboard;
