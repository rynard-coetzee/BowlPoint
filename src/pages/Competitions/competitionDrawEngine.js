/**
 * BowlPoint Competition Draw Engine v2
 *
 * Proposal engine only. It does not write to Supabase.
 *
 * Rules captured from the competition-secretary feedback:
 * - 3-5 teams: single round robin, one overall group (no sectional split/playoffs).
 * - 6-11 teams: 2 sections, one winner per section, final.
 * - 12-24 teams: 4 sections, one winner per section, semi-finals + final.
 * - 25-32 teams: 8 sections, one winner per section, quarter-finals + semi-finals + final.
 * - Multiple-section mode: minimum 3 and maximum 6 teams per section.
 * - Single-group mode: all participants remain in one overall group; section limits do not apply.
 * - Odd section sizes are allowed; a bye counts as a round for scheduling.
 * - Teams from the same club should be separated where possible.
 * - No repeat opponents in the sectional stage.
 * - Playoff pairings are fixed: odd sections together and even sections together.
 * - Section winner tie-break: Points, then total Aggregate.
 * - Aggregate = total shots for - total shots against.
 *
 * Weekend scheduling preference:
 * - Normally 3 sectional rounds Saturday and 2 sectional rounds Sunday.
 * - If the sectional stage finishes earlier, playoffs may use the remaining Sunday capacity.
 * - A semi-final/final can be scheduled separately, but remains part of the tournament's required days.
 * - If the full proposal cannot fit the preferred weekend pattern, the UI reports the extra rounds/days.
 *
 * Midweek scheduling:
 * - One round per playing day.
 */

const MIN_SECTION_SIZE = 3;
const MAX_SECTION_SIZE = 6;

function clone(value) {
    return typeof structuredClone === "function"
        ? structuredClone(value)
        : JSON.parse(JSON.stringify(value));
}

function assertTeams(teams) {
    if (!Array.isArray(teams)) {
        throw new Error("teams must be an array.");
    }

    const ids = new Set();

    for (const team of teams) {
        if (!team || !team.id || !team.name) {
            throw new Error("Every team must have an id and name.");
        }

        if (ids.has(team.id)) {
            throw new Error(`Duplicate team id: ${team.id}`);
        }

        ids.add(team.id);
    }
}

function getSectionCount(teamCount) {
    if (teamCount <= 5) return 1;
    if (teamCount <= 11) return 2;
    if (teamCount <= 24) return 4;
    if (teamCount <= 32) return 8;

    throw new Error(
        "BowlPoint Draw Engine currently supports a maximum of 32 teams."
    );
}

function getSectionSizes(teamCount, sectionCount) {
    if (sectionCount === 1) return [teamCount];

    const base = Math.floor(teamCount / sectionCount);
    const remainder = teamCount % sectionCount;

    const sizes = Array.from(
        { length: sectionCount },
        (_, index) => base + (index < remainder ? 1 : 0)
    );

    if (
        sizes.some(
            size =>
                size < MIN_SECTION_SIZE ||
                size > MAX_SECTION_SIZE
        )
    ) {
        throw new Error(
            `Cannot distribute ${teamCount} teams across ${sectionCount} sections while keeping every section between ${MIN_SECTION_SIZE} and ${MAX_SECTION_SIZE} teams.`
        );
    }

    return sizes;
}

function roundCountForSection(teamCount) {
    if (teamCount <= 1) return 0;
    return teamCount % 2 === 0 ? teamCount - 1 : teamCount;
}

function playoffStagesForSectionCount(sectionCount) {
    switch (sectionCount) {
        case 1:
            return [];
        case 2:
            return ["final"];
        case 4:
            return ["semi_final", "final"];
        case 8:
            return ["quarter_final", "semi_final", "final"];
        default:
            throw new Error(
                `Unsupported playoff section count: ${sectionCount}`
            );
    }
}

function getSectionalRoundCount(sectionSizes) {
    return Math.max(...sectionSizes.map(roundCountForSection));
}

