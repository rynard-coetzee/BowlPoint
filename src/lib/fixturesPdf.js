/*
 * Printable fixture export for Full Competition.
 *
 * Layout is based on the club's printed fixture sheet:
 *   Num | Team Name (players + positions) | Club | R1 Opp/Rink | R2 Opp/Rink ...
 *
 * Venue and rink details are populated from saved facility allocations when available.
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
    const sections = [...(confirmedDraw.sections || [])]
        .sort((a, b) => (a.section_number || 0) - (b.section_number || 0));

    if (!rounds.length || !matches.length) {
        window.alert("There are no fixtures to export yet.");
        return;
    }

    const teamId = team => team?.id;
    // Team numbers in the database are competition-wide. For printed opposition
    // labels, number teams independently within each club (e.g. SBC1, MBC2).
    const allTeams = sections.flatMap(section => section.teams || []);
    const clubTeamNumbers = new Map();
    const teamsByClub = new Map();
    allTeams.forEach(team => {
        const clubKey = team.club_id || team.clubs?.id || getTeamClub(team) || "unknown";
        if (!teamsByClub.has(clubKey)) teamsByClub.set(clubKey, []);
        teamsByClub.get(clubKey).push(team);
    });
    teamsByClub.forEach(clubTeams => {
        clubTeams.sort((a, b) =>
            (Number(a.team_number) || 0) - (Number(b.team_number) || 0) ||
            String(a.id).localeCompare(String(b.id))
        );
        clubTeams.forEach((team, index) => clubTeamNumbers.set(team.id, index + 1));
    });
    const teamLabel = team => {
        if (!team) return "BYE";
        const club = getTeamClub(team);
        const localNumber = clubTeamNumbers.get(team.id);
        return club && localNumber ? `${club}${localNumber}` : (team.team_name || team.name || "Team");
    };
    const matchForTeamRound = (team, round, section) => matches.find(match =>
        match.round_id === round.id &&
        (match.section_id === section.id || match.section?.id === section.id) &&
        (match.team_a_id === team.id || match.team_b_id === team.id)
    );
    const getRinkLabel = match => {
        const booking = match?.facility_booking || match?.facilityBooking || match?.booking || {};
        const rink = booking.rink || booking.green_rinks || match?.rink || match?.green_rink || {};
        const green = booking.green || match?.green || match?.club_green || {};
        const rinkLabel = rink.label || rink.name || booking.rink_label || match?.rink_label || "";
        const greenLabel = green.name || booking.green_label || match?.green_name || "";
        const club = green.clubs || booking.club || {};
        const clubLabel = club.short_name || club.name || booking.club_short_name || "";
        const label = [clubLabel, greenLabel, rinkLabel].filter(Boolean).join(" / ");
        return label || "—";
    };
    const getSchedule = (round, section = null) => {
        const day = playingDays.find(item => item.id === round.competition_day_id) || round.competition_days || {};
        const date = day.playing_date
            ? new Date(`${day.playing_date}T00:00:00`).toLocaleDateString("en-ZA", { day: "2-digit", month: "2-digit", year: "numeric" })
            : "";
        const session = day.name || day.day_name || "";
        // Facility allocation is the authoritative venue once greens have been
        // assigned. A round can span several clubs, so list all allocated host clubs.
        const allocatedClubs = [...new Set(matches
            .filter(match => match.round_id === round.id && (!section || match.section_id === section.id || match.section?.id === section.id))
            .map(match => {
                const booking = match.facility_booking || match.facilityBooking || match.booking || {};
                const green = booking.green || match.green || match.club_green || {};
                return green.clubs?.short_name || green.clubs?.name || "";
            })
            .filter(Boolean))];
        const venue = allocatedClubs.length
            ? allocatedClubs.join(", ")
            : (day.clubs?.short_name || day.clubs?.name || day.venue_name || "");
        return { date, session, venue };
    };

    const sectionHtml = sections.map(section => {
        const sectionRounds = rounds.filter(round => matches.some(match =>
            match.round_id === round.id &&
            (match.section_id === section.id || match.section?.id === section.id)
        ));
        const sectionTeams = [...(section.teams || [])].sort((a, b) =>
            (a.team_number || 0) - (b.team_number || 0)
        );
        if (!sectionTeams.length) return "";

        const scheduleRows = sectionRounds.map(round => {
            const schedule = getSchedule(round, section);
            return `<tr>
                <td>R${escapeHtml(round.round_number)}</td>
                <td>${escapeHtml(schedule.date || "Date TBC")}${schedule.session ? ` ${escapeHtml(schedule.session)}` : ""}</td>
                <td>${escapeHtml(schedule.venue || "Venue TBC")}</td>
            </tr>`;
        }).join("");

        const teamCards = sectionTeams.map((team, teamIndex) => {
            const gameRows = sectionRounds.map(round => {
                const match = matchForTeamRound(team, round, section);
                if (!match) return `<tr><td>${escapeHtml(round.round_number)}</td><td>—</td><td>—</td>`;
                const isA = match.team_a_id === team.id;
                const opponentId = isA ? match.team_b_id : match.team_a_id;
                const opponent = isA ? match.teamB : match.teamA;
                const isBye = !opponentId || !opponent;
                return `<tr>
                    <td>${escapeHtml(round.round_number)}</td>
                    <td>${escapeHtml(isBye ? "BYE" : teamLabel(opponent))}</td>
                    <td>${escapeHtml(isBye ? "—" : getRinkLabel(match))}</td>
                </tr>`;
            }).join("");
            const members = getTeamMembers(team);
            const club = getTeamClub(team);
            const printedTeamName = team.team_name || team.name || teamLabel(team);
            const teamTitle = members.length
                ? `${teamIndex + 1}. ${printedTeamName} — ${members.join(" / ")}`
                : `${teamIndex + 1}. ${printedTeamName}`;
            return `<article class="team-card">
                <div class="team-title">${escapeHtml(teamTitle)}</div>
                <div class="team-club">${escapeHtml(club)}</div>
                <table class="games">
                    <thead><tr><th>Rnd</th><th>Opposition</th><th>Rink</th></tr></thead>
                    <tbody>${gameRows}</tbody>
                    <tfoot><tr><td colspan="2">Total</td><td>—</td></tr><tr><td colspan="2">Aggregate</td><td>0</td></tr></tfoot>
                </table>
            </article>`;
        }).join("");

        return `<section class="section">
            <div class="section-heading">${escapeHtml(section.section_name || `Section ${section.section_number}`)}</div>
            <div class="schedule">
                <div class="schedule-title">Schedule</div>
                <table><thead><tr><th>Rnd</th><th>Date / Session</th><th>Venue</th></tr></thead><tbody>${scheduleRows}</tbody></table>
            </div>
            <div class="team-grid">${teamCards}</div>
        </section>`;
    }).join("");

    const title = escapeHtml(competition.name || "BowlPoint Competition");
    const generatedDate = new Date().toLocaleDateString("en-ZA", { day: "2-digit", month: "long", year: "numeric" });
    const printWindow = window.open("", "_blank", "width=1400,height=900");
    if (!printWindow) {
        window.alert("Please allow pop-ups for BowlPoint to generate the draw PDF.");
        return;
    }

    printWindow.document.write(`<!doctype html>
<html><head><meta charset="utf-8"><title>${title} - Draw</title>
<style>
@page { size: A4 landscape; margin: 8mm; }
* { box-sizing: border-box; }
body { font-family: Arial, Helvetica, sans-serif; color:#111; margin:0; font-size:10px; }
header { text-align:center; margin-bottom:12px; }
header h1 { font-size:23px; margin:0 0 3px; font-weight:800; }
header h2 { font-size:20px; margin:0 0 6px; }
header .subtitle { border:1px solid #111; padding:6px; font-size:11px; }
.section { margin-bottom:14px; break-inside:avoid; }
.section-heading { font-size:17px; font-weight:800; margin:0 0 5px; }
.schedule { display:grid; grid-template-columns:100px 1fr; border:1px solid #222; margin-bottom:6px; min-height:52px; }
.schedule-title { font-size:12px; font-weight:700; text-align:center; align-self:center; text-decoration:underline; }
.schedule table { width:100%; border-collapse:collapse; }
.schedule th { text-decoration:underline; font-weight:400; }
.schedule th,.schedule td { text-align:center; padding:3px 5px; }
.team-grid { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:7px; align-items:start; }
.team-card { min-width:0; break-inside:avoid; }
.team-title { border:1px solid #111; min-height:31px; padding:4px; text-align:center; font-size:10px; line-height:1.2; overflow-wrap:anywhere; }
.team-club { text-align:center; min-height:0; font-size:8px; padding:2px; }
.games { width:100%; border-collapse:collapse; table-layout:fixed; }
.games th,.games td { border:1px solid #111; text-align:center; padding:3px 2px; height:20px; overflow-wrap:anywhere; }
.games th { font-weight:400; background:#eee; }
.games th:first-child,.games td:first-child { width:13%; }
.games th:nth-child(2),.games td:nth-child(2) { width:52%; }
.games th:last-child,.games td:last-child { width:35%; }
.games tfoot td { font-weight:400; }
.games tfoot tr:first-child td:last-child { background:#f00; }
@media print { .section { break-inside:avoid; } }
</style></head><body>
<header><h1>DISTRICT COMPETITIONS</h1><h2>${title}</h2><div class="subtitle">Competition Draw and Playing Schedule</div></header>
${sectionHtml || `<p>No sectional team blocks are available for this draw.</p>`}
<footer style="margin-top:8px;font-size:8px;display:flex;justify-content:space-between"><span>${title} · Draw</span><span>Generated ${escapeHtml(generatedDate)}</span></footer>
<script>window.onload=function(){window.focus();window.print();};</script>
</body></html>`);
    printWindow.document.close();
}
