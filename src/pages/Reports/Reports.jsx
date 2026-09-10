import { useEffect, useMemo, useState } from "react";
import {
    getCompetitionReportData,
    getReportCompetitions
} from "../../services/supabase/reportService";
import "./Reports.css";

const REPORT_TYPES = [
    { key: "summary", label: "Competition Summary", icon: "bar-chart-fill" },
    { key: "standings", label: "Final Standings", icon: "trophy-fill" },
    { key: "results", label: "Match Results", icon: "list-ol" },
    { key: "players", label: "Player Performance", icon: "people-fill" },
    { key: "clubs", label: "Club Performance", icon: "building-fill" }
];

function Reports() {
    const [competitions, setCompetitions] = useState([]);
    const [selectedCompetitionId, setSelectedCompetitionId] = useState("");
    const [reportType, setReportType] = useState("summary");
    const [reportData, setReportData] = useState(null);
    const [loadingCompetitions, setLoadingCompetitions] = useState(true);
    const [loadingReport, setLoadingReport] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        const load = async () => {
            try {
                setLoadingCompetitions(true);
                const rows = await getReportCompetitions();
                setCompetitions(rows);
                if (rows.length) setSelectedCompetitionId(rows[0].id);
            } catch (loadError) {
                console.error("Unable to load report competitions:", loadError);
                setError(loadError.message || "Unable to load competitions.");
            } finally {
                setLoadingCompetitions(false);
            }
        };

        load();
    }, []);

    useEffect(() => {
        if (!selectedCompetitionId) {
            setReportData(null);
            return;
        }

        const load = async () => {
            try {
                setLoadingReport(true);
                setError("");
                setReportData(await getCompetitionReportData(selectedCompetitionId));
            } catch (loadError) {
                console.error("Unable to load competition report:", loadError);
                setError(loadError.message || "Unable to load report data.");
                setReportData(null);
            } finally {
                setLoadingReport(false);
            }
        };

        load();
    }, [selectedCompetitionId]);

    const stats = useMemo(() => {
        if (!reportData) return null;

        const completedMatches = reportData.matches.filter(match => match.completed);
        const totalShots = completedMatches.reduce(
            (sum, match) => sum + Number(match.score_a ?? match.shots_for_a ?? 0) + Number(match.score_b ?? match.shots_for_b ?? 0),
            0
        );
        const completedRounds = reportData.rounds.filter(round => round.status === "completed").length;
        const activeTeams = reportData.teams.filter(team => team.status !== "withdrawn");
        const players = new Set(
            reportData.teamPlayers
                .map(row => row.players?.id)
                .filter(Boolean)
        );

        return {
            teams: activeTeams.length,
            players: players.size,
            rounds: reportData.rounds.length,
            completedRounds,
            matches: reportData.matches.length,
            completedMatches: completedMatches.length,
            totalShots,
            completion: reportData.matches.length
                ? Math.round((completedMatches.length / reportData.matches.length) * 100)
                : 0
        };
    }, [reportData]);

    const standings = useMemo(() => {
        if (!reportData) return [];

        const scoring = reportData.competition.scoring || {};
        const winPoints = Number(scoring.win ?? 2);
        const drawPoints = Number(scoring.draw ?? 1);
        const lossPoints = Number(scoring.loss ?? 0);
        const rows = new Map();

        reportData.teams.forEach(team => {
            rows.set(team.id, {
                team,
                played: 0,
                wins: 0,
                draws: 0,
                losses: 0,
                points: 0,
                shotsFor: 0,
                shotsAgainst: 0
            });
        });

        reportData.matches.filter(match => match.completed).forEach(match => {
            const a = rows.get(match.team_a_id);
            const b = rows.get(match.team_b_id);
            if (!a || !b) return;

            const scoreA = Number(match.score_a ?? match.shots_for_a ?? 0);
            const scoreB = Number(match.score_b ?? match.shots_for_b ?? 0);

            a.played += 1;
            b.played += 1;
            a.shotsFor += scoreA;
            a.shotsAgainst += scoreB;
            b.shotsFor += scoreB;
            b.shotsAgainst += scoreA;

            if (scoreA > scoreB) {
                a.wins += 1;
                b.losses += 1;
                a.points += Number(match.points_a ?? winPoints);
                b.points += Number(match.points_b ?? lossPoints);
            } else if (scoreB > scoreA) {
                b.wins += 1;
                a.losses += 1;
                a.points += Number(match.points_a ?? lossPoints);
                b.points += Number(match.points_b ?? winPoints);
            } else {
                a.draws += 1;
                b.draws += 1;
                a.points += Number(match.points_a ?? drawPoints);
                b.points += Number(match.points_b ?? drawPoints);
            }
        });

        return [...rows.values()]
            .map(row => ({ ...row, aggregate: row.shotsFor - row.shotsAgainst }))
            .sort((a, b) =>
                b.points - a.points ||
                b.aggregate - a.aggregate ||
                b.shotsFor - a.shotsFor ||
                a.team.team_name.localeCompare(b.team.team_name)
            );
    }, [reportData]);

    const playerLabel = (player) => {
        if (!player) return "Unknown player";
        const givenName = player.nickname || player.first_name || "";
        return `${givenName} ${player.last_name || ""}`.trim() || player.display_name || "Unknown player";
    };

    const playerPerformance = useMemo(() => {
        if (!reportData) return [];

        const rows = new Map();
        const teamPlayerMap = new Map();

        reportData.teamPlayers.forEach(row => {
            if (!row.players?.id) return;
            if (!teamPlayerMap.has(row.competition_team_id)) teamPlayerMap.set(row.competition_team_id, []);
            teamPlayerMap.get(row.competition_team_id).push(row);
        });

        reportData.matches.filter(match => match.completed).forEach(match => {
            [
                { teamId: match.team_a_id, score: Number(match.score_a ?? match.shots_for_a ?? 0), opponentScore: Number(match.score_b ?? match.shots_for_b ?? 0) },
                { teamId: match.team_b_id, score: Number(match.score_b ?? match.shots_for_b ?? 0), opponentScore: Number(match.score_a ?? match.shots_for_a ?? 0) }
            ].forEach(side => {
                (teamPlayerMap.get(side.teamId) || []).forEach(teamPlayer => {
                    const player = teamPlayer.players;
                    if (!player) return;

                    if (!rows.has(player.id)) {
                        rows.set(player.id, {
                            player,
                            teamIds: new Set(),
                            played: 0,
                            wins: 0,
                            draws: 0,
                            losses: 0,
                            shotsFor: 0,
                            shotsAgainst: 0
                        });
                    }

                    const row = rows.get(player.id);
                    row.teamIds.add(side.teamId);
                    row.played += 1;
                    row.shotsFor += side.score;
                    row.shotsAgainst += side.opponentScore;

                    if (side.score > side.opponentScore) row.wins += 1;
                    else if (side.score < side.opponentScore) row.losses += 1;
                    else row.draws += 1;
                });
            });
        });

        return [...rows.values()]
            .map(row => ({ ...row, aggregate: row.shotsFor - row.shotsAgainst }))
            .sort((a, b) =>
                b.wins - a.wins ||
                b.aggregate - a.aggregate ||
                b.shotsFor - a.shotsFor ||
                (playerLabel(a.player)).localeCompare(
                    playerLabel(b.player)
                )
            );
    }, [reportData]);

    const clubPerformance = useMemo(() => {
        if (!reportData) return [];

        const rows = new Map();
        const ensure = (team) => {
            const clubId = team?.club_id || `team-${team?.id}`;
            if (!rows.has(clubId)) {
                rows.set(clubId, {
                    clubId,
                    clubName: team?.clubs?.name || "Unassigned",
                    shortName: team?.clubs?.short_name || "",
                    teams: 0,
                    played: 0,
                    wins: 0,
                    draws: 0,
                    losses: 0,
                    shotsFor: 0,
                    shotsAgainst: 0,
                    points: 0
                });
            }
            return rows.get(clubId);
        };

        reportData.teams.forEach(team => ensure(team).teams += 1);

        reportData.matches.filter(match => match.completed).forEach(match => {
            const a = ensure(match.teamA);
            const b = ensure(match.teamB);
            const scoreA = Number(match.score_a ?? match.shots_for_a ?? 0);
            const scoreB = Number(match.score_b ?? match.shots_for_b ?? 0);
            const scoring = reportData.competition.scoring || {};
            const win = Number(scoring.win ?? 2);
            const draw = Number(scoring.draw ?? 1);
            const loss = Number(scoring.loss ?? 0);

            a.played += 1;
            b.played += 1;
            a.shotsFor += scoreA;
            a.shotsAgainst += scoreB;
            b.shotsFor += scoreB;
            b.shotsAgainst += scoreA;

            if (scoreA > scoreB) {
                a.wins += 1;
                b.losses += 1;
                a.points += Number(match.points_a ?? win);
                b.points += Number(match.points_b ?? loss);
            } else if (scoreB > scoreA) {
                b.wins += 1;
                a.losses += 1;
                a.points += Number(match.points_a ?? loss);
                b.points += Number(match.points_b ?? win);
            } else {
                a.draws += 1;
                b.draws += 1;
                a.points += Number(match.points_a ?? draw);
                b.points += Number(match.points_b ?? draw);
            }
        });

        return [...rows.values()]
            .map(row => ({ ...row, aggregate: row.shotsFor - row.shotsAgainst }))
            .sort((a, b) => b.points - a.points || b.aggregate - a.aggregate || a.clubName.localeCompare(b.clubName));
    }, [reportData]);

    const selectedCompetition = reportData?.competition || competitions.find(item => item.id === selectedCompetitionId);

    const formatDate = (value) => {
        if (!value) return "—";
        return new Date(`${value}T12:00:00`).toLocaleDateString(undefined, {
            day: "numeric",
            month: "short",
            year: "numeric"
        });
    };

    const statusBadge = (status) => {
        const map = {
            draft: ["Setup Required", "bg-secondary"],
            draw_generated: ["Draw Ready", "bg-primary"],
            in_progress: ["In Progress", "bg-warning text-dark"],
            completed: ["Completed", "bg-success"],
            cancelled: ["Cancelled", "bg-danger"]
        };
        const [label, className] = map[status] || [status || "Unknown", "bg-secondary"];
        return <span className={`badge ${className}`}>{label}</span>;
    };

    /*
     * Match the competition workspace's team naming rules.
     *
     * A blank team_name is intentional for automatically named teams.
     * In that case use the club short code plus the team's sequence within
     * that club, e.g. HBC1, HBC2.
     */
    const teamLabel = (team) => {
        if (!team) return "TBD";

        const explicitName = team.team_name?.trim();
        if (explicitName) return explicitName;

        const clubCode =
            team.clubs?.short_name?.trim() ||
            team.clubs?.name?.trim() ||
            "TEAM";

        const clubTeams = (reportData?.teams || [])
            .filter(item =>
                item?.club_id &&
                team.club_id &&
                item.club_id === team.club_id
            )
            .slice()
            .sort((a, b) => {
                const numberA = a.team_number || 0;
                const numberB = b.team_number || 0;

                if (numberA !== numberB) {
                    return numberA - numberB;
                }

                return String(a.id || "").localeCompare(
                    String(b.id || "")
                );
            });

        const sequenceIndex = clubTeams.findIndex(
            item => item.id === team.id
        );

        const sequenceNumber =
            sequenceIndex >= 0
                ? sequenceIndex + 1
                : team.team_number || 1;

        return `${clubCode}${sequenceNumber}`;
    };

    const exportCsv = () => {
        if (!reportData) return;

        let headers = [];
        let rows = [];
        const escape = value => `"${String(value ?? "").replaceAll('"', '""')}"`;

        if (reportType === "standings") {
            headers = ["Position", "Team", "Club", "Played", "Wins", "Draws", "Losses", "Points", "Shots For", "Shots Against", "Aggregate"];
            rows = standings.map((row, index) => [index + 1, row.team.team_name, row.team.clubs?.name || "", row.played, row.wins, row.draws, row.losses, row.points, row.shotsFor, row.shotsAgainst, row.aggregate]);
        } else if (reportType === "results") {
            headers = ["Round", "Match", "Team A", "Score A", "Team B", "Score B", "Status", "Completed"];
            rows = reportData.matches.map(match => [match.round?.round_name || `Round ${match.round?.round_number || ""}`, match.match_number, teamLabel(match.teamA), match.score_a ?? "", teamLabel(match.teamB), match.score_b ?? "", match.completed ? "Completed" : "Pending", match.completed_at || ""]);
        } else if (reportType === "players") {
            headers = ["Player", "Played", "Wins", "Draws", "Losses", "Shots For", "Shots Against", "Aggregate"];
            rows = playerPerformance.map(row => [playerLabel(row.player), row.played, row.wins, row.draws, row.losses, row.shotsFor, row.shotsAgainst, row.aggregate]);
        } else if (reportType === "clubs") {
            headers = ["Club", "Teams", "Played", "Wins", "Draws", "Losses", "Points", "Shots For", "Shots Against", "Aggregate"];
            rows = clubPerformance.map(row => [row.clubName, row.teams, row.played, row.wins, row.draws, row.losses, row.points, row.shotsFor, row.shotsAgainst, row.aggregate]);
        } else {
            headers = ["Metric", "Value"];
            rows = [
                ["Competition", selectedCompetition?.name],
                ["Status", selectedCompetition?.status],
                ["Teams", stats?.teams],
                ["Players", stats?.players],
                ["Rounds", stats?.rounds],
                ["Completed Matches", stats?.completedMatches],
                ["Total Matches", stats?.matches],
                ["Total Shots", stats?.totalShots]
            ];
        }

        const csv = [headers, ...rows].map(row => row.map(escape).join(",")).join("\r\n");
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `${(selectedCompetition?.name || "bowlpoint-report").replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase()}-${reportType}.csv`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
    };

    if (loadingCompetitions) {
        return <LoadingState message="Loading reporting data..." />;
    }

    return (
        <div className="bowlpoint-reports">
            <div className="d-flex flex-column flex-lg-row justify-content-between align-items-lg-end gap-3 mb-4">
                <div>
                    <div className="text-uppercase small text-primary fw-semibold mb-1">BowlPoint Reporting</div>
                    <h1 className="h2 mb-1">Reports</h1>
                    <p className="text-muted mb-0">Analyse completed competitions, results, players and clubs.</p>
                </div>

                {reportData && (
                    <div className="d-flex gap-2">
                        <button type="button" className="btn btn-outline-secondary" onClick={() => window.print()}>
                            <i className="bi bi-printer me-2"></i>Print
                        </button>
                        <button type="button" className="btn btn-primary" onClick={exportCsv}>
                            <i className="bi bi-download me-2"></i>Export CSV
                        </button>
                    </div>
                )}
            </div>

            {error && <div className="alert alert-danger border-0 shadow-sm">{error}</div>}

            {!competitions.length ? (
                <div className="card border-0 shadow-sm">
                    <div className="card-body text-center py-5">
                        <i className="bi bi-bar-chart display-4 text-muted"></i>
                        <h4 className="mt-3">No competitions to report</h4>
                        <p className="text-muted mb-0">Once competitions have been created, their results will appear here.</p>
                    </div>
                </div>
            ) : (
                <>
                    <div className="card border-0 shadow-sm mb-4 report-controls">
                        <div className="card-body">
                            <div className="row g-3 align-items-end">
                                <div className="col-12 col-lg-7">
                                    <label className="form-label fw-semibold">Competition</label>
                                    <select
                                        className="form-select"
                                        value={selectedCompetitionId}
                                        onChange={event => setSelectedCompetitionId(event.target.value)}
                                    >
                                        {competitions.map(competition => (
                                            <option key={competition.id} value={competition.id}>
                                                {competition.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div className="col-12 col-lg-5">
                                    <label className="form-label fw-semibold">Report</label>
                                    <select
                                        className="form-select"
                                        value={reportType}
                                        onChange={event => setReportType(event.target.value)}
                                    >
                                        {REPORT_TYPES.map(report => (
                                            <option key={report.key} value={report.key}>{report.label}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="d-flex flex-wrap gap-2 mt-3 report-tabs">
                                {REPORT_TYPES.map(report => (
                                    <button
                                        key={report.key}
                                        type="button"
                                        className={`btn btn-sm ${reportType === report.key ? "btn-primary" : "btn-outline-secondary"}`}
                                        onClick={() => setReportType(report.key)}
                                    >
                                        <i className={`bi bi-${report.icon} me-1`}></i>
                                        {report.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {loadingReport ? (
                        <LoadingState message="Building report..." compact />
                    ) : reportData ? (
                        <>
                            <div className="card border-0 shadow-sm mb-4 report-heading">
                                <div className="card-body">
                                    <div className="d-flex flex-column flex-md-row justify-content-between gap-3">
                                        <div>
                                            <h2 className="h4 mb-1">{selectedCompetition.name}</h2>
                                            <div className="text-muted small">
                                                {formatDate(selectedCompetition.start_date)}
                                                {selectedCompetition.end_date && ` – ${formatDate(selectedCompetition.end_date)}`}
                                                {selectedCompetition.public_code && ` • Code ${selectedCompetition.public_code}`}
                                            </div>
                                        </div>
                                        <div>{statusBadge(selectedCompetition.status)}</div>
                                    </div>
                                </div>
                            </div>

                            {reportType === "summary" && <SummaryReport stats={stats} competition={selectedCompetition} />}
                            {reportType === "standings" && <StandingsReport standings={standings} teamLabel={teamLabel} />}
                            {reportType === "results" && <ResultsReport matches={reportData.matches} teamLabel={teamLabel} formatDate={formatDate} />}
                            {reportType === "players" && <PlayersReport rows={playerPerformance} playerLabel={playerLabel} />}
                            {reportType === "clubs" && <ClubsReport rows={clubPerformance} />}
                        </>
                    ) : null}
                </>
            )}
        </div>
    );
}

function LoadingState({ message, compact = false }) {
    return (
        <div className={`card border-0 shadow-sm ${compact ? "mb-4" : ""}`}>
            <div className={`card-body text-center ${compact ? "py-4" : "py-5"}`}>
                <div className="spinner-border text-primary mb-3" role="status"></div>
                <div className="text-muted">{message}</div>
            </div>
        </div>
    );
}

function SummaryReport({ stats, competition }) {
    const cards = [
        ["Teams", stats.teams, "people-fill"],
        ["Players", stats.players, "person-fill"],
        ["Rounds", stats.rounds, "arrow-repeat"],
        ["Matches", `${stats.completedMatches} / ${stats.matches}`, "list-ol"],
        ["Total Shots", stats.totalShots, "bullseye"],
        ["Completion", `${stats.completion}%`, "check-circle-fill"]
    ];

    return (
        <>
            <div className="row g-3 mb-4">
                {cards.map(([label, value, icon]) => (
                    <div className="col-6 col-md-4 col-xl-2" key={label}>
                        <div className="card border-0 shadow-sm h-100 report-stat-card">
                            <div className="card-body">
                                <i className={`bi bi-${icon} text-primary fs-4`}></i>
                                <div className="fs-4 fw-bold mt-2">{value}</div>
                                <div className="small text-muted">{label}</div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            <div className="card border-0 shadow-sm">
                <div className="card-header bg-white"><strong>Competition Overview</strong></div>
                <div className="card-body">
                    <div className="row g-3">
                        <InfoItem label="Format" value={labelValue(competition.format)} />
                        <InfoItem label="Structure" value={labelValue(competition.structure)} />
                        <InfoItem label="Win Points" value={competition.scoring?.win ?? 2} />
                        <InfoItem label="Draw Points" value={competition.scoring?.draw ?? 1} />
                    </div>
                </div>
            </div>
        </>
    );
}

function InfoItem({ label, value }) {
    return <div className="col-6 col-md-3"><div className="small text-muted">{label}</div><div className="fw-semibold">{value}</div></div>;
}

function StandingsReport({ standings, teamLabel }) {
    return (
        <ReportTable title="Standings" icon="trophy-fill">
            <table className="table table-hover align-middle mb-0">
                <thead className="table-light"><tr><th>#</th><th>Team</th><th>Club</th><th className="text-center">P</th><th className="text-center">W</th><th className="text-center">D</th><th className="text-center">L</th><th className="text-center">Pts</th><th className="text-center">SF</th><th className="text-center">SA</th><th className="text-center">Agg</th></tr></thead>
                <tbody>
                    {standings.map((row, index) => (
                        <tr key={row.team.id} className={index === 0 ? "table-success" : ""}>
                            <td className="fw-bold">{index + 1}</td>
                            <td className="fw-semibold">{teamLabel(row.team)}</td>
                            <td>{row.team.clubs?.name || "—"}</td>
                            <td className="text-center">{row.played}</td>
                            <td className="text-center">{row.wins}</td>
                            <td className="text-center">{row.draws}</td>
                            <td className="text-center">{row.losses}</td>
                            <td className="text-center fw-bold">{row.points}</td>
                            <td className="text-center">{row.shotsFor}</td>
                            <td className="text-center">{row.shotsAgainst}</td>
                            <td className="text-center">{row.aggregate > 0 ? `+${row.aggregate}` : row.aggregate}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </ReportTable>
    );
}

function ResultsReport({ matches, teamLabel, formatDate }) {
    const ordered = [...matches].sort((a, b) => (a.round?.round_number || 0) - (b.round?.round_number || 0) || a.match_number - b.match_number);
    return (
        <ReportTable title="Match Results" icon="list-ol">
            <table className="table table-hover align-middle mb-0">
                <thead className="table-light"><tr><th>Round</th><th>Match</th><th>Team A</th><th className="text-center">Score</th><th>Team B</th><th className="text-center">Score</th><th>Status</th><th>Completed</th></tr></thead>
                <tbody>
                    {ordered.map(match => (
                        <tr key={match.id}>
                            <td>{match.round?.round_name || `Round ${match.round?.round_number || "—"}`}</td>
                            <td>{match.match_number}</td>
                            <td>{teamLabel(match.teamA)}</td>
                            <td className="text-center fw-bold">{match.completed ? match.score_a : "—"}</td>
                            <td>{teamLabel(match.teamB)}</td>
                            <td className="text-center fw-bold">{match.completed ? match.score_b : "—"}</td>
                            <td><span className={`badge ${match.completed ? "bg-success" : "bg-secondary"}`}>{match.completed ? "Completed" : "Pending"}</span></td>
                            <td className="small text-muted">{match.completed_at ? formatDate(match.completed_at.slice(0, 10)) : "—"}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </ReportTable>
    );
}

function PlayersReport({ rows, playerLabel }) {
    return (
        <ReportTable title="Player Performance" icon="people-fill">
            <table className="table table-hover align-middle mb-0">
                <thead className="table-light"><tr><th>#</th><th>Player</th><th className="text-center">P</th><th className="text-center">W</th><th className="text-center">D</th><th className="text-center">L</th><th className="text-center">SF</th><th className="text-center">SA</th><th className="text-center">Agg</th><th className="text-center">Win %</th></tr></thead>
                <tbody>
                    {rows.map((row, index) => (
                        <tr key={row.player.id}>
                            <td>{index + 1}</td>
                            <td className="fw-semibold">{playerLabel(row.player)}</td>
                            <td className="text-center">{row.played}</td>
                            <td className="text-center">{row.wins}</td>
                            <td className="text-center">{row.draws}</td>
                            <td className="text-center">{row.losses}</td>
                            <td className="text-center">{row.shotsFor}</td>
                            <td className="text-center">{row.shotsAgainst}</td>
                            <td className="text-center">{row.aggregate > 0 ? `+${row.aggregate}` : row.aggregate}</td>
                            <td className="text-center">{row.played ? `${Math.round((row.wins / row.played) * 100)}%` : "—"}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </ReportTable>
    );
}

function ClubsReport({ rows }) {
    return (
        <ReportTable title="Club Performance" icon="building-fill">
            <table className="table table-hover align-middle mb-0">
                <thead className="table-light"><tr><th>#</th><th>Club</th><th className="text-center">Teams</th><th className="text-center">P</th><th className="text-center">W</th><th className="text-center">D</th><th className="text-center">L</th><th className="text-center">Pts</th><th className="text-center">SF</th><th className="text-center">SA</th><th className="text-center">Agg</th></tr></thead>
                <tbody>
                    {rows.map((row, index) => (
                        <tr key={row.clubId}>
                            <td>{index + 1}</td>
                            <td className="fw-semibold">{row.clubName}{row.shortName ? <span className="text-muted ms-2 small">{row.shortName}</span> : null}</td>
                            <td className="text-center">{row.teams}</td>
                            <td className="text-center">{row.played}</td>
                            <td className="text-center">{row.wins}</td>
                            <td className="text-center">{row.draws}</td>
                            <td className="text-center">{row.losses}</td>
                            <td className="text-center fw-bold">{row.points}</td>
                            <td className="text-center">{row.shotsFor}</td>
                            <td className="text-center">{row.shotsAgainst}</td>
                            <td className="text-center">{row.aggregate > 0 ? `+${row.aggregate}` : row.aggregate}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </ReportTable>
    );
}

function ReportTable({ title, icon, children }) {
    return (
        <div className="card border-0 shadow-sm report-table-card">
            <div className="card-header bg-white d-flex justify-content-between align-items-center">
                <strong><i className={`bi bi-${icon} me-2`}></i>{title}</strong>
            </div>
            <div className="table-responsive">{children}</div>
        </div>
    );
}

function labelValue(value) {
    if (!value) return "—";
    return String(value)
        .replaceAll("_", " ")
        .replace(/\b\w/g, letter => letter.toUpperCase());
}

export default Reports;
