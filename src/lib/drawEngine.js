import { createRound } from "../models/round";
import { createMatch } from "../models/match";
import { createTeam } from "../models/team";

/*
 * Standard draw generation.
 *
 * This remains the original multi-round round-robin behaviour used when
 * Strength vs Strength is disabled.
 */
export function generateRoundRobinDraw(tournament) {

    const generatedTournament = structuredClone(tournament);

    const preparedTeams = prepareTeams(generatedTournament.teams);

    const fullSchedule = createRoundRobinSchedule(preparedTeams);

    const requestedSchedule = [];

    for (let i = 0; i < generatedTournament.totalRounds; i++) {
        requestedSchedule.push(
            fullSchedule[i % fullSchedule.length]
        );
    }

    generatedTournament.rounds = buildRounds(requestedSchedule);
    generatedTournament.status = "generated";

    return generatedTournament;

}

/*
 * Strength vs Strength draw.
 *
 * Round 1 is intentionally random. Subsequent rounds are generated from
 * the standings and are therefore created only when the previous round
 * has been completed.
 */
export function generateStrengthDraw(tournament) {

    const generatedTournament = structuredClone(tournament);

    const strengthRounds = Math.min(
        Math.max(1, Number(
            generatedTournament.scoring.strengthRounds ||
            generatedTournament.totalRounds - 1
        )),
        Math.max(1, generatedTournament.totalRounds - 1)
    );

    const randomRounds =
        Math.max(1, generatedTournament.totalRounds - strengthRounds);

    /*
     * Blind random rounds are all generated up front. The remaining final
     * rounds are generated dynamically from the standings once the random
     * phase is complete.
     */
    generatedTournament.rounds = Array.from(
        { length: randomRounds },
        (_, index) =>
            createRandomRound(
                generatedTournament.teams,
                index + 1
            )
    );

    generatedTournament.scoring.strengthRounds = strengthRounds;
    generatedTournament.status = "generated";

    return generatedTournament;

}

/*
 * Generate the next Strength vs Strength round from the current standings.
 *
 * Pairings are chosen to:
 *   1. avoid repeat opponents whenever mathematically possible;
 *   2. avoid repeating a previous BYE whenever possible; and
 *   3. stay as close as possible to the current ranking.
 */
export function generateNextStrengthRound(tournament, standings) {

    const nextRoundNumber =
        tournament.rounds.length + 1;

    if (nextRoundNumber > tournament.totalRounds) {
        return null;
    }

    const rankedTeams = standings
        .map(standing => standing.team)
        .filter(team => !team.isBye);

    if (rankedTeams.length < 2) {
        return null;
    }

    const pairings = createStrengthPairings(
        rankedTeams,
        tournament.rounds
    );

    return buildRoundFromPairings(
        pairings,
        nextRoundNumber
    );

}

export function isRoundComplete(round) {

    if (!round) {
        return false;
    }

    return (
        round.matches.length > 0 &&
        round.matches.every(match => match.completed)
    );

}

function prepareTeams(teams) {

    const preparedTeams = [...teams];

    if (preparedTeams.length % 2 !== 0) {
        preparedTeams.push(createTeam("BYE", true));
    }

    return preparedTeams;

}

function createRoundRobinSchedule(teams) {

    const teamList = [...teams];
    const rounds = [];
    const totalRounds = teamList.length - 1;

    for (let round = 0; round < totalRounds; round++) {

        const pairings = [];

        for (let i = 0; i < teamList.length / 2; i++) {
            pairings.push([
                teamList[i],
                teamList[teamList.length - 1 - i]
            ]);
        }

        rounds.push(pairings);
        teamList.splice(1, 0, teamList.pop());

    }

    return rounds;

}

function createRandomRound(teams, number) {

    const shuffled = [...teams]
        .sort(() => Math.random() - 0.5);

    const preparedTeams = prepareTeams(shuffled);

    return buildRoundFromPairings(
        pairConsecutiveTeams(preparedTeams),
        number
    );

}

function pairConsecutiveTeams(teams) {

    const pairings = [];

    for (let i = 0; i < teams.length; i += 2) {
        pairings.push([
            teams[i],
            teams[i + 1]
        ]);
    }

    return pairings;

}