function getScheduleSummary({
    competitionType,
    sectionalRounds,
    playoffStages
}) {
    const playoffRounds = playoffStages.length;
    const totalRounds = sectionalRounds + playoffRounds;

    if (competitionType === "midweek") {
        return {
            competitionType,
            sectionalPlayingDays: sectionalRounds,
            playoffPlayingDays: playoffRounds,
            minimumPlayingDays: totalRounds,
            preferredPattern: "1 round per midweek playing day",
            normalSchedule: `${sectionalRounds} sectional day(s) + ${playoffRounds} playoff day(s).`,
            weekendCount: null,
            overflow: false,
            notes: [
                "A bye still consumes its round/day.",
                "Playoff rounds are included in the required competition days."
            ]
        };
    }

    // Weekend tournaments normally use 3 sectional rounds Saturday and
    // 2 sectional rounds Sunday. The remaining playoff rounds can then be
    // played on Sunday after the sectional stage. This is why, for example,
    // a 24-team 4-section competition (5 sectional + 2 playoff rounds) can
    // still form one weekend competition.
    const saturdaySectionalRounds = Math.min(sectionalRounds, 3);
    const sundaySectionalRounds = Math.max(0, sectionalRounds - saturdaySectionalRounds);
    const fitsPreferredWeekend = sundaySectionalRounds <= 2;

    return {
        competitionType,
        sectionalPlayingDays: sectionalRounds,
        playoffPlayingDays: playoffRounds,
        minimumPlayingDays: totalRounds,
        preferredPattern: "Up to 3 sectional rounds Saturday + up to 2 sectional rounds Sunday, then playoffs on Sunday where required.",
        normalSchedule: fitsPreferredWeekend
            ? "Fits the preferred weekend tournament pattern."
            : "Sectional stage exceeds the preferred 3 Saturday + 2 Sunday pattern and may require another weekend.",
        weekendCount: fitsPreferredWeekend ? 1 : 1 + Math.ceil((sundaySectionalRounds - 2) / 5),
        saturdaySectionalRounds,
        sundaySectionalRounds,
        playoffRoundsOnSunday: playoffRounds,
        extraSectionalRounds: Math.max(0, sundaySectionalRounds - 2),
        overflow: !fitsPreferredWeekend,
        notes: [
            "A bye consumes a round for scheduling purposes.",
            "Semi-finals/final can be played after the sectional rounds and remain part of the same tournament schedule."
        ]
    };
}

function createRoundRobinRounds(teams) {
    const working = [...teams];

    if (working.length % 2 !== 0) {
        working.push({
            id: `bye-${working.length}`,
            name: "BYE",
            isBye: true
        });
    }

    const rounds = [];
    const totalRounds = working.length - 1;

    for (let roundIndex = 0; roundIndex < totalRounds; roundIndex++) {
        const matches = [];
        let roundBye = null;

        for (let i = 0; i < working.length / 2; i++) {
            const teamA = working[i];
            const teamB = working[working.length - 1 - i];

            if (teamA.isBye || teamB.isBye) {
                roundBye = teamA.isBye ? teamB : teamA;
                continue;
            }

            matches.push({
                id: `match-r${roundIndex + 1}-${i + 1}`,
                matchNumber: i + 1,
                teamAId: teamA.id,
                teamBId: teamB.id,
                teamA,
                teamB,
                type: "round_robin",
                completed: false
            });
        }

        rounds.push({
            number: roundIndex + 1,
            type: "round_robin",
            matches,
            byeTeam: roundBye
        });

        working.splice(1, 0, working.pop());
    }

    return rounds;
}

function validateRoundRobin(sectionTeams, rounds) {
    const expectedOpponentCount = sectionTeams.length - 1;
    const opponents = new Map(
        sectionTeams.map(team => [team.id, new Set()])
    );

    for (const round of rounds) {
        const seenThisRound = new Set();

        for (const match of round.matches) {
            if (seenThisRound.has(match.teamAId) || seenThisRound.has(match.teamBId)) {
                throw new Error(
                    `A team appears more than once in section round ${round.number}.`
                );
            }

            seenThisRound.add(match.teamAId);
            seenThisRound.add(match.teamBId);

            if (opponents.get(match.teamAId).has(match.teamBId)) {
                throw new Error(
                    `Repeat opponent detected: ${match.teamAId} vs ${match.teamBId}.`
                );
            }

            opponents.get(match.teamAId).add(match.teamBId);
            opponents.get(match.teamBId).add(match.teamAId);
        }
    }

    for (const team of sectionTeams) {
        const count = opponents.get(team.id).size;
        if (count !== expectedOpponentCount) {
            throw new Error(
                `Team ${team.name} has ${count} opponents; expected ${expectedOpponentCount}.`
            );
        }
    }

    return true;
}

