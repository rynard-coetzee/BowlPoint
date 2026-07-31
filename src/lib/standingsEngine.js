import {
    getTeamMatchPoints,
    isDraw,
    getWinner
} from "./scoringEngine";

export function getAggregate(standing) {

    return standing.shotsFor - standing.shotsAgainst;

}

export function formatAggregate(standing) {

    const aggregate = getAggregate(standing);

    if (aggregate > 0) {
        return `+${aggregate}`;
    }

    return aggregate.toString();

}

export function calculateStandings(tournament) {

    const standings = tournament.teams.map(team => ({

        team,

        played: 0,

        wins: 0,

        draws: 0,

        losses: 0,

        skinsWon: 0,

        points: 0,

        shotsFor: 0,

        shotsAgainst: 0

    }));

    const lookup = new Map(

        standings.map(standing => [

            standing.team.id,

            standing

        ])

    );

    tournament.rounds.forEach(round => {

        round.matches.forEach(match => {

            if (!match.completed) {
                return;
            }

            const teamA = lookup.get(match.teamA.id);
            const teamB = lookup.get(match.teamB.id);

            teamA.played++;
            teamB.played++;

            teamA.shotsFor += match.scoreA;
            teamA.shotsAgainst += match.scoreB;

            teamB.shotsFor += match.scoreB;
            teamB.shotsAgainst += match.scoreA;

            if (tournament.scoring.skins.enabled) {

                teamA.skinsWon += match.skinsA ?? 0;
                teamB.skinsWon += match.skinsB ?? 0;

            }

            teamA.points += getTeamMatchPoints(
                match,
                match.teamA.id,
                tournament.scoring
            );

            teamB.points += getTeamMatchPoints(
                match,
                match.teamB.id,
                tournament.scoring
            );

            if (isDraw(match)) {

                teamA.draws++;
                teamB.draws++;

            } else {

                const winner = getWinner(match);

                if (winner.id === match.teamA.id) {

                    teamA.wins++;
                    teamB.losses++;

                } else {

                    teamB.wins++;
                    teamA.losses++;

                }

            }

        });

    });

    standings.sort((a, b) => {

        if (b.points !== a.points) {
            return b.points - a.points;
        }

        const aggA = getAggregate(a);
        const aggB = getAggregate(b);

        if (aggB !== aggA) {
            return aggB - aggA;
        }

        if (b.shotsFor !== a.shotsFor) {
            return b.shotsFor - a.shotsFor;
        }

        return a.team.name.localeCompare(b.team.name);

    });

    return standings;

}