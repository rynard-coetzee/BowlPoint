export function createTeam(name, isBye = false) {
    return {
        id: crypto.randomUUID(),
        name: name.trim(),
        club: "",
        seed: null,
        isBye
    };
}
export const BYE_TEAM = Object.freeze({
    id: "BYE",
    name: "BYE",
    club: "",
    seed: null,
    isBye: true
});
