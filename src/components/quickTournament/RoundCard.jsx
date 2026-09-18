import MatchCard from "./MatchCard";

function RoundCard({
    round,
    skinsEnabled,
    updateMatchScore,
    drawEditMode,
    selectedTeams,
    onSelectTeamForSwap,
    teams = []
}) {

    const byeSelected =
        selectedTeams?.some(
            selection =>
                selection.teamId ===
                round.byeTeam?.id
        );


    return (

        <div className="card h-100 shadow-sm">

            <div className="card-header bg-white">

                <h5 className="mb-0 fw-bold">

                    🏆 Round {round.number}

                </h5>

            </div>


            <div className="card-body">

                {round.matches.some(match => !match.completed) && (

                    <div className="mb-4">

                        <label
                            htmlFor={`gameJump-${round.id}`}
                            className="form-label fw-semibold mb-2"
                        >

                            <i className="bi bi-search me-2"></i>

                            Find Game

                        </label>

                        <select
                            id={`gameJump-${round.id}`}
                            className="form-select form-select-lg bowlpoint-game-jump-select"
                            defaultValue=""
                            onChange={(e) => {

                                const matchId = e.target.value;

                                if (!matchId) {
                                    return;
                                }

                                const element = document.getElementById(
                                    `quick-score-match-${matchId}`
                                );

                                if (element) {

                                    element.scrollIntoView({
                                        behavior: "smooth",
                                        block: "center"
                                    });

                                    element.classList.add(
                                        "bowlpoint-match-highlight"
                                    );

                                    window.setTimeout(() => {
                                        element.classList.remove(
                                            "bowlpoint-match-highlight"
                                        );
                                    }, 1600);

                                }

                                e.target.value = "";

                            }}
                        >

                            <option value="">
                                Select an unscored game...
                            </option>

                            {[...round.matches]
                                .filter(match => !match.completed)
                                .sort((a, b) => {

                                    const getTeamNumber = (team) => {
                                        const index = teams.findIndex(
                                            item => item?.id === team?.id
                                        );

                                        return index >= 0
                                            ? index + 1
                                            : Number.MAX_SAFE_INTEGER;
                                    };

                                    const aNumber = Math.min(
                                        getTeamNumber(a.teamA),
                                        getTeamNumber(a.teamB)
                                    );

                                    const bNumber = Math.min(
                                        getTeamNumber(b.teamA),
                                        getTeamNumber(b.teamB)
                                    );

                                    return aNumber - bNumber;

                                })
                                .map(match => {

                                    const getTeamNumber = (team) => {
                                        const index = teams.findIndex(
                                            item => item?.id === team?.id
                                        );

                                        return index >= 0
                                            ? index + 1
                                            : "?";
                                    };

                                    const teamANumber = getTeamNumber(
                                        match.teamA
                                    );

                                    const teamBNumber = getTeamNumber(
                                        match.teamB
                                    );

                                    return (

                                        <option
                                            key={match.id}
                                            value={match.id}
                                        >
                                            #{teamANumber} {match.teamA.name}
                                            {"  vs  "}
                                            #{teamBNumber} {match.teamB.name}
                                        </option>

                                    );

                                })}

                        </select>

                        <div className="form-text">
                            Only unscored games are shown, in draw team-number order.
                        </div>

                    </div>

                )}

                <div className="row g-4">

                    {round.matches.map((match) => (

                        <div
                            key={match.id}
                            id={`quick-score-match-${match.id}`}
                            className="col-12 col-md-6 bowlpoint-match-scroll-target"
                        >

                            <MatchCard

                                roundId={
                                    round.id
                                }

                                match={
                                    match
                                }

                                skinsEnabled={
                                    skinsEnabled
                                }

                                onSaveScore={
                                    updateMatchScore
                                }

                                drawEditMode={
                                    drawEditMode
                                }

                                selectedTeams={
                                    selectedTeams
                                }

                                onSelectTeamForSwap={
                                    onSelectTeamForSwap
                                }

                            />

                        </div>

                    ))}

                </div>


                {round.byeTeam && (

                    <div className="mt-3">

                        {drawEditMode ? (

                            <button
                                type="button"
                                className={
                                    `btn w-100 text-start ${
                                        byeSelected
                                            ? "btn-primary"
                                            : "btn-outline-warning"
                                    }`
                                }
                                onClick={() =>
                                    onSelectTeamForSwap(
                                        round.id,
                                        round.byeTeam.id
                                    )
                                }
                            >

                                {byeSelected && (

                                    <i className="bi bi-check-circle-fill me-2"></i>

                                )}

                                <i className="bi bi-calendar-x me-2"></i>

                                <strong>
                                    BYE:
                                </strong>

                                {" "}

                                {round.byeTeam.name}

                            </button>

                        ) : (

                            <div className="alert alert-warning mb-0">

                                <strong>
                                    BYE:
                                </strong>

                                {" "}

                                {round.byeTeam.name}

                            </div>

                        )}

                    </div>

                )}

            </div>

        </div>

    );

}

export default RoundCard;