function countSameClubPairs(sections) {
    let pairs = 0;

    for (const section of sections) {
        const clubCounts = new Map();

        for (const team of section.teams) {
            const clubId = team.clubId ?? team.clubName ?? "__NO_CLUB__";
            clubCounts.set(clubId, (clubCounts.get(clubId) || 0) + 1);
        }

        for (const count of clubCounts.values()) {
            pairs += (count * (count - 1)) / 2;
        }
    }

    return pairs;
}

function clubKey(team) {
    return team.clubId ?? team.clubName ?? `__TEAM_${team.id}`;
}

function allocateTeamsToSections(teams, sectionSizes, variant = 0) {
    const sections = sectionSizes.map((size, index) => ({
        number: index + 1,
        targetSize: size,
        teams: []
    }));

    const clubGroups = new Map();

    for (const team of teams) {
        const key = clubKey(team);
        if (!clubGroups.has(key)) clubGroups.set(key, []);
        clubGroups.get(key).push(team);
    }

    const groups = [...clubGroups.values()].sort((a, b) => {
        if (b.length !== a.length) return b.length - a.length;
        return String(a[0]?.name || "").localeCompare(String(b[0]?.name || ""));
    });

    // Variant 1 reverses the order inside each club group and rotates
    // the section tie-break. This gives the secretary a genuine alternative
    // without changing the rules or section sizes.
    if (variant % 2 === 1) {
        groups.forEach(group => group.reverse());
    }

    for (const group of groups) {
        for (const team of group) {
            const candidates = sections
                .filter(section => section.teams.length < section.targetSize)
                .sort((a, b) => {
                    const aClubCount = a.teams.filter(existing => clubKey(existing) === clubKey(team)).length;
                    const bClubCount = b.teams.filter(existing => clubKey(existing) === clubKey(team)).length;

                    if (aClubCount !== bClubCount) return aClubCount - bClubCount;
                    if (a.teams.length !== b.teams.length) return a.teams.length - b.teams.length;

                    const aPriority = (a.number - 1 + variant) % sections.length;
                    const bPriority = (b.number - 1 + variant) % sections.length;
                    return aPriority - bPriority;
                });

            if (!candidates.length) {
                throw new Error("Unable to allocate all teams to sections.");
            }

            candidates[0].teams.push(team);
        }
    }

    return sections;
}

function createPlayoffMatches(sectionCount) {
    if (sectionCount === 1) return [];

    if (sectionCount === 2) {
        return [{
            stage: "final",
            matchNumber: 1,
            sourceA: { type: "section_winner", sectionNumber: 1 },
            sourceB: { type: "section_winner", sectionNumber: 2 }
        }];
    }

    if (sectionCount === 4) {
        return [
            {
                stage: "semi_final",
                matchNumber: 1,
                sourceA: { type: "section_winner", sectionNumber: 1 },
                sourceB: { type: "section_winner", sectionNumber: 3 }
            },
            {
                stage: "semi_final",
                matchNumber: 2,
                sourceA: { type: "section_winner", sectionNumber: 2 },
                sourceB: { type: "section_winner", sectionNumber: 4 }
            },
            {
                stage: "final",
                matchNumber: 1,
                sourceA: { type: "semi_final_winner", matchNumber: 1 },
                sourceB: { type: "semi_final_winner", matchNumber: 2 }
            }
        ];
    }

    if (sectionCount === 8) {
        return [
            [1, 3], [2, 4], [5, 7], [6, 8]
        ].map(([a, b], index) => ({
            stage: "quarter_final",
            matchNumber: index + 1,
            sourceA: { type: "section_winner", sectionNumber: a },
            sourceB: { type: "section_winner", sectionNumber: b }
        })).concat([
            {
                stage: "semi_final",
                matchNumber: 1,
                sourceA: { type: "quarter_final_winner", matchNumber: 1 },
                sourceB: { type: "quarter_final_winner", matchNumber: 3 }
            },
            {
                stage: "semi_final",
                matchNumber: 2,
                sourceA: { type: "quarter_final_winner", matchNumber: 2 },
                sourceB: { type: "quarter_final_winner", matchNumber: 4 }
            },
            {
                stage: "final",
                matchNumber: 1,
                sourceA: { type: "semi_final_winner", matchNumber: 1 },
                sourceB: { type: "semi_final_winner", matchNumber: 2 }
            }
        ]);
    }

    throw new Error(`Unsupported playoff structure for ${sectionCount} sections.`);
}

