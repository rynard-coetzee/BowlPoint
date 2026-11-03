import { useEffect, useMemo, useState } from "react";
import {
    getCompetitionReportData,
    getReportCompetitions,
    getPlayerHistoryReportData
} from "../../services/supabase/reportService";
import "./Reports.css";

const REPORT_TYPES = [
    { key: "summary", label: "Competition Summary", icon: "bar-chart-fill" },
    { key: "standings", label: "Final Standings", icon: "trophy-fill" },
    { key: "results", label: "Match Results", icon: "list-ol" },
    { key: "players", label: "Player Performance", icon: "people-fill" },
    { key: "player-history", label: "Player History", icon: "person-lines-fill" },
    { key: "clubs", label: "Club Performance", icon: "building-fill" }
];

function getPlayerLabel(player) {
    if (!player) return "Unknown player";
    const givenName = player.nickname || player.first_name || "";
    return `${givenName} ${player.last_name || ""}`.trim() || player.display_name || "Unknown player";
}

function getCompetitionYear(competition, rounds = []) {
    const explicitDate = competition?.start_date || competition?.end_date;
    if (explicitDate) {
        const year = String(explicitDate).match(/\b(?:19|20)\d{2}\b/);
        if (year) return year[0];
    }

    const scheduledDates = rounds
        .filter(round => round.competition_id === competition?.id)
        .flatMap(round => {
            const day = round.competition_days;
            const values = Array.isArray(day) ? day : [day];
            return values.map(item => item?.playing_date).filter(Boolean);
        })
        .sort();
    if (scheduledDates.length) {
        const year = String(scheduledDates[0]).match(/\b(?:19|20)\d{2}\b/);
        if (year) return year[0];
    }

    const title = String(competition?.name || "");
    const season = title.match(/\b((?:19|20)\d{2})\s*[-/]\s*((?:19|20)\d{2})\b/);
    if (season) return season[2];
    const namedYear = title.match(/\b(?:19|20)\d{2}\b/);
    return namedYear ? namedYear[0] : "—";
}

function getTeamLabel(team, allTeams = []) {
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

            const idA = String(a.id || "");
            const idB = String(b.id || "");
            if (idA < idB) return -1;
            if (idA > idB) return 1;
            return 0;
        });

    const sequenceIndex = clubTeams.findIndex(
        item => item.id === team.id
    );

    const sequenceNumber =
        sequenceIndex >= 0
            ? sequenceIndex + 1
            : clubTeams.length + 1;

    return `${clubCode}${sequenceNumber}`;
}

