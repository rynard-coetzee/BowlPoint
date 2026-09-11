import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";

import "./LiveTournament.css";

import {
    getTournamentByPublicCode
} from "../../services/supabase/tournamentService";

import {
    getTournamentTeams
} from "../../services/supabase/teamService";

import {
    getTournamentRounds
} from "../../services/supabase/matchService";

import {
    calculateStandings,
    formatAggregate
} from "../../lib/standingsEngine";


function LiveTournament() {

    const { publicCode } = useParams();

    const [tournament, setTournament] =
        useState(null);

    const [loading, setLoading] =
        useState(true);

    const [error, setError] =
        useState(null);

    const [lastUpdated, setLastUpdated] =
        useState(null);


    /*
     * Load tournament
     */
    const loadTournament = useCallback(
        async (showLoading = false) => {

            if (!publicCode) {
                return;
            }

            if (showLoading) {
                setLoading(true);
            }

            try {

                setError(null);

                const tournamentData =
                    await getTournamentByPublicCode(
                        publicCode
                    );

                const [
                    teamData,
                    roundData
                ] = await Promise.all([

                    getTournamentTeams(
                        tournamentData.id
                    ),

                    getTournamentRounds(
                        tournamentData.id
                    )

                ]);


                /*
                 * Convert Supabase teams into the
                 * structure expected by BowlPoint.
                 */
                const teams =
                    teamData
                        .map(item => item.team)
                        .filter(Boolean);


                /*
                 * Convert Supabase rounds/matches
                 * into the structure expected by
                 * standingsEngine.js
                 */
                const rounds =
                    roundData.map(round => ({

                        id: round.id,

                        roundNumber:
                            round.round_number,

                        number:
                            round.round_number,

                        status:
                            round.status,

                        matches:
                            (round.matches || [])
                                .map(match => ({

                                    id: match.id,

                                    teamA:
                                        match.teamA,

                                    teamB:
                                        match.teamB,

                                    scoreA:
                                        match.score_a,

                                    scoreB:
                                        match.score_b,

                                    skinsA:
                                        match.skins_a,

                                    skinsB:
                                        match.skins_b,

                                    completed:
                                        match.completed

                                }))

                    }));


                const normalisedTournament = {

                    ...tournamentData,

                    totalRounds:
                        tournamentData.total_rounds,

                    currentRound:
                        tournamentData.current_round,

                    scoring:
                        tournamentData.scoring,

                    teams,

                    rounds

                };


                setTournament(
                    normalisedTournament
                );

                setLastUpdated(
                    new Date()
                );


            } catch (err) {

                console.error(
                    "Live tournament error:",
                    err
                );

                setError(
                    err.message ||
                    "Unable to load tournament."
                );

            } finally {

                setLoading(false);

            }

        },
        [publicCode]
    );


    /*
     * Initial load
     */
    useEffect(() => {

        loadTournament(true);

    }, [loadTournament]);


    /*
     * Automatic refresh every 10 seconds.
     */
    useEffect(() => {

        const interval =
            setInterval(() => {

                loadTournament(false);

            }, 10000);

        return () => {

            clearInterval(interval);

        };

    }, [loadTournament]);


    /*
     * Calculate standings using the existing
     * BowlPoint standings engine.
     */
    const standings =
        tournament
            ? calculateStandings(tournament)
            : [];


    /*
     * Get all completed matches.
     *
     * These are displayed in the Results section.
     */
    const completedMatches = [];

    if (tournament) {

        tournament.rounds.forEach(round => {

            round.matches.forEach(match => {

                if (match.completed) {

                    completedMatches.push({

                        ...match,

                        roundNumber:
                            round.roundNumber

                    });

                }

            });

        });

    }


    /*
     * Find the NEXT round.
     *
     * This is the first round that still has
     * at least one incomplete match.
     *
     * If every round is complete, there is no
     * next round to display.
     */
    const nextRound =
        tournament
            ? tournament.rounds.find(
                round =>
                    round.matches.some(
                        match =>
                            !match.completed
                    )
            )
            : null;


    /*
     * Loading state
     */
    if (loading && !tournament) {

        return (

            <div className="live-tournament-page">

                <div className="live-loading">

                    <div
                        className="spinner-border text-success"
                        role="status"
                    />

                    <h5 className="mt-3">
                        Loading tournament...
                    </h5>

                </div>

            </div>

        );

    }


    /*
     * Error state
     */
    if (error && !tournament) {

        return (

            <div className="live-tournament-page">

                <div className="live-error">

                    <div className="mb-3">

                        <i className="bi bi-exclamation-circle-fill"></i>

                    </div>

                    <h3>
                        Tournament Not Found
                    </h3>

                    <p className="text-muted">
                        We couldn't find a public tournament
                        with the code:
                    </p>

                    <code className="fs-5">
                        {publicCode}
                    </code>

                </div>

            </div>

        );

    }


    if (!tournament) {
        return null;
    }


    return (

        <div className="live-tournament-page">


            {/* =========================
                HEADER
            ========================= */}

            <header className="live-header">

                <div className="live-brand">

                    <img
                        src="/bowlpoint-logo.png"
                        alt="BowlPoint"
                    />

                </div>


                <div className="live-tournament-title">

                    <div className="live-status">

                        <span className="live-dot"></span>

                        LIVE

                    </div>

                    <h1>
                        {tournament.name}
                    </h1>

                    <p>

                        Round{" "}

                        {tournament.currentRound || 1}

                        {" "}of{" "}

                        {tournament.totalRounds}

                    </p>

                </div>

            </header>


            {/* =========================
                LAST UPDATED
            ========================= */}

            <div className="live-updated">

                <i className="bi bi-arrow-repeat me-2"></i>

                Updated{" "}

                {lastUpdated
                    ? lastUpdated.toLocaleTimeString(
                        [],
                        {
                            hour: "2-digit",
                            minute: "2-digit"
                        }
                    )
                    : "—"}

                <span className="ms-2">
                    • updates automatically
                </span>

            </div>


            <main className="live-content">


                {/* =========================
                    STANDINGS
                ========================= */}

                <section className="live-section">

                    <div className="live-section-title">

                        <div>

                            <i className="bi bi-trophy-fill"></i>

                            <h2>
                                Standings
                            </h2>

                        </div>

                    </div>


                    <div className="live-card">

                        {standings.length === 0 ? (

                            <div className="live-empty">

                                <i className="bi bi-bar-chart"></i>

                                <p>
                                    No teams yet.
                                </p>

                            </div>

                        ) : (

                            <div className="table-responsive">

                                <table className="table live-standings-table align-middle mb-0">

                                    <thead>

                                        <tr>

                                            <th>
                                                #
                                            </th>

                                            <th>
                                                Team
                                            </th>

                                            <th className="text-center">
                                                P
                                            </th>

                                            <th className="text-center">
                                                W
                                            </th>

                                            <th className="text-center">
                                                D
                                            </th>

                                            <th className="text-center">
                                                L
                                            </th>

                                            <th className="text-center">
                                                F
                                            </th>

                                            <th className="text-center">
                                                A
                                            </th>

                                            <th className="text-center">
                                                Agg
                                            </th>

                                            <th className="text-center">
                                                Pts
                                            </th>

                                        </tr>

                                    </thead>


                                    <tbody>

                                        {standings.map(
                                            (
                                                standing,
                                                index
                                            ) => (

                                                <tr
                                                    key={
                                                        standing
                                                            .team
                                                            .id
                                                    }
                                                >

                                                    <td>

                                                        <span
                                                            className={
                                                                `live-position ${
                                                                    index < 3
                                                                        ? "top-three"
                                                                        : ""
                                                                }`
                                                            }
                                                        >

                                                            {index + 1}

                                                        </span>

                                                    </td>


                                                    <td>

                                                        <strong>

                                                            {
                                                                standing
                                                                    .team
                                                                    .name
                                                            }

                                                        </strong>

                                                    </td>


                                                    <td className="text-center">

                                                        {
                                                            standing.played
                                                        }

                                                    </td>


                                                    <td className="text-center">

                                                        {
                                                            standing.wins
                                                        }

                                                    </td>


                                                    <td className="text-center">

                                                        {
                                                            standing.draws
                                                        }

                                                    </td>


                                                    <td className="text-center">

                                                        {
                                                            standing.losses
                                                        }

                                                    </td>


                                                    <td className="text-center">

                                                        {
                                                            standing.shotsFor
                                                        }

                                                    </td>


                                                    <td className="text-center">

                                                        {
                                                            standing.shotsAgainst
                                                        }

                                                    </td>


                                                    <td className="text-center">

                                                        <span
                                                            className={
                                                                standing.shotsFor -
                                                                standing.shotsAgainst >=
                                                                0
                                                                    ? "text-success fw-semibold"
                                                                    : "text-danger fw-semibold"
                                                            }
                                                        >

                                                            {
                                                                formatAggregate(
                                                                    standing
                                                                )
                                                            }

                                                        </span>

                                                    </td>


                                                    <td className="text-center">

                                                        <strong className="live-points">

                                                            {
                                                                standing.points
                                                            }

                                                        </strong>

                                                    </td>

                                                </tr>

                                            )
                                        )}

                                    </tbody>

                                </table>

                            </div>

                        )}

                    </div>

                </section>


                {/* =========================
                    COMPLETED RESULTS
                ========================= */}

                <section className="live-section">

                    <div className="live-section-title">

                        <div>

                            <i className="bi bi-check-circle-fill"></i>

                            <h2>
                                Results
                            </h2>

                        </div>

                        <span>

                            {completedMatches.length}

                            {" "}completed

                        </span>

                    </div>


                    <div className="live-results">

                        {completedMatches.length === 0 ? (

                            <div className="live-card live-empty">

                                <i className="bi bi-hourglass-split"></i>

                                <p>
                                    No results have been recorded yet.
                                </p>

                            </div>

                        ) : (

                            [...completedMatches]
                                .reverse()
                                .map(match => (

                                    <div
                                        className="live-result-card"
                                        key={match.id}
                                    >

                                        <div className="live-result-round">

                                            Round{" "}

                                            {match.roundNumber}

                                        </div>


                                        <div className="live-result-teams">

                                            <div
                                                className={
                                                    `live-result-team ${
                                                        match.scoreA >
                                                        match.scoreB
                                                            ? "winner"
                                                            : ""
                                                    }`
                                                }
                                            >

                                                <strong>

                                                    {
                                                        match
                                                            .teamA
                                                            ?.name ||
                                                        "Team A"
                                                    }

                                                </strong>

                                                <span>

                                                    {
                                                        match.scoreA
                                                    }

                                                </span>

                                            </div>


                                            <div className="live-vs">

                                                VS

                                            </div>


                                            <div
                                                className={
                                                    `live-result-team ${
                                                        match.scoreB >
                                                        match.scoreA
                                                            ? "winner"
                                                            : ""
                                                    }`
                                                }
                                            >

                                                <strong>

                                                    {
                                                        match
                                                            .teamB
                                                            ?.name ||
                                                        "Team B"
                                                    }

                                                </strong>

                                                <span>

                                                    {
                                                        match.scoreB
                                                    }

                                                </span>

                                            </div>

                                        </div>

                                    </div>

                                ))

                        )}

                    </div>

                </section>


                {/* =========================
                    NEXT ROUND
                ========================= */}

                {nextRound && (

                    <section className="live-section">

                        <div className="live-section-title">

                            <div>

                                <i className="bi bi-diagram-3-fill"></i>

                                <h2>

                                    Next Round

                                </h2>

                            </div>

                            <span>

                                Round {nextRound.roundNumber}

                            </span>

                        </div>


                        <div className="live-current-round">

                            {nextRound.matches.map(
                                match => (

                                    <div
                                        className="live-fixture"
                                        key={match.id}
                                    >

                                        <div className="live-fixture-team">

                                            <span>

                                                {
                                                    match
                                                        .teamA
                                                        ?.name ||
                                                    "Team A"
                                                }

                                            </span>

                                        </div>


                                        <div className="live-fixture-vs">

                                            VS

                                        </div>


                                        <div className="live-fixture-team text-end">

                                            <span>

                                                {
                                                    match
                                                        .teamB
                                                        ?.name ||
                                                    "Team B"
                                                }

                                            </span>

                                        </div>

                                    </div>

                                )
                            )}

                        </div>

                    </section>

                )}


                {/* =========================
                    TOURNAMENT COMPLETE
                ========================= */}

                {!nextRound &&
                    completedMatches.length > 0 && (

                        <section className="live-section">

                            <div className="alert alert-success text-center">

                                <i className="bi bi-trophy-fill me-2"></i>

                                <strong>
                                    Tournament Complete
                                </strong>

                            </div>

                        </section>

                    )}


            </main>


            {/* =========================
                FOOTER
            ========================= */}

            <footer className="live-footer">

                <img
                    src="/bowlpoint-logo.png"
                    alt="BowlPoint"
                />

                <span>
                    Live tournament results
                </span>

            </footer>

        </div>

    );

}

export default LiveTournament;