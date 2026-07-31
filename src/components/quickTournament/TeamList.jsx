import { useRef, useState } from "react";
import TeamRow from "./TeamRow";

function TeamList({ teams, onAddTeam, onRemoveTeam }) {

    const handlePaste = (e) => {

        const text = e.clipboardData.getData("text");

        if (!text) {
            return;
        }

        // Split on new lines, commas or semicolons
        const teams = text
            .split(/\r?\n|,|;/)
            .map(name => name.trim())
            .filter(Boolean);

        // Only treat it as a bulk import if more than one team was pasted
        if (teams.length <= 1) {
            return;
        }

        e.preventDefault();

        teams.forEach(team => onAddTeam(team));

        setTeamName("");

        inputRef.current?.focus();

    };

    const [teamName, setTeamName] = useState("");

    const inputRef = useRef(null);

    const handleAdd = () => {

        const name = teamName.trim();

        if (!name) {
            return;
        }

        onAddTeam(name);

        setTeamName("");

        inputRef.current?.focus();

    };

    const handleKeyDown = (e) => {

        if (e.key === "Enter") {

            e.preventDefault();
            handleAdd();

        }

    };

    return (

        <>

            <div className="border rounded-3 p-3 bg-light mb-4">

                <label className="form-label fw-semibold">

                    Add Team

                </label>

                <div className="input-group">

                    <input
                        ref={inputRef}
                        className="form-control"
                        placeholder="Type a team name or paste a list..."
                        value={teamName}
                        onChange={(e) => setTeamName(e.target.value)}
                        onKeyDown={handleKeyDown}
                        onPaste={handlePaste}
                    />

                    <button
                        className="btn btn-primary"
                        onClick={handleAdd}
                    >

                        <i className="bi bi-plus-lg me-2"></i>

                        Add

                    </button>

                </div>

            </div>

            {teams.length === 0 ? (

                <div className="text-center py-5 text-muted">

                    <i className="bi bi-people fs-1 d-block mb-3"></i>

                    <h6>No teams added yet</h6>

                    <small>

                        Add your first team to begin building the tournament.

                    </small>

                </div>

            ) : (

                <div className="list-group list-group-flush">

                    {teams.map((team, index) => (

                        <TeamRow
                            key={team.id}
                            team={team}
                            index={index}
                            onRemove={onRemoveTeam}
                        />

                    ))}

                </div>

            )}

        </>

    );

}

export default TeamList;