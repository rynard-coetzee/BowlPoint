export function createRound(number) {
    return {
        id: crypto.randomUUID(),
        number,
        byeTeam: null,
        matches: []
    };
}