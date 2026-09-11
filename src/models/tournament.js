export function createTournament() {

    return {

        id: crypto.randomUUID(),

        name: "",

        status: "setup",

        format: "round-robin",

        totalRounds: 3,

        scoring: {

            win: 2,

            drawMode: "standard",

            // Number of final rounds that use Strength vs Strength.
            // Zero/unused in standard draw mode.
            strengthRounds: 1,

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