function createCompetitionPlan({ teams, competitionType, sectionCount, variant, sectionMode = "multiple" }) {
    const sectionSizes = getSectionSizes(teams.length, sectionCount);
    const sections = allocateTeamsToSections(teams, sectionSizes, variant);

    if (sectionMode === "none" && sections[0]) {
        sections[0].sectionName = "Overall";
    }

    for (const section of sections) {
        section.rounds = createRoundRobinRounds(section.teams);
        validateRoundRobin(section.teams, section.rounds);
        section.roundCount = section.rounds.length;
    }

    const sectionalRounds = getSectionalRoundCount(sectionSizes);
    const playoffStages = playoffStagesForSectionCount(sectionCount);
    const playoffMatches = createPlayoffMatches(sectionCount);
    const sameClubPairs = countSameClubPairs(sections);
    const totalRounds = sectionalRounds + playoffStages.length;

    return {
        id: `plan-${teams.length}-${sectionCount}-v${variant + 1}`,
        status: "proposal",
        recommended: false,
        alternative: variant > 0,
        competitionType,
        sectionMode,
        teamCount: teams.length,
        sectionCount,
        sectionSizes,
        sections,
        sectionalRounds,
        playoffStages,
        playoffMatches,
        totalRounds,
        sameClubPairs,
        schedule: getScheduleSummary({
            competitionType,
            sectionalRounds,
            playoffStages
        }),
        rules: {
            minimumSectionSize: MIN_SECTION_SIZE,
            maximumSectionSize: MAX_SECTION_SIZE,
            qualifierPerSection: 1,
            aggregateTieBreaker: "shots_for_minus_shots_against",
            repeatOpponents: false,
            sameClubSeparation: "preferred"
        }
    };
}

function scorePlan(plan) {
    let score = 0;

    // Section structure is dictated by the competition rules, but within
    // that structure we strongly prefer separation of same-club teams.
    score -= plan.sameClubPairs * 100;

    // Balanced sections are preferred.
    score -= (
        Math.max(...plan.sectionSizes) -
        Math.min(...plan.sectionSizes)
    ) * 25;

    // A small preference for fewer rounds, without overriding sensible
    // section structures.
    score -= plan.totalRounds * 2;

    return score;
}

export function generateCompetitionDrawProposal({
    teams,
    competitionType = "weekend",
    sectionMode = "multiple"
}) {
    assertTeams(teams);

    if (teams.length < 3) {
        throw new Error(
            "At least 3 teams are required to create a BowlPoint competition draw."
        );
    }

    const normalizedSectionMode = sectionMode === "none" ? "none" : "multiple";
    const sectionCount = normalizedSectionMode === "none" ? 1 : getSectionCount(teams.length);

    const candidates = [0, 1].map(variant =>
        createCompetitionPlan({
            teams: clone(teams),
            competitionType,
            sectionCount,
            variant,
            sectionMode: normalizedSectionMode
        })
    );

    const scoredPlans = candidates
        .map(plan => ({ ...plan, score: scorePlan(plan) }))
        .sort((a, b) => b.score - a.score);

    scoredPlans[0].recommended = true;
    if (scoredPlans[1]) scoredPlans[1].alternative = true;

    return {
        teamCount: teams.length,
        competitionType,
        sectionMode: normalizedSectionMode,
        sectionCount,
        recommendedPlan: scoredPlans[0],
        alternativePlans: scoredPlans.slice(1),
        plans: scoredPlans,
        generatedAt: new Date().toISOString()
    };
}

export {
    getSectionCount,
    getSectionSizes,
    roundCountForSection,
    createRoundRobinRounds,
    validateRoundRobin,
    createPlayoffMatches,
    allocateTeamsToSections,
    scorePlan
};