function buildRounds(schedule) {

    return schedule.map((pairings, index) =>
        buildRoundFromPairings(
            pairings,
            index + 1
        )
    );

}

function buildRoundFromPairings(pairings, number) {

    const round = createRound(number);

    pairings.forEach(([teamA, teamB]) => {

        if (teamA?.isBye) {
            round.byeTeam = teamB;
            return;
        }

        if (teamB?.isBye) {
            round.byeTeam = teamA;
            return;
        }

        round.matches.push(
            createMatch(teamA, teamB)
        );

    });

    return round;

}

function createStrengthPairings(teams, rounds) {

    const teamById = new Map(
        teams.map(team => [team.id, team])
    );

    const previousOpponents = new Map();
    const previousByes = new Set();

    teams.forEach(team => {
        previousOpponents.set(team.id, new Set());
    });

    rounds.forEach(round => {

        if (round.byeTeam?.id) {
            previousByes.add(round.byeTeam.id);
        }

        round.matches.forEach(match => {

            if (!match.teamA?.id || !match.teamB?.id) {
                return;
            }

            previousOpponents
                .get(match.teamA.id)
                ?.add(match.teamB.id);

            previousOpponents
                .get(match.teamB.id)
                ?.add(match.teamA.id);

        });

    });

    const ranking = new Map(
        teams.map((team, index) => [team.id, index])
    );

    const workingTeams = [...teams];

    if (workingTeams.length % 2 !== 0) {
        workingTeams.push({
            id: "__BOWLPOINT_BYE__",
            name: "BYE",
            isBye: true
        });
    }

    const pairings = findBestPairing(
        workingTeams,
        ranking,
        previousOpponents,
        previousByes
    );

    return pairings.map(([a, b]) => [
        a.isBye ? a : teamById.get(a.id),
        b.isBye ? b : teamById.get(b.id)
    ]);

}

/*
 * Minimum-cost perfect matching by backtracking.
 *
 * A repeat carries a very large penalty, so it is only accepted when no
 * complete no-repeat solution exists. Rank distance then determines the
 * best strength-v-strength compromise.
 */
function findBestPairing(
    teams,
    ranking,
    previousOpponents,
    previousByes
) {

    let best = null;
    let bestCost = Number.POSITIVE_INFINITY;

    function search(remaining, current, cost) {

        if (cost >= bestCost) {
            return;
        }

        if (remaining.length === 0) {
            best = current.map(pair => [...pair]);
            bestCost = cost;
            return;
        }

        const first = remaining[0];
        const candidates = remaining.slice(1)
            .map(candidate => ({
                candidate,
                cost: pairingCost(
                    first,
                    candidate,
                    ranking,
                    previousOpponents,
                    previousByes
                )
            }))
            .sort((a, b) => a.cost - b.cost);

        for (const { candidate, cost: pairCost } of candidates) {

            const nextCost = cost + pairCost;

            if (nextCost >= bestCost) {
                continue;
            }

            const nextRemaining = remaining.filter(
                team => team !== first && team !== candidate
            );

            search(
                nextRemaining,
                [...current, [first, candidate]],
                nextCost
            );

        }

    }

    search(teams, [], 0);

    return best || pairConsecutiveTeams(teams);

}

function pairingCost(
    teamA,
    teamB,
    ranking,
    previousOpponents,
    previousByes
) {

    const aIsBye = Boolean(teamA.isBye);
    const bIsBye = Boolean(teamB.isBye);

    if (aIsBye || bIsBye) {

        const realTeam = aIsBye ? teamB : teamA;
        const repeatedBye = previousByes.has(realTeam.id);

        return (
            (repeatedBye ? 1_000_000 : 0) +
            100_000 +
            ranking.get(realTeam.id) * 10
        );

    }

    const repeated = previousOpponents
        .get(teamA.id)
        ?.has(teamB.id);

    const rankGap = Math.abs(
        ranking.get(teamA.id) - ranking.get(teamB.id)
    );

    return (
        (repeated ? 1_000_000 : 0) +
        rankGap
    );
}
