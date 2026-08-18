export function updateMatchInTournament(
    tournament,
    roundId,
    matchId,
    updates
) {

    return {

        ...tournament,

        rounds: tournament.rounds.map(round => {

            if (round.id !== roundId) {
                return round;
            }

            return {

                ...round,

                matches: round.matches.map(match => {

                    if (match.id !== matchId) {
                        return match;
                    }

                    return {
                        ...match,
                        ...updates
                    };

                })

            };

        })

    };

}


export function swapTeamsInRound(
    tournament,
    roundId,
    teamIdA,
    teamIdB
) {

    if (teamIdA === teamIdB) {
        return tournament;
    }

    return {

        ...tournament,

        rounds: tournament.rounds.map(round => {

            if (round.id !== roundId) {
                return round;
            }

            const matches = round.matches;

            const matchA = matches.find(
                match =>
                    !match.completed &&
                    (
                        match.teamA.id === teamIdA ||
                        match.teamB.id === teamIdA
                    )
            );

            const matchB = matches.find(
                match =>
                    !match.completed &&
                    (
                        match.teamA.id === teamIdB ||
                        match.teamB.id === teamIdB
                    )
            );

            if (!matchA || !matchB) {
                return round;
            }

            const swapTeam = (match, teamId, replacementTeam) => {

                if (match.teamA.id === teamId) {

                    return {
                        ...match,
                        teamA: replacementTeam
                    };

                }

                if (match.teamB.id === teamId) {

                    return {
                        ...match,
                        teamB: replacementTeam
                    };

                }

                return match;

            };

            const teamAReplacement =
                matchB.teamA.id === teamIdB
                    ? matchB.teamA
                    : matchB.teamB;

            const teamBReplacement =
                matchA.teamA.id === teamIdA
                    ? matchA.teamA
                    : matchA.teamB;

            return {

                ...round,

                matches: matches.map(match => {

                    if (match.id === matchA.id) {

                        return swapTeam(
                            match,
                            teamIdA,
                            teamAReplacement
                        );

                    }

                    if (match.id === matchB.id) {

                        return swapTeam(
                            match,
                            teamIdB,
                            teamBReplacement
                        );

                    }

                    return match;

                })

            };

        })

    };

}