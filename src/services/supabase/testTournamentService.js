import { createTournament } from "./tournamentService";
import {
    createTeam,
    addTeamToTournament
} from "./teamService";
import {
    createRound,
    createMatch,
    updateMatchScore
} from "./matchService";


export async function createTestTournament() {

    /*
     * Create tournament
     */

    const tournament = await createTournament({

        name: "BowlPoint Live Test",

        totalRounds: 2,

        currentRound: 2,

        status: "in_progress",

        scoring: {
            win: 2,
            skins: {
                enabled: false,
                pointsPerSkin: 1
            }
        },

        isPublic: true

    });


    /*
     * Create teams
     */

    const teamNames = [
        "Henley Hustlers",
        "Meyerton Bowls",
        "Alberton Eagles",
        "Vaal Lions"
    ];


    const teams = [];


    for (
        let i = 0;
        i < teamNames.length;
        i++
    ) {

        const team =
            await createTeam(
                teamNames[i]
            );

        await addTeamToTournament({

            tournamentId:
                tournament.id,

            teamId:
                team.id,

            teamPosition:
                i + 1

        });

        teams.push(team);

    }


    /*
     * ROUND 1
     */

    const round1 =
        await createRound({

            tournamentId:
                tournament.id,

            roundNumber: 1,

            status: "completed"

        });


    const round1Match1 =
        await createMatch({

            roundId:
                round1.id,

            matchNumber: 1,

            teamAId:
                teams[0].id,

            teamBId:
                teams[1].id

        });


    const round1Match2 =
        await createMatch({

            roundId:
                round1.id,

            matchNumber: 2,

            teamAId:
                teams[2].id,

            teamBId:
                teams[3].id

        });


    /*
     * Enter Round 1 scores
     */

    await updateMatchScore({

        matchId:
            round1Match1.id,

        scoreA: 21,

        scoreB: 2

    });


    await updateMatchScore({

        matchId:
            round1Match2.id,

        scoreA: 18,

        scoreB: 14

    });


    /*
     * ROUND 2
     */

    const round2 =
        await createRound({

            tournamentId:
                tournament.id,

            roundNumber: 2,

            status: "in_progress"

        });


    await createMatch({

        roundId:
            round2.id,

        matchNumber: 1,

        teamAId:
            teams[0].id,

        teamBId:
            teams[2].id

    });


    await createMatch({

        roundId:
            round2.id,

        matchNumber: 2,

        teamAId:
            teams[1].id,

        teamBId:
            teams[3].id

    });


    return {

        tournament,

        teams,

        round1,

        round2

    };

}