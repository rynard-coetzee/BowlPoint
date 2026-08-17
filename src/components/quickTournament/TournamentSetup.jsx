import AppCard from "../common/AppCard";
import SectionHeader from "../common/SectionHeader";
import SectionPanel from "../common/SectionPanel";
import TournamentDetails from "./TournamentDetails";
import TournamentStatus from "./TournamentStatus";
import ScoringCard from "./ScoringCard";
import TeamList from "./TeamList";

function TournamentSetup({
    tournament,
    updateTournament,
    updateScoring,
    addTeam,
    removeTeam,
    generateTournament,
    setupCollapsed,
    setSetupCollapsed
}) {

    const toggleSetup = () => {
        setSetupCollapsed(!setupCollapsed);
    };

    return (

        <AppCard
            title="Tournament Setup"
            icon="bi-sliders"
            collapsible
            collapsed={setupCollapsed}
            onToggle={toggleSetup}
        >

            <div className="row g-5">

                {/* Left Column */}

               <div className="col-lg-6 order-2 order-lg-1">

                    <SectionPanel>

                        <TournamentDetails
                            tournament={tournament}
                            updateTournament={updateTournament}
                        />

                    </SectionPanel>

                    <SectionPanel className="mt-4">

                        <SectionHeader
                            icon="bi-bullseye"
                            title="Scoring"
                        />

                        <ScoringCard
                            tournament={tournament}
                            updateScoring={updateScoring}
                        />

                    </SectionPanel>

                    <SectionPanel className="mt-4">

                        <TournamentStatus
                            tournament={tournament}
                        />

                    </SectionPanel>

                    <div className="d-grid mt-4">

                        <button
                            className="btn btn-success btn-lg py-3"
                            disabled={tournament.teams.length < 2}
                            onClick={generateTournament}
                        >

                            <i className="bi bi-diagram-3-fill me-2"></i>

                            Generate Tournament

                        </button>

                    </div>

                </div>
                {/* Right Column */}

                <div className="col-lg-6 order-1 order-lg-2">

                    <SectionPanel>

                        <SectionHeader
                            icon="bi-people"
                            iconColor="text-success"
                            title="Teams"
                            endContent={
                                <span className="badge bg-primary fs-6">
                                    {tournament.teams.length}
                                </span>
                            }
                        />

                        <TeamList
                            teams={tournament.teams}
                            onAddTeam={addTeam}
                            onRemoveTeam={removeTeam}
                        />

                    </SectionPanel>

                </div>

            </div>

        </AppCard>

    );

}

export default TournamentSetup;