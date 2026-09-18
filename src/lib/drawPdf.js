/*
 * Printable draw export for Quick Competition.
 *
 * Uses the browser's native print dialog so no PDF library or extra
 * dependency is required. The user can choose "Save as PDF".
 */

function escapeHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function getTeamNumberMap(teams) {
    return new Map(
        teams
            .filter(team => !team?.isBye)
            .map((team, index) => [team.id, index + 1])
    );
}

function getOpponentNumber(round, teamId, teamNumberMap) {
    if (round?.byeTeam?.id === teamId) {
        return "BYE";
    }

    const match = round?.matches?.find(
        item =>
            item?.teamA?.id === teamId ||
            item?.teamB?.id === teamId
    );

    if (!match) {
        return "—";
    }

    const opponent =
        match.teamA?.id === teamId
            ? match.teamB
            : match.teamA;

    if (opponent?.isBye) {
        return "BYE";
    }

    return teamNumberMap.get(opponent?.id) ?? "—";
}

function getSectionName(team) {
    return (
        team?.section ??
        team?.sectionName ??
        team?.section_name ??
        null
    );
}

function buildSections(teams) {
    const sections = new Map();

    teams
        .filter(team => !team?.isBye)
        .forEach(team => {
            const section = getSectionName(team) || "Section 1";

            if (!sections.has(section)) {
                sections.set(section, []);
            }

            sections.get(section).push(team);
        });

    return sections;
}

function buildRows(teams, rounds, teamNumberMap) {
    return teams
        .filter(team => !team?.isBye)
        .map(team => {
            const number = teamNumberMap.get(team.id) ?? "";
            const name = escapeHtml(team.name || "");
            const opponents = rounds.map(round =>
                getOpponentNumber(round, team.id, teamNumberMap)
            );

            return `
                <tr>
                    <td class="num">${number}</td>
                    <td class="name">${name}</td>
                    ${opponents
                        .map(opponent => `<td class="opp">${escapeHtml(opponent)}</td>`)
                        .join("")}
                </tr>
            `;
        })
        .join("");
}

function buildSectionHtml(sectionName, teams, rounds, teamNumberMap) {
    return `
        <tbody class="draw-section">
            <tr class="section-row">
                <th colspan="${2 + rounds.length}">${escapeHtml(sectionName)}</th>
            </tr>
            <tr class="column-row">
                <th class="num">Num</th>
                <th class="name">Name</th>
                ${rounds
                    .map(round => `<th class="opp">${rounds.length >= 8 ? "R" : "Round "}${escapeHtml(round.number)}</th>`)
                    .join("")}
            </tr>
            ${buildRows(teams, rounds, teamNumberMap)}
        </tbody>
    `;
}

