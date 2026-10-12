/*
 * Printable fixture export for Full Competition.
 *
 * Layout is based on the club's printed fixture sheet:
 *   Num | Team Name (players + positions) | Club | R1 Opp/Rink | R2 Opp/Rink ...
 *
 * Rinks are intentionally blank until rink allocation is implemented.
 * Uses the browser's native print dialog so no PDF library is required.
 */

function escapeHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function formatDate(dateString) {
    if (!dateString) return "";

    const date = new Date(`${dateString}T00:00:00`);

    if (Number.isNaN(date.getTime())) return "";

    return date.toLocaleDateString("en-ZA", {
        weekday: "long",
        day: "numeric",
        month: "short",
        year: "numeric"
    }).toUpperCase();
}

function getTeamNumber(team) {
    if (!team) return "";
    return team.team_number ?? "";
}

function getTeamMembers(team) {
    const members = (team?.competition_team_players || [])
        .slice()
        .sort((a, b) => (a.position_order || 0) - (b.position_order || 0));

    return members
        .map(member => {
            const player = member.players;
            if (!player) return null;

            const name =
                player.display_name ||
                [player.first_name, player.nickname ? `(${player.nickname})` : "", player.last_name]
                    .filter(Boolean)
                    .join(" ")
                    .trim();

            if (!name) return null;

            const position = member.position
                ? String(member.position).replace(/_/g, " ").replace(/\b\w/g, char => char.toUpperCase())
                : "";

            return position ? `${name} - ${position}` : name;
        })
        .filter(Boolean);
}

function getTeamNameHtml(team) {
    if (!team) return "To be determined";

    const teamName = team.team_name || team.name || "Team";
    const members = getTeamMembers(team);

    if (!members.length) {
        return escapeHtml(teamName);
    }

    return `${escapeHtml(teamName)} <span class="players">(${escapeHtml(members.join(", "))})</span>`;
}

function getTeamClub(team) {
    return team?.clubs?.short_name || team?.clubs?.name || "";
}

