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


            const byeTeam =
                round.byeTeam;


            const teamAIsBye =
                byeTeam?.id === teamIdA;


            const teamBIsBye =
                byeTeam?.id === teamIdB;


            /*
             * Team ↔ BYE
             */
            if (teamAIsBye || teamBIsBye) {

                const byeId =
                    teamAIsBye
                        ? teamIdA
                        : teamIdB;


                const playingTeamId =
                    teamAIsBye
                        ? teamIdB
                        : teamIdA;


                const affectedMatch =
                    round.matches.find(
                        match =>
                            !match.completed &&
                            (
                                match.teamA.id ===
                                playingTeamId ||
                                match.teamB.id ===
                                playingTeamId
                            )
                    );


                if (!affectedMatch) {
                    return round;
                }


                /*
                 * Replace the playing team with
                 * the old BYE team.
                 */
                const updatedMatches =
                    round.matches.map(match => {

                        if (
                            match.id !==
                            affectedMatch.id
                        ) {
                            return match;
                        }


                        if (
                            match.teamA.id ===
                            playingTeamId
                        ) {

                            return {

                                ...match,

                                teamA:
                                    byeTeam

                            };

                        }


                        if (
                            match.teamB.id ===
                            playingTeamId
                        ) {

                            return {

                                ...match,

                                teamB:
                                    byeTeam

                            };

                        }


                        return match;

                    });


                /*
                 * The team that was playing now
                 * receives the BYE.
                 */
                const newByeTeam =
                    affectedMatch.teamA.id ===
                    playingTeamId
                        ? affectedMatch.teamA
                        : affectedMatch.teamB;


                return {

                    ...round,

                    matches:
                        updatedMatches,

                    byeTeam:
                        newByeTeam

                };

            }


            /*
             * Normal Team ↔ Team swap.
             */
            const matches =
                round.matches;


            const matchA =
                matches.find(
                    match =>
                        !match.completed &&
                        (
                            match.teamA.id ===
                            teamIdA ||
                            match.teamB.id ===
                            teamIdA
                        )
                );


            const matchB =
                matches.find(
                    match =>
                        !match.completed &&
                        (
                            match.teamA.id ===
                            teamIdB ||
                            match.teamB.id ===
                            teamIdB
                        )
                );


            if (!matchA || !matchB) {
                return round;
            }


            const replacementForA =
                matchB.teamA.id === teamIdB
                    ? matchB.teamA
                    : matchB.teamB;


            const replacementForB =
                matchA.teamA.id === teamIdA
                    ? matchA.teamA
                    : matchA.teamB;


            const replaceTeam = (
                match,
                teamId,
                replacement
            ) => {

                if (
                    match.teamA.id ===
                    teamId
                ) {

                    return {

                        ...match,

                        teamA:
                            replacement

                    };

                }


                if (
                    match.teamB.id ===
                    teamId
                ) {

                    return {

                        ...match,

                        teamB:
                            replacement

                    };

                }


                return match;

            };


            return {

                ...round,

                matches:
                    matches.map(match => {

                        if (
                            match.id ===
                            matchA.id
                        ) {

                            return replaceTeam(
                                match,
                                teamIdA,
                                replacementForA
                            );

                        }


                        if (
                            match.id ===
                            matchB.id
                        ) {

                            return replaceTeam(
                                match,
                                teamIdB,
                                replacementForB
                            );

                        }


                        return match;

                    })

            };

        })

    };

}