export function exportQuickCompetitionDrawPdf(tournament) {
    if (!tournament) {
        return;
    }

    const teams = (tournament.teams || []).filter(team => !team?.isBye);
    const rounds = tournament.rounds || [];

    if (teams.length === 0 || rounds.length === 0) {
        window.alert("There is no draw to export yet.");
        return;
    }

    const teamNumberMap = getTeamNumberMap(teams);
    const sections = buildSections(teams);

    const sectionHtml = Array.from(sections.entries())
        .map(([sectionName, sectionTeams]) =>
            buildSectionHtml(
                sectionName,
                sectionTeams,
                rounds,
                teamNumberMap
            )
        )
        .join("");

    // Keep the reference layout close to the supplied example while
    // automatically switching to landscape when the draw has many rounds.
    const roundCount = rounds.length;
    const orientation = roundCount >= 6 ? "landscape" : "portrait";
    const compactClass = roundCount >= 7 ? " compact" : roundCount === 6 ? " medium" : "";
    
    const title = escapeHtml(
        tournament.name || "BowlPoint Quick Competition"
    );

    const generatedDate = new Date().toLocaleDateString(undefined, {
        day: "2-digit",
        month: "long",
        year: "numeric"
    });

    const printWindow = window.open("", "_blank", "width=1100,height=800");

    if (!printWindow) {
        window.alert("Please allow pop-ups for BowlPoint to export the draw.");
        return;
    }

    printWindow.document.open();
    printWindow.document.write(`
        <!doctype html>
        <html>
        <head>
            <meta charset="UTF-8" />
            <title>${title} - Draw</title>
            <style>
                @page {
                    size: A4 ${orientation};
                    margin: 9mm;
                }

                * {
                    box-sizing: border-box;
                }

                html,
                body {
                    margin: 0;
                    padding: 0;
                    background: #ffffff;
                    color: #111111;
                    font-family: Arial, Helvetica, sans-serif;
                }

                body {
                    font-size: 10px;
                }

                .page {
                    width: 100%;
                }

                .header {
                    text-align: center;
                    margin-bottom: 8px;
                }

                .header h1 {
                    margin: 0 0 2px;
                    font-size: 18px;
                    font-weight: 700;
                    line-height: 1.15;
                }

                .header .subtitle {
                    font-size: 9px;
                    color: #444444;
                }

                .draw-table {
                    width: 100%;
                    border-collapse: collapse;
                    table-layout: fixed;
                    border: 2px solid #111111;
                }

                .draw-table th,
                .draw-table td {
                    border: 1px solid #111111;
                    padding: 2px 3px;
                    min-height: 20px;
                    height: 20px;
                    vertical-align: middle;
                    line-height: 1.15;
                }

                .section-row th {
                    background: #c6c6c6;
                    font-size: 10.5px;
                    text-align: center;
                    font-weight: 700;
                    height: 20px;
                    padding: 2px 3px;
                }

                .column-row th {
                    background: #dddddd;
                    font-size: 9px;
                    font-weight: 700;
                    text-align: center;
                    height: 20px;
                    white-space: nowrap;
                }

                /* The name column gets most of the available width so long
                   team names wrap naturally instead of being clipped. */
                .num {
                    width: 7%;
                    text-align: center;
                }

                .name {
                    width: 43%;
                    text-align: left;
                }

                .opp {
                    width: ${rounds.length ? Math.max(6, Math.min(10, 50 / rounds.length)) : 50}%;
                    text-align: center;
                    font-weight: 600;
                    white-space: nowrap;
                }

                .draw-table td.name {
                    font-weight: 500;
                    overflow-wrap: anywhere;
                    word-break: normal;
                }

                .medium .draw-table th,
                .medium .draw-table td {
                    padding: 2px;
                    font-size: 8.5px;
                }

                .medium .section-row th {
                    font-size: 10px;
                }

                .compact .draw-table th,
                .compact .draw-table td {
                    padding: 1.5px 2px;
                    font-size: 7.5px;
                }

                .compact .section-row th {
                    font-size: 9px;
                }

                .compact .column-row th {
                    font-size: 7.5px;
                }

                .compact .num {
                    width: 6%;
                }

                .compact .name {
                    width: 44%;
                }

                .footer {
                    margin-top: 5px;
                    text-align: right;
                    color: #666666;
                    font-size: 7px;
                }

                @media print {
                    .no-print {
                        display: none !important;
                    }

                    .draw-table {
                        break-inside: auto;
                    }

                    .draw-section {
                        break-inside: auto;
                    }

                    .section-row,
                    .column-row {
                        break-inside: avoid;
                        break-after: avoid;
                    }

                    tr {
                        break-inside: avoid;
                    }
                }
            </style>
        </head>
        <body>
            <div class="page${compactClass}">
                <div class="header">
                    <h1>${title}</h1>
                    <div class="subtitle">Draw • ${teams.length} teams • ${rounds.length} rounds</div>
                </div>

                <table class="draw-table">
                    ${sectionHtml}
                </table>

                <div class="footer">
                    Generated ${escapeHtml(generatedDate)} • BowlPoint
                </div>
            </div>

            <script>
                window.addEventListener("load", function () {
                    setTimeout(function () {
                        window.print();
                    }, 250);
                });
            </script>
        </body>
        </html>
    `);

    printWindow.document.close();
}
