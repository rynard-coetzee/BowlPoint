export function createTournament() {

    return {

        id: crypto.randomUUID(),

        name: "",

        status: "setup",

        format: "round-robin",

        totalRounds: 3,

        scoring: {

            win: 2,

            skins: {

                enabled: false,

                pointsPerSkin: 1

            }

        },

        teams: [],

        rounds: [],

        standings: []

    };

}