import AppCard from "../common/AppCard";
import { formatAggregate } from "../../lib/standingsEngine";

function StandingsCard({
    title = "Standings",
    standings,
    tournament,
    onNewTournament
}) {

    if (tournament.status === "setup") {
        return null;
    }

    const skinsEnabled = tournament.scoring.skins.enabled;

    return (

        <AppCard
            title={title}
            icon="bi-trophy-fill"
            className="mt-4"
        >

            <div className="table-responsive">

                <table className="table table-striped table-hover align-middle">

                    <thead>

                        <tr>

                            <th>Pos</th>

                            <th>Team</th>

                            <th className="text-center">P</th>

                            <th className="text-center">W</th>

                            <th className="text-center">D</th>

                            <th className="text-center">L</th>

                            {skinsEnabled && (
                                <th className="text-center">
                                    Skins
                                </th>
                            )}

                            <th className="text-center">F</th>

                            <th className="text-center">A</th>

                            <th className="text-center">
                                Agg
                            </th>

                            <th className="text-center">
                                Pts
                            </th>

                        </tr>

                    </thead>

                    <tbody>

                        {standings.map((standing, index) => (

                            <tr key={standing.team.id}>

                                <td>
                                    {index + 1}
                                </td>

                                <td>
                                    {standing.team.name}
                                </td>

                                <td className="text-center">
                                    {standing.played}
                                </td>

                                <td className="text-center">
                                    {standing.wins}
                                </td>

                                <td className="text-center">
                                    {standing.draws}
                                </td>

                                <td className="text-center">
                                    {standing.losses}
                                </td>

                                {skinsEnabled && (

                                    <td className="text-center">
                                        {standing.skinsWon}
                                    </td>

                                )}

                                <td className="text-center">
                                    {standing.shotsFor}
                                </td>

                                <td className="text-center">
                                    {standing.shotsAgainst}
                                </td>

                                <td className="text-center fw-semibold">
                                    {formatAggregate(standing)}
                                </td>

                                <td className="text-center fw-bold">
                                    {standing.points}
                                </td>

                            </tr>

                        ))}

                    </tbody>

                </table>

            </div>

            <div className="mt-5">

                <div className="border rounded-3 bg-light p-4 text-center">

                    <h5 className="mb-2">
                        Ready for another tournament?
                    </h5>

                    <p className="text-muted mb-4">

                        This will clear the current tournament and return you to the tournament setup screen.

                    </p>

                    <button
                        className="btn btn-outline-primary btn-lg"
                        onClick={onNewTournament}
                    >

                        <i className="bi bi-arrow-clockwise me-2"></i>

                        Start New Tournament

                    </button>

                </div>

            </div>

        </AppCard>

    );

}

export default StandingsCard;