function Reports() {
    const [competitions, setCompetitions] = useState([]);
    const [selectedCompetitionId, setSelectedCompetitionId] = useState("");
    const [reportType, setReportType] = useState("summary");
    const [reportData, setReportData] = useState(null);
    const [playerHistoryData, setPlayerHistoryData] = useState(null);
    const [selectedPlayerId, setSelectedPlayerId] = useState("");
    const [playerSearch, setPlayerSearch] = useState("");
    const [loadingPlayerHistory, setLoadingPlayerHistory] = useState(false);
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

    useEffect(() => {
        if (reportType !== "player-history" || !competitions.length || playerHistoryData) return;

        let cancelled = false;
        const load = async () => {
            try {
                setLoadingPlayerHistory(true);
                setError("");
                const data = await getPlayerHistoryReportData(competitions.map(item => item.id));
                if (!cancelled) setPlayerHistoryData(data);
            } catch (loadError) {
                console.error("Unable to load player history:", loadError);
                if (!cancelled) setError(loadError.message || "Unable to load player history.");
            } finally {
                if (!cancelled) setLoadingPlayerHistory(false);
            }
        };
        load();
        return () => { cancelled = true; };
    }, [reportType, competitions, playerHistoryData]);

    const playerHistoryRows = useMemo(() => {
        if (!playerHistoryData) return [];
        const competitionById = new Map(competitions.map(item => [item.id, item]));
        const teamById = new Map(playerHistoryData.teams.map(team => [team.id, team]));
        const roundById = new Map(playerHistoryData.rounds.map(round => [round.id, round]));
        const matchesByTeam = new Map();

        playerHistoryData.matches.forEach(match => {
            if (!match.completed || !match.team_a_id || !match.team_b_id) return;
            const scoreAValue = match.score_a ?? match.shots_for_a;
            const scoreBValue = match.score_b ?? match.shots_for_b;
            if (scoreAValue === null || scoreAValue === undefined || scoreAValue === "" ||
                scoreBValue === null || scoreBValue === undefined || scoreBValue === "") return;
            const scoreA = Number(scoreAValue);
            const scoreB = Number(scoreBValue);
            if (!Number.isFinite(scoreA) || !Number.isFinite(scoreB)) return;
            const outcome = (teamId) => {
                if (scoreA === scoreB) return "draw";
                return (teamId === match.team_a_id ? scoreA > scoreB : scoreB > scoreA) ? "win" : "loss";
            };
            [match.team_a_id, match.team_b_id].forEach(teamId => {
                if (!matchesByTeam.has(teamId)) matchesByTeam.set(teamId, []);
                matchesByTeam.get(teamId).push({ match, outcome: outcome(teamId) });
            });
        });

        const grouped = new Map();
        playerHistoryData.teamPlayers.forEach(rosterRow => {
            const player = rosterRow.players;
            const team = teamById.get(rosterRow.competition_team_id);
            if (!player?.id || !team) return;
            const competition = competitionById.get(team.competition_id);
            if (!competition) return;
            const key = `${player.id}|${competition.id}|${team.id}`;
            if (!grouped.has(key)) {
                const results = matchesByTeam.get(team.id) || [];
                const stats = { played: results.length, wins: 0, draws: 0, losses: 0 };
                results.forEach(result => {
                    if (result.outcome === "win") stats.wins += 1;
                    else if (result.outcome === "draw") stats.draws += 1;
                    else if (result.outcome === "loss") stats.losses += 1;
                });
                grouped.set(key, {
                    key,
                    player,
                    playerId: player.id,
                    competition,
                    year: getCompetitionYear(
                        competition,
                        playerHistoryData.rounds.filter(round => round.competition_id === competition.id)
                    ),
                    team,
                    clubName: team.clubs?.name || "—",
                    teamName: getTeamLabel(team, playerHistoryData.teams),
                    position: rosterRow.position || "—",
                    played: stats.played,
                    wins: stats.wins,
                    draws: stats.draws,
                    losses: stats.losses,
                    winRate: stats.played ? Math.round((stats.wins / stats.played) * 100) : 0
                });
            }
        });

        return [...grouped.values()].sort((a, b) =>
            getPlayerLabel(a.player).localeCompare(getPlayerLabel(b.player)) ||
            String(b.competition.start_date || "").localeCompare(String(a.competition.start_date || "")) ||
            String(a.competition.name || "").localeCompare(String(b.competition.name || ""))
        );
    }, [playerHistoryData, competitions]);

    const playerHistoryPeople = useMemo(() => {
        const byPlayer = new Map();
        playerHistoryRows.forEach(row => {
            if (!byPlayer.has(row.playerId)) byPlayer.set(row.playerId, row.player);
        });
        return [...byPlayer.values()].sort((a, b) =>
            getPlayerLabel(a).localeCompare(getPlayerLabel(b))
        );
    }, [playerHistoryRows]);

    const filteredPlayerHistoryPeople = useMemo(() => {
        const term = playerSearch.trim().toLowerCase();
        return playerHistoryPeople.filter(player =>
            !term || getPlayerLabel(player).toLowerCase().includes(term)
        );
    }, [playerHistoryPeople, playerSearch]);

    const selectedPlayerHistory = useMemo(() => {
        if (!selectedPlayerId) return [];
        return playerHistoryRows
            .filter(row => row.playerId === selectedPlayerId)
            .sort((a, b) =>
                String(b.competition.start_date || "").localeCompare(String(a.competition.start_date || "")) ||
                String(a.competition.name || "").localeCompare(String(b.competition.name || ""))
            );
    }, [playerHistoryRows, selectedPlayerId]);

    const selectedPlayerTotals = useMemo(() => selectedPlayerHistory.reduce((total, row) => ({
        competitions: total.competitions + 1,
        played: total.played + row.played,
        wins: total.wins + row.wins,
        draws: total.draws + row.draws,
        losses: total.losses + row.losses
    }), { competitions: 0, played: 0, wins: 0, draws: 0, losses: 0 }), [selectedPlayerHistory]);

    const selectedPlayerMedals = useMemo(() => {
        if (!selectedPlayerId || !playerHistoryData) return [];

        const teamById = new Map(playerHistoryData.teams.map(team => [team.id, team]));
        const roundById = new Map(playerHistoryData.rounds.map(round => [round.id, round]));
        const rosterTeamIds = new Set(
            playerHistoryData.teamPlayers
                .filter(row => row.player_id === selectedPlayerId)
                .map(row => row.competition_team_id)
        );
        const medals = [];

        // Some competition formats store the played score in shots_for_a/b
        // rather than score_a/b. Accept either representation.
        const scoreFor = (match, side) => {
            const primary = match[`score_${side}`];
            const fallback = match[`shots_for_${side}`];
            const value = primary ?? fallback;
            return value === null || value === undefined || value === ""
                ? null
                : Number(value);
        };
        const hasResult = match => {
            if (!match?.completed || !match.team_a_id || !match.team_b_id) return false;
            const a = scoreFor(match, "a");
            const b = scoreFor(match, "b");
            return Number.isFinite(a) && Number.isFinite(b) && a !== b;
        };
        const winningTeamId = match =>
            scoreFor(match, "a") > scoreFor(match, "b") ? match.team_a_id : match.team_b_id;
        const losingTeamId = match =>
            scoreFor(match, "a") > scoreFor(match, "b") ? match.team_b_id : match.team_a_id;

        const addMedal = (competition, teamId, medal, sort) => {
            if (!rosterTeamIds.has(teamId)) return;
            const team = teamById.get(teamId);
            const roster = playerHistoryData.teamPlayers.find(
                item => item.player_id === selectedPlayerId &&
                    item.competition_team_id === teamId
            );
            if (!team || !roster) return;
            medals.push({
                key: `${competition.id}|${teamId}|${medal}`,
                medal,
                sort,
                competition,
                year: getCompetitionYear(
                    competition,
                    playerHistoryData.rounds.filter(round => round.competition_id === competition.id)
                ),
                team,
                teamName: getTeamLabel(team, playerHistoryData.teams),
                clubName: team.clubs?.name || "—",
                position: roster.position || "—"
            });
        };

        competitions
            .filter(competition => String(competition.status || "").toLowerCase() === "completed")
            .forEach(competition => {
                const competitionMatches = playerHistoryData.matches.filter(
                    match => match.competition_id === competition.id && hasResult(match)
                );
                const competitionRounds = playerHistoryData.rounds.filter(
                    round => round.competition_id === competition.id
                );
                const getRoundName = match =>
                    String(roundById.get(match.round_id)?.round_name || "").trim().toLowerCase();

                const finalMatches = competitionMatches.filter(match => {
                    const name = getRoundName(match);
                    return /final/.test(name) && !/semi|quarter|third.?place/.test(name);
                });
                const semiMatches = competitionMatches.filter(match =>
                    /semi[\s-]*final/.test(getRoundName(match))
                );

                if (finalMatches.length === 1) {
                    // Knockout competitions: winner/runner-up from the final,
                    // shared bronze for both losing semi-finalists.
                    const finalMatch = finalMatches[0];
                    const goldTeamId = winningTeamId(finalMatch);
                    const silverTeamId = losingTeamId(finalMatch);

                    addMedal(competition, goldTeamId, "Gold", 1);
                    addMedal(competition, silverTeamId, "Silver", 2);

                    [...new Set(semiMatches.map(losingTeamId))]
                        .filter(teamId => teamId !== goldTeamId && teamId !== silverTeamId)
                        .forEach(teamId => addMedal(competition, teamId, "Bronze", 3));

                    return;
                }

                // League / round-robin / Masters formats may have no Final
                // round. In those competitions, award medals from the final
                // completed standings using the same points and shot tie-breaks
                // as the competition standings report.
                const hasKnockoutRounds = competitionRounds.some(round =>
                    /\b(final|semi[\s-]*final|quarter[\s-]*final)\b/i.test(String(round.round_name || ""))
                );
                if (hasKnockoutRounds || !competitionMatches.length) return;

                const scoring = competition.scoring || {};
                const winPoints = Number(scoring.win ?? 2);
                const drawPoints = Number(scoring.draw ?? 1);
                const lossPoints = Number(scoring.loss ?? 0);
                const standings = new Map();

                playerHistoryData.teams
                    .filter(team => team.competition_id === competition.id)
                    .forEach(team => standings.set(team.id, {
                        team,
                        played: 0,
                        wins: 0,
                        draws: 0,
                        losses: 0,
                        points: 0,
                        shotsFor: 0,
                        shotsAgainst: 0
                    }));

                competitionMatches.forEach(match => {
                    const a = standings.get(match.team_a_id);
                    const b = standings.get(match.team_b_id);
                    if (!a || !b) return;
                    const scoreA = scoreFor(match, "a");
                    const scoreB = scoreFor(match, "b");

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

                const rankedTeams = [...standings.values()]
                    .filter(row => row.played > 0)
                    .sort((a, b) =>
                        b.points - a.points ||
                        (b.shotsFor - b.shotsAgainst) - (a.shotsFor - a.shotsAgainst) ||
                        b.shotsFor - a.shotsFor ||
                        getTeamLabel(a.team, playerHistoryData.teams).localeCompare(
                            getTeamLabel(b.team, playerHistoryData.teams)
                        )
                    );

                rankedTeams.slice(0, 3).forEach((row, index) => {
                    addMedal(competition, row.team.id, ["Gold", "Silver", "Bronze"][index], index + 1);
                });
            });

        return medals.sort((a, b) =>
            a.sort - b.sort ||
            String(b.competition.start_date || "").localeCompare(String(a.competition.start_date || "")) ||
            String(a.competition.name || "").localeCompare(String(b.competition.name || ""))
        );
    }, [selectedPlayerId, playerHistoryData, competitions]);

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
                skinsWon: 0,
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

            const skinsA = Number(match.skins_a ?? 0);
            const skinsB = Number(match.skins_b ?? 0);
            if (scoring.skins?.enabled) {
                a.skinsWon += skinsA;
                b.skinsWon += skinsB;
                a.points += skinsA * Number(scoring.skins.pointsPerSkin ?? 1);
                b.points += skinsB * Number(scoring.skins.pointsPerSkin ?? 1);
            }

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
                (() => {
                    const nameA = String(getTeamLabel(a.team, reportData.teams) || "");
                    const nameB = String(getTeamLabel(b.team, reportData.teams) || "");
                    if (nameA < nameB) return -1;
                    if (nameA > nameB) return 1;
                    return 0;
                })()
            );
    }, [reportData]);

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
                (getPlayerLabel(a.player)).localeCompare(
                    getPlayerLabel(b.player)
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
                    skinsWon: 0,
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

            const skinsA = Number(match.skins_a ?? 0);
            const skinsB = Number(match.skins_b ?? 0);
            if (scoring.skins?.enabled) {
                a.skinsWon += skinsA;
                b.skinsWon += skinsB;
                a.points += skinsA * Number(scoring.skins.pointsPerSkin ?? 1);
                b.points += skinsB * Number(scoring.skins.pointsPerSkin ?? 1);
            }

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
            .sort((a, b) => {
                const pointDiff = b.points - a.points;
                if (pointDiff !== 0) return pointDiff;

                const aggregateDiff = b.aggregate - a.aggregate;
                if (aggregateDiff !== 0) return aggregateDiff;

                const nameA = String(a.clubName || "");
                const nameB = String(b.clubName || "");
                if (nameA < nameB) return -1;
                if (nameA > nameB) return 1;
                return 0;
            });
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

    const exportCsv = () => {
        if (!reportData && reportType !== "player-history") return;

        let headers = [];
        let rows = [];
        const escape = value => `"${String(value ?? "").replaceAll('"', '""')}"`;

        if (reportType === "player-history") {
            headers = ["Player", "Competition", "Year", "Format", "Club", "Team", "Position", "Played", "Wins", "Draws", "Losses", "Win Rate"];
            rows = selectedPlayerHistory.map(row => [
                getPlayerLabel(row.player),
                row.competition.name,
                row.year,
                row.competition.format || "",
                row.clubName,
                row.teamName,
                row.position,
                row.played,
                row.wins,
                row.draws,
                row.losses,
                `${row.winRate}%`
            ]);
        } else if (reportType === "standings") {
            headers = ["Position", "Team", "Club", "Played", "Wins", "Draws", "Losses", "Skins", "Points", "Shots For", "Shots Against", "Aggregate"];
            rows = standings.map((row, index) => [index + 1, getTeamLabel(row.team, reportData?.teams), row.team.clubs?.name || "", row.played, row.wins, row.draws, row.losses, row.skinsWon, row.points, row.shotsFor, row.shotsAgainst, row.aggregate]);
        } else if (reportType === "results") {
            headers = ["Round", "Match", "Team A", "Score A", "Skins A", "Team B", "Score B", "Skins B", "Status", "Completed"];
            rows = reportData.matches.map(match => [match.round?.round_name || `Round ${match.round?.round_number || ""}`, match.match_number, getTeamLabel(match.teamA, reportData?.teams), match.score_a ?? "", match.skins_a ?? "", getTeamLabel(match.teamB, reportData?.teams), match.score_b ?? "", match.skins_b ?? "", match.completed ? "Completed" : "Pending", match.completed_at || ""]);
        } else if (reportType === "players") {
            headers = ["Player", "Played", "Wins", "Draws", "Losses", "Shots For", "Shots Against", "Aggregate"];
            rows = playerPerformance.map(row => [getPlayerLabel(row.player), row.played, row.wins, row.draws, row.losses, row.shotsFor, row.shotsAgainst, row.aggregate]);
        } else if (reportType === "clubs") {
            headers = ["Club", "Teams", "Played", "Wins", "Draws", "Losses", "Skins", "Points", "Shots For", "Shots Against", "Aggregate"];
            rows = clubPerformance.map(row => [row.clubName, row.teams, row.played, row.wins, row.draws, row.losses, row.skinsWon, row.points, row.shotsFor, row.shotsAgainst, row.aggregate]);
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

                {(reportData || (reportType === "player-history" && selectedPlayerHistory.length > 0)) && (
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
                                {reportType !== "player-history" && <div className="col-12 col-lg-7">
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
                                </div>}
                                <div className={reportType === "player-history" ? "col-12" : "col-12 col-lg-5"}>
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

                    {reportType === "player-history" ? (
                        loadingPlayerHistory ? (
                            <LoadingState message="Loading player competition history..." compact />
                        ) : playerHistoryData ? (
                            <PlayerHistoryReport
                                people={filteredPlayerHistoryPeople}
                                allPeople={playerHistoryPeople}
                                search={playerSearch}
                                onSearch={setPlayerSearch}
                                selectedPlayerId={selectedPlayerId}
                                onSelectPlayer={setSelectedPlayerId}
                                rows={selectedPlayerHistory}
                                totals={selectedPlayerTotals}
                                medals={selectedPlayerMedals}
                            />
                        ) : null
                    ) : loadingReport ? (
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
                            {reportType === "standings" && <StandingsReport standings={standings} allTeams={reportData?.teams || []} skinsEnabled={Boolean(reportData?.competition?.scoring?.skins?.enabled)} />}
                            {reportType === "results" && <ResultsReport matches={reportData.matches} allTeams={reportData?.teams || []} formatDate={formatDate} skinsEnabled={Boolean(reportData?.competition?.scoring?.skins?.enabled)} />}
                            {reportType === "players" && <PlayersReport rows={playerPerformance} />}
                            {reportType === "clubs" && <ClubsReport rows={clubPerformance} skinsEnabled={Boolean(reportData?.competition?.scoring?.skins?.enabled)} />}
                        </>
                    ) : null}
                </>
            )}
        </div>
    );
}

function PlayerHistoryReport({
    people,
    allPeople,
    search,
    onSearch,
    selectedPlayerId,
    onSelectPlayer,
    rows,
    totals,
    medals
}) {
    const selectedPlayer = allPeople.find(player => player.id === selectedPlayerId);
    const winRate = totals.played ? Math.round((totals.wins / totals.played) * 100) : 0;

    return (
        <>
            <div className="card border-0 shadow-sm mb-4">
                <div className="card-body">
                    <div className="row g-3 align-items-end">
                        <div className="col-12 col-lg-6">
                            <label className="form-label fw-semibold">Find player</label>
                            <input
                                className="form-control"
                                type="search"
                                placeholder="Search by player name..."
                                value={search}
                                onChange={event => onSearch(event.target.value)}
                            />
                        </div>
                        <div className="col-12 col-lg-6">
                            <label className="form-label fw-semibold">Select player</label>
                            <select
                                className="form-select"
                                value={selectedPlayerId}
                                onChange={event => onSelectPlayer(event.target.value)}
                            >
                                <option value="">Choose a player</option>
                                {people.map(player => (
                                    <option key={player.id} value={player.id}>{getPlayerLabel(player)}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                    <div className="small text-muted mt-2">
                        Player history includes participation and completed match results across all competitions.
                    </div>
                </div>
            </div>

            {!selectedPlayerId ? (
                <div className="card border-0 shadow-sm">
                    <div className="card-body text-center py-5">
                        <i className="bi bi-person-lines-fill display-4 text-muted"></i>
                        <h4 className="mt-3">Select a player</h4>
                        <p className="text-muted mb-0">
                            {allPeople.length
                                ? `${allPeople.length} player(s) found across the available competitions.`
                                : "No player competition records were found."}
                        </p>
                    </div>
                </div>
            ) : (
                <>
                    <div className="card border-0 shadow-sm mb-4">
                        <div className="card-body">
                            <h2 className="h4 mb-3">{getPlayerLabel(selectedPlayer)}</h2>
                            <div className="row g-3">
                                {[
                                    ["Competitions", totals.competitions],
                                    ["Games Played", totals.played],
                                    ["Wins", totals.wins],
                                    ["Draws", totals.draws],
                                    ["Losses", totals.losses],
                                    ["Win Rate", `${winRate}%`]
                                ].map(([label, value]) => (
                                    <div className="col-6 col-md-4 col-xl-2" key={label}>
                                        <div className="border rounded p-3 h-100">
                                            <div className="fs-4 fw-bold">{value}</div>
                                            <div className="small text-muted">{label}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    <ReportTable title="Competition History" icon="person-lines-fill">
                        <table className="table table-hover align-middle mb-0">
                            <thead className="table-light">
                                <tr>
                                    <th>Competition</th>
                                    <th>Year</th>
                                    <th>Format</th>
                                    <th>Club</th>
                                    <th>Team</th>
                                    <th>Position</th>
                                    <th className="text-center">Played</th>
                                    <th className="text-center">W</th>
                                    <th className="text-center">D</th>
                                    <th className="text-center">L</th>
                                    <th className="text-center">Win %</th>
                                </tr>
                            </thead>
                            <tbody>
                                {rows.length ? rows.map(row => (
                                    <tr key={row.key}>
                                        <td className="fw-semibold">{row.competition.name}</td>
                                        <td>{row.year}</td>
                                        <td>{labelValue(row.competition.format)}</td>
                                        <td>{row.clubName}</td>
                                        <td>{row.teamName}</td>
                                        <td>{labelValue(row.position)}</td>
                                        <td className="text-center">{row.played}</td>
                                        <td className="text-center text-success fw-semibold">{row.wins}</td>
                                        <td className="text-center">{row.draws}</td>
                                        <td className="text-center text-danger fw-semibold">{row.losses}</td>
                                        <td className="text-center fw-semibold">{row.winRate}%</td>
                                    </tr>
                                )) : (
                                    <tr><td colSpan="11" className="text-center text-muted py-4">No competition history found for this player.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </ReportTable>

                    <div className="card border-0 shadow-sm mt-4">
                        <div className="card-header bg-white">
                            <strong><i className="bi bi-award-fill me-2"></i>Top 3 Medals Achieved</strong>
                            <div className="small text-muted mt-1">
                                Gold, Silver and shared Bronze awards from completed competitions.
                            </div>
                        </div>
                        <div className="card-body p-0">
                            {medals.length ? (
                                <div className="table-responsive">
                                    <table className="table table-hover align-middle mb-0">
                                        <thead className="table-light">
                                            <tr>
                                                <th>Medal</th>
                                                <th>Competition</th>
                                                <th>Year</th>
                                                <th>Club</th>
                                                <th>Team</th>
                                                <th>Playing Position</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {medals.map(item => (
                                                <tr key={item.key}>
                                                    <td>
                                                        <span className={`badge ${
                                                            item.medal === "Gold" ? "bg-warning text-dark" :
                                                            item.medal === "Silver" ? "bg-secondary" :
                                                            "bg-danger"
                                                        }`}>{item.medal}</span>
                                                    </td>
                                                    <td className="fw-semibold">{item.competition.name}</td>
                                                    <td>{item.year}</td>
                                                    <td>{item.clubName}</td>
                                                    <td>{item.teamName}</td>
                                                    <td>{labelValue(item.position)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <div className="text-center text-muted py-4">
                                    No Gold, Silver or Bronze medals recorded for this player yet.
                                </div>
                            )}
                        </div>
                    </div>
                </>
            )}
        </>
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

function StandingsReport({ standings, allTeams, skinsEnabled }) {
    return (
        <ReportTable title="Standings" icon="trophy-fill">
            <table className="table table-hover align-middle mb-0">
                <thead className="table-light"><tr><th>#</th><th>Team</th><th>Club</th><th className="text-center">P</th><th className="text-center">W</th><th className="text-center">D</th><th className="text-center">L</th>{skinsEnabled && <th className="text-center">Skins</th>}<th className="text-center">Pts</th><th className="text-center">SF</th><th className="text-center">SA</th><th className="text-center">Agg</th></tr></thead>
                <tbody>
                    {standings.map((row, index) => (
                        <tr key={row.team.id} className={index === 0 ? "table-success" : ""}>
                            <td className="fw-bold">{index + 1}</td>
                            <td className="fw-semibold">{getTeamLabel(row.team, allTeams)}</td>
                            <td>{row.team.clubs?.name || "—"}</td>
                            <td className="text-center">{row.played}</td>
                            <td className="text-center">{row.wins}</td>
                            <td className="text-center">{row.draws}</td>
                            <td className="text-center">{row.losses}</td>
                            {skinsEnabled && <td className="text-center">{row.skinsWon}</td>}
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

function ResultsReport({ matches, allTeams, formatDate, skinsEnabled }) {
    const ordered = [...matches].sort((a, b) => (a.round?.round_number || 0) - (b.round?.round_number || 0) || a.match_number - b.match_number);
    return (
        <ReportTable title="Match Results" icon="list-ol">
            <table className="table table-hover align-middle mb-0">
                <thead className="table-light"><tr><th>Round</th><th>Match</th><th>Team A</th><th className="text-center">Score</th>{skinsEnabled && <th className="text-center">Skins</th>}<th>Team B</th><th className="text-center">Score</th>{skinsEnabled && <th className="text-center">Skins</th>}<th>Status</th><th>Completed</th></tr></thead>
                <tbody>
                    {ordered.map(match => (
                        <tr key={match.id}>
                            <td>{match.round?.round_name || `Round ${match.round?.round_number || "—"}`}</td>
                            <td>{match.match_number}</td>
                            <td>{getTeamLabel(match.teamA, allTeams)}</td>
                            <td className="text-center fw-bold">{match.completed ? match.score_a : "—"}</td>
                            {skinsEnabled && <td className="text-center">{match.completed ? (match.skins_a ?? 0) : "—"}</td>}
                            <td>{getTeamLabel(match.teamB, allTeams)}</td>
                            <td className="text-center fw-bold">{match.completed ? match.score_b : "—"}</td>
                            {skinsEnabled && <td className="text-center">{match.completed ? (match.skins_b ?? 0) : "—"}</td>}
                            <td><span className={`badge ${match.completed ? "bg-success" : "bg-secondary"}`}>{match.completed ? "Completed" : "Pending"}</span></td>
                            <td className="small text-muted">{match.completed_at ? formatDate(match.completed_at.slice(0, 10)) : "—"}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </ReportTable>
    );
}

function PlayersReport({ rows }) {
    return (
        <ReportTable title="Player Performance" icon="people-fill">
            <table className="table table-hover align-middle mb-0">
                <thead className="table-light"><tr><th>#</th><th>Player</th><th className="text-center">P</th><th className="text-center">W</th><th className="text-center">D</th><th className="text-center">L</th><th className="text-center">SF</th><th className="text-center">SA</th><th className="text-center">Agg</th><th className="text-center">Win %</th></tr></thead>
                <tbody>
                    {rows.map((row, index) => (
                        <tr key={row.player.id}>
                            <td>{index + 1}</td>
                            <td className="fw-semibold">{getPlayerLabel(row.player)}</td>
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

function ClubsReport({ rows, skinsEnabled }) {
    return (
        <ReportTable title="Club Performance" icon="building-fill">
            <table className="table table-hover align-middle mb-0">
                <thead className="table-light"><tr><th>#</th><th>Club</th><th className="text-center">Teams</th><th className="text-center">P</th><th className="text-center">W</th><th className="text-center">D</th><th className="text-center">L</th>{skinsEnabled && <th className="text-center">Skins</th>}<th className="text-center">Pts</th><th className="text-center">SF</th><th className="text-center">SA</th><th className="text-center">Agg</th></tr></thead>
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
                            {skinsEnabled && <td className="text-center">{row.skinsWon}</td>}
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
