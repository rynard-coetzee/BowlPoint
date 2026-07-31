export function createMatch(teamA, teamB) {

    return {

        id: crypto.randomUUID(),

        teamA,
        teamB,

        scoreA: null,
        scoreB: null,

        skinsA: null,
        skinsB: null,

        completed: false,
        completedAt: null

    };

}