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