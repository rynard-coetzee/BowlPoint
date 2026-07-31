import { useState } from "react";
import PageHeader from "../../components/common/PageHeader";
import TournamentSetup from "../../components/quickTournament/TournamentSetup";
import FixturesCard from "../../components/quickTournament/FixturesCard";
import StandingsCard from "../../components/quickTournament/StandingsCard";

import { createTournament } from "../../models/tournament";
import { createTeam } from "../../models/team";

import { generateRoundRobinDraw } from "../../lib/drawEngine";
import { updateMatchInTournament } from "../../lib/tournamentEngine";
import { calculateStandings } from "../../lib/standingsEngine";

function QuickTournament() {

    const [tournament, setTournament] = useState(createTournament());

    // Controls whether the setup cards are collapsed
    const [setupCollapsed, setSetupCollapsed] = useState(false);

    const updateTournament = (field, value) => {

        setTournament(prev => ({
            ...prev,
            [field]: value
        }));

    };

    const updateScoring = (field, value) => {

        setTournament(prev => {

            const scoring = structuredClone(prev.scoring);

            switch (field) {

                case "win":
                    scoring.win = Number(value);
                    break;

                case "skinsEnabled":
                    scoring.skins.enabled = value;
                    break;

                case "pointsPerSkin":
                    scoring.skins.pointsPerSkin = Number(value);
                    break;

                default:
                    break;

            }

            return {
                ...prev,
                scoring
            };

        });

    };

    const addTeam = (teamName) => {

        const name = teamName.trim();

        if (!name) {
            return;
        }

        const team = createTeam(name);

        setTournament(prev => ({
            ...prev,
            teams: [
                ...prev.teams,
                team
            ]
        }));

    };

    const removeTeam = (teamId) => {

        setTournament(prev => ({
            ...prev,
            teams: prev.teams.filter(team => team.id !== teamId)
        }));

    };

    const generateTournament = () => {

        const generatedTournament = generateRoundRobinDraw(tournament);

        setTournament(generatedTournament);

        // Automatically collapse the setup section
        setSetupCollapsed(true);

    };

    const resetTournament = () => {

        // Create a brand new tournament
        setTournament(createTournament());

        // Re-open the setup section
        setSetupCollapsed(false);

        // Scroll back to the top of the page
        window.scrollTo({
            top: 0,
            behavior: "smooth"
        });

    };

    const updateMatchScore = (
        roundId,
        matchId,
        scoreA,
        scoreB,
        skinsA,
        skinsB
    ) => {

        setTournament(prev =>
            updateMatchInTournament(
                prev,
                roundId,
                matchId,
                {
                    scoreA: Number(scoreA),
                    scoreB: Number(scoreB),

                    skinsA:
                        skinsA === ""
                            ? null
                            : Number(skinsA),

                    skinsB:
                        skinsB === ""
                            ? null
                            : Number(skinsB),

                    completed: true,

                    completedAt: new Date().toISOString()
                }
            )
        );

    };

    const standings = calculateStandings(tournament);

    return (

        <>
            <PageHeader
                title="Quick Tournament"
                subtitle="Run a tournament without creating a full competition."
            />

            <TournamentSetup
                tournament={tournament}
                updateTournament={updateTournament}
                updateScoring={updateScoring}
                addTeam={addTeam}
                removeTeam={removeTeam}
                generateTournament={generateTournament}

                setupCollapsed={setupCollapsed}
                setSetupCollapsed={setSetupCollapsed}
            />

            <FixturesCard
                tournament={tournament}
                updateMatchScore={updateMatchScore}
            />

            <StandingsCard
                tournament={tournament}
                standings={standings}
                onNewTournament={resetTournament}
            />

        </>

    );

}

export default QuickTournament;