function getTeamLabel(match, side) {
    const team = side === "a" ? match.teamA : match.teamB;

    if (team) {
        const number = getTeamNumber(team);
        const name = team.team_name || team.name || "Team";
        return number !== "" ? `#${number} ${name}` : name;
    }

    const roundNumber = Number(match.round?.round_number);
    const matchNumber = Number(match.match_number);

    if (roundNumber === 4) {
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
}

function getRoundSchedule(round, playingDays) {
    const day =
        playingDays.find(item => item.id === round.competition_day_id) ||
        round.competition_days;

    if (!day) {
        return { date: "", venue: "" };
    }

    const venue =
        day.clubs?.name ||
        day.clubs?.short_name ||
        "";

    return {
        date: formatDate(day.playing_date),
        venue
    };
}

function getOpponentForTeam(teamId, roundId, matches) {
    const match = matches.find(item =>
        item.round_id === roundId &&
        (item.team_a_id === teamId || item.team_b_id === teamId)
    );

    if (!match) return "";

    if (match.team_a_id === teamId) {
        return match.teamB ? getTeamNumber(match.teamB) : getTeamLabel(match, "b");
    }

    return match.teamA ? getTeamNumber(match.teamA) : getTeamLabel(match, "a");
}

function isByeForTeam(teamId, roundId, matches, sectionTeamIds) {
    const match = matches.find(item =>
        item.round_id === roundId &&
        (item.team_a_id === teamId || item.team_b_id === teamId)
    );

    if (!match) return false;

    const otherTeamId = match.team_a_id === teamId ? match.team_b_id : match.team_a_id;
    return !otherTeamId || !sectionTeamIds.has(otherTeamId);
}

function buildSectionTable(section, rounds, matches, playingDays) {
    const sectionTeams = (section.teams || [])
        .slice()
        .sort((a, b) => (a.team_number || 0) - (b.team_number || 0));

    if (!sectionTeams.length) return "";

    const sectionTeamIds = new Set(sectionTeams.map(team => team.id));
    const sectionRounds = rounds.filter(round =>
        matches.some(match => match.section_id === section.id && match.round_id === round.id)
    );

    if (!sectionRounds.length) return "";

    const dateGroups = sectionRounds.map(round => getRoundSchedule(round, playingDays));
    const sameDate = dateGroups.every(item => item.date === dateGroups[0].date);

    const dateHeader = sameDate
        ? `<th class="date-group" colspan="${sectionRounds.length * 2}">${escapeHtml(dateGroups[0].date)}</th>`
        : sectionRounds.map((round, index) =>
            `<th class="date-group" colspan="2">${escapeHtml(dateGroups[index].date)}</th>`
        ).join("");

    const roundHeader = sectionRounds.map(round =>
        `<th class="round-group" colspan="2">R${escapeHtml(round.round_number)}</th>`
    ).join("");

    const timeHeader = sectionRounds.map(() =>
        `<th class="time-cell" colspan="2">&nbsp;</th>`
    ).join("");

    const subHeader = sectionRounds.map(() =>
        `<th class="opp-col">Opp</th><th class="rink-col">Rink</th>`
    ).join("");

    const rows = sectionTeams.map(team => {
        const teamMatches = matches.filter(match => match.section_id === section.id);

        const roundCells = sectionRounds.map(round => {
            const opponent = getOpponentForTeam(team.id, round.id, teamMatches);
            const bye = isByeForTeam(team.id, round.id, teamMatches, sectionTeamIds);

            return `
                <td class="opp-cell">${bye ? "BYE" : escapeHtml(opponent || "")}</td>
                <td class="rink-cell">&nbsp;</td>
            `;
        }).join("");

        return `
            <tr>
                <td class="num-cell">${escapeHtml(team.team_number ?? "")}</td>
                <td class="name-cell">
                    <span class="team-name">${getTeamNameHtml(team)}</span>
                </td>
                <td class="club-cell">${escapeHtml(getTeamClub(team))}</td>
                ${roundCells}
            </tr>
        `;
    }).join("");

    return `
        <section class="section-block">
            <table class="fixture-table">
                <thead>
                    <tr>
                        <th class="section-title" colspan="3" rowspan="3">
                            ${escapeHtml(section.section_name || `Section ${section.section_number}`)}
                        </th>
                        ${dateHeader}
                    </tr>
                    <tr>
                        ${roundHeader}
                    </tr>
                    <tr>
                        ${timeHeader}
                    </tr>
                    <tr class="column-header">
                        <th class="num-head">Num</th>
                        <th class="name-head">Name (Players)</th>
                        <th class="club-head">Club</th>
                        ${subHeader}
                    </tr>
                </thead>
                <tbody>
                    ${rows}
                </tbody>
            </table>
        </section>
    `;
}

function buildPlayoffHtml(rounds, matches, playingDays) {
    const playoffRounds = rounds.filter(round =>
        matches.some(match =>
            match.round_id === round.id &&
            (match.section_id === null || match.section_id === undefined)
        )
    );

    if (!playoffRounds.length) return "";

    return `
        <section class="playoff-block">
            <h2>PLAYOFFS</h2>
            ${playoffRounds.map(round => {
                const roundMatches = matches
                    .filter(match =>
                        match.round_id === round.id &&
                        (match.section_id === null || match.section_id === undefined)
                    )
                    .sort((a, b) => (a.match_number || 0) - (b.match_number || 0));

                const schedule = getRoundSchedule(round, playingDays);

                return `
                    <div class="playoff-round">
                        <div class="playoff-round-header">
                            <strong>R${escapeHtml(round.round_number)} ${escapeHtml(round.round_name || "")}</strong>
                            <span>${escapeHtml(schedule.date)}${schedule.venue ? ` • ${escapeHtml(schedule.venue)}` : ""}</span>
                        </div>
                        <table class="playoff-table">
                            <thead>
                                <tr><th>Match</th><th>Team A</th><th>vs</th><th>Team B</th><th>Rink</th></tr>
                            </thead>
                            <tbody>
                                ${roundMatches.map(match => `
                                    <tr>
                                        <td>${escapeHtml(match.match_number)}</td>
                                        <td>${escapeHtml(getTeamLabel(match, "a"))}</td>
                                        <td class="vs">vs</td>
                                        <td>${escapeHtml(getTeamLabel(match, "b"))}</td>
                                        <td>&nbsp;</td>
                                    </tr>
                                `).join("")}
                            </tbody>
                        </table>
                    </div>
                `;
            }).join("")}
        </section>
    `;
}

export function exportCompetitionFixturesPdf({
    competition,
    confirmedDraw,
    playingDays = []
}) {
    if (!competition || !confirmedDraw) return;

    const rounds = [...(confirmedDraw.rounds || [])]
        .sort((a, b) => (a.round_number || 0) - (b.round_number || 0));

    const matches = confirmedDraw.matches || [];

    if (!rounds.length || !matches.length) {
        window.alert("There are no fixtures to export yet.");
        return;
    }

    const sections = (confirmedDraw.sections || [])
        .slice()
        .sort((a, b) => (a.section_number || 0) - (b.section_number || 0));

    let content = "";

    if (sections.length) {
        content = sections
            .map(section => buildSectionTable(section, rounds, matches, playingDays))
            .join("");

        content += buildPlayoffHtml(rounds, matches, playingDays);
    } else {
        // No sections: retain a useful fixture list for straight round-robin/knockout events.
        content = buildPlayoffHtml(rounds, matches, playingDays).replace("PLAYOFFS", "FIXTURES");
    }

    const title = escapeHtml(competition.name || "BowlPoint Competition");
    const venue = escapeHtml(
        competition.host_club?.name ||
        competition.host_club?.short_name ||
        ""
    );

    const generatedDate = new Date().toLocaleDateString("en-ZA", {
        day: "2-digit",
        month: "long",
        year: "numeric"
    });

    const printWindow = window.open("", "_blank", "width=1400,height=900");

    if (!printWindow) {
        window.alert("Please allow pop-ups for BowlPoint to export the fixtures.");
        return;
    }

    printWindow.document.open();
    printWindow.document.write(`
        <!doctype html>
        <html>
        <head>
            <meta charset="UTF-8" />
            <title>${title} - Fixtures</title>
            <style>
                @page {
                    size: A4 landscape;
                    margin: 8mm;
                }

                * { box-sizing: border-box; }

                html, body {
                    margin: 0;
                    padding: 0;
                    background: #fff;
                    color: #111;
                    font-family: Arial, Helvetica, sans-serif;
                }

                body { font-size: 9px; }

                .page-header {
                    display: grid;
                    grid-template-columns: auto 1fr auto;
                    align-items: center;
                    gap: 6px;
                    margin-bottom: 8px;
                }

                .title-box {
                    display: inline-block;
                    padding: 5px 9px;
                    border: 1.5px solid #111;
                    background: #e000c8;
                    font-size: 19px;
                    font-weight: 800;
                    line-height: 1;
                    white-space: nowrap;
                }

                .host-name {
                    font-size: 14px;
                    font-weight: 800;
                    padding-left: 2px;
                }

                .document-info {
                    text-align: right;
                    font-size: 8px;
                    line-height: 1.35;
                }

                .document-info strong {
                    font-size: 10px;
                }

                .section-block {
                    margin-bottom: 7px;
                    page-break-inside: avoid;
                }

                .fixture-table,
                .playoff-table {
                    width: 100%;
                    border-collapse: collapse;
                    table-layout: fixed;
                    border: 1.2px solid #111;
                }

                .fixture-table th,
                .fixture-table td,
                .playoff-table th,
                .playoff-table td {
                    border: 1px solid #111;
                    vertical-align: middle;
                }

                .fixture-table thead th {
                    background: #c6c6c6;
                    text-align: center;
                    font-weight: 400;
                }

                .section-title {
                    width: 40%;
                    background: #ffc000 !important;
                    text-align: left !important;
                    padding: 5px 7px;
                    font-size: 12px;
                    font-weight: 800 !important;
                }

                .date-group {
                    height: 23px;
                    font-size: 10px;
                    font-weight: 800 !important;
                }

                .round-group {
                    height: 18px;
                    font-size: 9px;
                }

                .time-cell {
                    height: 18px;
                    color: #e00000;
                    font-weight: 800 !important;
                }

                .column-header th {
                    height: 20px;
                    background: #c6c6c6 !important;
                    font-size: 8px;
                    font-weight: 700 !important;
                }

                .num-head, .num-cell { width: 4%; text-align: center; }
                .name-head, .name-cell { width: 31%; text-align: left; }
                .club-head, .club-cell { width: 5%; text-align: center; }
                .opp-col, .opp-cell { width: 7%; text-align: center; }
                .rink-col, .rink-cell { width: 7%; text-align: center; }

                .fixture-table tbody td {
                    min-height: 21px;
                    height: 21px;
                    padding: 2px 4px;
                    font-size: 8.5px;
                }

                .name-cell {
                    overflow-wrap: anywhere;
                }

                .team-name {
                    font-weight: 400;
                }

                .players {
                    font-size: 7.3px;
                    color: #333;
                }

                .club-cell {
                    font-size: 8px !important;
                    font-weight: 400;
                }

                .playoff-block {
                    margin-top: 8px;
                    page-break-inside: avoid;
                }

                .playoff-block h2 {
                    margin: 0 0 5px;
                    padding: 4px 6px;
                    background: #ffc000;
                    border: 1px solid #111;
                    font-size: 11px;
                }

                .playoff-round {
                    margin-bottom: 6px;
                    page-break-inside: avoid;
                }

                .playoff-round-header {
                    display: flex;
                    justify-content: space-between;
                    padding: 4px 6px;
                    background: #c6c6c6;
                    border: 1px solid #111;
                    border-bottom: 0;
                    font-size: 8.5px;
                }

                .playoff-table th {
                    background: #ddd;
                    font-size: 8px;
                    padding: 3px;
                }

                .playoff-table td {
                    font-size: 8.5px;
                    padding: 3px 5px;
                }

                .playoff-table th:first-child,
                .playoff-table td:first-child { width: 7%; text-align: center; }
                .playoff-table th:nth-child(3),
                .playoff-table td:nth-child(3) { width: 5%; text-align: center; }
                .playoff-table th:last-child,
                .playoff-table td:last-child { width: 9%; text-align: center; }

                .footer {
                    display: flex;
                    justify-content: space-between;
                    margin-top: 5px;
                    font-size: 7px;
                }

                @media print {
                    .section-block,
                    .playoff-block,
                    .playoff-round { break-inside: avoid; }
                }
            </style>
        </head>
        <body>
            <div class="page-header">
                <div class="title-box">${title}</div>
                <div class="host-name">${venue}</div>
                <div class="document-info">
                    <strong>Playing Fixtures</strong><br />
                    Generated: ${escapeHtml(generatedDate)}
                </div>
            </div>

            ${content}

            <div class="footer">
                <span>${title} - Playing Fixtures</span>
                <span>Page <span class="page-number"></span></span>
            </div>

            <script>
                window.onload = function () {
                    window.focus();
                    window.print();
                };
            </script>
        </body>
        </html>
    `);
    printWindow.document.close();
}
