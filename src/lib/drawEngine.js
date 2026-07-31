import { createRound } from "../models/round";
import { createMatch } from "../models/match";
import { createTeam } from "../models/team";

export function generateRoundRobinDraw(tournament) {

    const generatedTournament = structuredClone(tournament);

    const preparedTeams = prepareTeams(generatedTournament.teams);

    // Generate the unique round-robin schedule
    const fullSchedule = createRoundRobinSchedule(preparedTeams);

    // Build exactly the number of rounds requested
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

        // Circle method rotation
        teamList.splice(1, 0, teamList.pop());

    }

    return rounds;

}

function buildRounds(schedule) {

    return schedule.map((pairings, index) => {

        const round = createRound(index + 1);

        pairings.forEach(([teamA, teamB]) => {

            if (teamA.isBye) {
                round.byeTeam = teamB;
                return;
            }

            if (teamB.isBye) {
                round.byeTeam = teamA;
                return;
            }

            round.matches.push(
                createMatch(teamA, teamB)
            );

        });

        return round;

    });

}