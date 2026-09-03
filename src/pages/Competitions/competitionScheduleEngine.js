/**
 * BowlPoint schedule proposal engine.
 *
 * This is a proposal-only engine. It does not write dates or venues.
 * Rules supplied by the competition secretary:
 *   Weekend: maximum 3 rounds Saturday + 3 rounds Sunday.
 *   If the complete playoff stage does not fit in the remaining Sunday
 *   capacity, move the whole playoff stage to the next available Saturday.
 *   Midweek: one round per playing day.
 */

function isSectionalRound(round) {
    const name = String(round.round_name || "").toLowerCase();
    return name.includes("sectional") || (!name.includes("quarter") && !name.includes("semi") && name !== "final");
}

function isPlayoffRound(round) {
    return !isSectionalRound(round);
}

function matchCountForRound(round, matches) {
    return matches.filter(match => match.round_id === round.id).length;
}

export function buildCompetitionScheduleProposal({ competitionType = "weekend", rounds = [], matches = [] }) {
    const orderedRounds = [...rounds].sort((a, b) => a.round_number - b.round_number);
    const sectional = orderedRounds.filter(isSectionalRound);
    const playoffs = orderedRounds.filter(isPlayoffRound);

    if (!orderedRounds.length) {
        return {
            competitionType,
            sectionalRounds: 0,
            playoffRounds: 0,
            playingDaysRequired: 0,
            requiresAdditionalWeekend: false,
            days: []
        };
    }

    const countMatches = round => matchCountForRound(round, matches);

    if (competitionType === "midweek") {
        return {
            competitionType,
            sectionalRounds: sectional.length,
            playoffRounds: playoffs.length,
            playingDaysRequired: orderedRounds.length,
            requiresAdditionalWeekend: orderedRounds.length > 7,
            days: orderedRounds.map((round, index) => ({
                key: `midweek-${index + 1}`,
                label: `Playing Day ${index + 1}`,
                typeLabel: "Midweek — one round",
                rounds: [{
                    roundNumber: round.round_number,
                    roundName: round.round_name,
                    matchCount: countMatches(round)
                }]
            }))
        };
    }

    const days = [];
    let weekendNumber = 1;
    let sectionalIndex = 0;

    // Put sectional rounds into weekend blocks: 3 Saturday, then up to 3 Sunday.
    while (sectionalIndex < sectional.length) {
        const saturdayRounds = sectional.slice(sectionalIndex, sectionalIndex + 3);
        sectionalIndex += saturdayRounds.length;
        days.push({
            key: `weekend-${weekendNumber}-sat`,
            label: `Weekend ${weekendNumber} — Saturday`,
            typeLabel: "Maximum 3 rounds",
            rounds: saturdayRounds.map(round => ({
                roundNumber: round.round_number,
                roundName: round.round_name,
                matchCount: countMatches(round)
            }))
        });

        const sundayRounds = sectional.slice(sectionalIndex, sectionalIndex + 3);
        sectionalIndex += sundayRounds.length;
        days.push({
            key: `weekend-${weekendNumber}-sun`,
            label: `Weekend ${weekendNumber} — Sunday`,
            typeLabel: "Maximum 3 rounds",
            rounds: sundayRounds.map(round => ({
                roundNumber: round.round_number,
                roundName: round.round_name,
                matchCount: countMatches(round)
            }))
        });

        weekendNumber += 1;
    }

    // If playoffs fit into unused Sunday capacity on the final sectional weekend,
    // keep them there. Otherwise move the complete playoff stage to the next Saturday.
    if (playoffs.length) {
        const finalSunday = days[days.length - 1];
        const freeSundaySlots = Math.max(0, 3 - finalSunday.rounds.length);

        if (playoffs.length <= freeSundaySlots) {
            finalSunday.rounds.push(...playoffs.map(round => ({
                roundNumber: round.round_number,
                roundName: round.round_name,
                matchCount: countMatches(round)
            })));
        } else {
            days.push({
                key: `weekend-${weekendNumber}-sat-playoffs`,
                label: `Weekend ${weekendNumber} — Saturday`,
                typeLabel: "Playoffs",
                rounds: playoffs.map(round => ({
                    roundNumber: round.round_number,
                    roundName: round.round_name,
                    matchCount: countMatches(round)
                }))
            });
        }
    }

    return {
        competitionType,
        sectionalRounds: sectional.length,
        playoffRounds: playoffs.length,
        playingDaysRequired: days.length,
        requiresAdditionalWeekend: days.some(day => day.label.includes("Weekend 2") || day.label.includes("Weekend 3")),
        days
    };
}
