/**
 * BowlPoint schedule proposal engine.
 *
 * This is a proposal-only engine. It does not write dates or venues.
 * Rules supplied by the competition secretary:
 *   Midweek – One Day: one round per playing day, potentially over many weeks.
 *   Weekday: weekday competition, maximum 3 rounds per playing day.
 *   Weekend: maximum 3 rounds Saturday + 3 rounds Sunday.
 *   If the complete playoff stage does not fit in the remaining Sunday
 *   capacity, move the whole playoff stage to the next available Saturday.
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
            requiresAdditionalWeekend: false,
            days: orderedRounds.map((round, index) => ({
                key: `midweek-${index + 1}`,
                label: `Playing Day ${index + 1}`,
                typeLabel: "Midweek – One Day — 1 round",
                rounds: [{
                    roundNumber: round.round_number,
                    roundName: round.round_name,
                    matchCount: countMatches(round)
                }]
            }))
        };
    }

    if (competitionType === "weekday" || competitionType === "week") {
        const days = [];

        // Week competitions may use any weekday and can play up to 3 rounds
        // on each playing day. The secretary assigns the actual dates later.
        for (let index = 0; index < orderedRounds.length; index += 3) {
            const dayRounds = orderedRounds.slice(index, index + 3);

            days.push({
                key: `weekday-${days.length + 1}`,
                label: `Playing Day ${days.length + 1}`,
                typeLabel: "Weekday — up to 3 rounds",
                rounds: dayRounds.map(round => ({
                    roundNumber: round.round_number,
                    roundName: round.round_name,
                    matchCount: countMatches(round)
                }))
            });
        }

        return {
            competitionType,
            sectionalRounds: sectional.length,
            playoffRounds: playoffs.length,
            playingDaysRequired: days.length,
            requiresAdditionalWeekend: false,
            days
        };
    }

    const days = [];
    let weekendNumber = 1;
    let sectionalIndex = 0;

    // Put sectional rounds into weekend blocks: up to 3 on Saturday, then
    // up to 3 on Sunday only when Sunday actually has rounds scheduled.
    // A tournament that fits entirely on Saturday must not create an empty
    // Sunday playing day or require the secretary to assign a Sunday date.
    while (sectionalIndex < sectional.length) {
        const saturdayRounds = sectional.slice(sectionalIndex, sectionalIndex + 3);
        sectionalIndex += saturdayRounds.length;

        if (saturdayRounds.length) {
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
        }

        const sundayRounds = sectional.slice(sectionalIndex, sectionalIndex + 3);
        sectionalIndex += sundayRounds.length;

        if (sundayRounds.length) {
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
        }

        weekendNumber += 1;
    }

    // If playoffs fit into unused Sunday capacity on the final sectional weekend,
    // keep them there. If the sectional stage used only Saturday, create Sunday
    // now because the playoff rounds genuinely require it. Otherwise move the
    // complete playoff stage to the next Saturday.
    if (playoffs.length) {
        const finalWeekendNumber = Math.max(1, weekendNumber - 1);
        let finalSunday = days.find(day =>
            day.key === `weekend-${finalWeekendNumber}-sun`
        );

        if (!finalSunday) {
            finalSunday = {
                key: `weekend-${finalWeekendNumber}-sun`,
                label: `Weekend ${finalWeekendNumber} — Sunday`,
                typeLabel: "Maximum 3 rounds",
                rounds: []
            };
            days.push(finalSunday);
        }

        const freeSundaySlots = Math.max(0, 3 - finalSunday.rounds.length);

        if (playoffs.length <= freeSundaySlots) {
            finalSunday.rounds.push(...playoffs.map(round => ({
                roundNumber: round.round_number,
                roundName: round.round_name,
                matchCount: countMatches(round)
            })));
        } else {
            // Remove the empty Sunday we created above if the complete playoff
            // stage cannot fit there; the whole playoff stage belongs on the
            // next Saturday instead.
            if (!finalSunday.rounds.length) {
                days.splice(days.indexOf(finalSunday), 1);
            }

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
