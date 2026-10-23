import { useMemo, useRef, useState } from "react";
import PageHeader from "../../components/common/PageHeader";
import SpeechInput from "../../components/common/SpeechInput";

const FORMATS = {
    4: { name: "Pairs", size: 4, positions: ["Lead", "Skip"] },
    6: { name: "Trips", size: 6, positions: ["Lead", "Second", "Skip"] },
    8: { name: "Fours", size: 8, positions: ["Lead", "Second", "Third", "Skip"] }
};

function shuffle(items) {
    const result = [...items];
    for (let i = result.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
}

// Find the draw that uses the most players, then the fewest games.
// For equal solutions, prefer the larger format first (fours, trips, pairs).
function getFormatOptions(playerCount) {
    // Offer every distinct mix of pairs (4 players), trips (6) and fours (8)
    // that allocates the maximum possible number of players.
    const sizes = [8, 6, 4];
    const bestUsed = Array(playerCount + 1).fill(0);
    const combinations = Array.from({ length: playerCount + 1 }, () => []);
    combinations[0] = [[]];

    for (let count = 1; count <= playerCount; count += 1) {
        let used = 0;
        const candidates = [];
        for (const size of sizes) {
            if (count >= size) {
                const previousUsed = bestUsed[count - size];
                const candidateUsed = previousUsed + size;
                if (candidateUsed > used) {
                    used = candidateUsed;
                    candidates.length = 0;
                }
                if (candidateUsed === used) {
                    for (const previous of combinations[count - size]) {
                        candidates.push([...previous, size].sort((a, b) => b - a));
                    }
                }
            }
        }
        // Carry forward the best result from the previous count, allowing leftovers.
        if (bestUsed[count - 1] > used) {
            used = bestUsed[count - 1];
            candidates.push(...combinations[count - 1]);
        }
        bestUsed[count] = used;
        const unique = new Map();
        candidates.forEach((combo) => {
            if (combo.reduce((sum, size) => sum + size, 0) === used) {
                const key = combo.slice().sort((a, b) => b - a).join('-');
                unique.set(key, combo.slice().sort((a, b) => b - a));
            }
        });
        combinations[count] = [...unique.values()];
    }

    const maxUsed = bestUsed[playerCount];
    const combos = combinations[playerCount]
        .filter((combo) => combo.reduce((sum, size) => sum + size, 0) === maxUsed)
        .map((combo) => combo.slice().sort((a, b) => b - a));
    const unique = new Map();
    combos.forEach((combo) => unique.set(combo.join('-'), combo));

    return [...unique.values()]
        .sort((a, b) => a.length - b.length || b.join('').localeCompare(a.join('')))
        .slice(0, 8)
        .map((sizesList, index) => ({
            id: sizesList.join('-'),
            sizes: sizesList,
            used: sizesList.reduce((sum, size) => sum + size, 0),
            unused: playerCount - sizesList.reduce((sum, size) => sum + size, 0),
            label: sizesList.map((size) => FORMATS[size].name).reduce((acc, name) => {
                acc[name] = (acc[name] || 0) + 1;
                return acc;
            }, {}),
            title: sizesList.map((size) => FORMATS[size].name).reduce((acc, name) => {
                acc[name] = (acc[name] || 0) + 1;
                return acc;
            }, {}),
            recommended: index === 0
        }));
}

function formatOptionLabel(option) {
    return Object.entries(option.label)
        .map(([name, count]) => `${count > 1 ? `${count} × ` : ''}${name}`)
        .join(' + ');
}

export default function QuickDraw() {
    const [entry, setEntry] = useState("");
    const [players, setPlayers] = useState([]);
    const [draw, setDraw] = useState(null);
    const [selectedFormatId, setSelectedFormatId] = useState(null);
    const inputRef = useRef(null);
    const [draggedPlayer, setDraggedPlayer] = useState(null);

    const trimmedPlayers = useMemo(() => players.map((name) => name.trim()).filter(Boolean), [players]);
    const formatOptions = useMemo(() => getFormatOptions(trimmedPlayers.length), [trimmedPlayers.length]);
    const selectedFormat = formatOptions.find((option) => option.id === selectedFormatId) || formatOptions[0] || null;

    const addNames = (raw) => {
        const incoming = String(raw || "").split(/[\n,;\t]+/).map((name) => name.trim()).filter(Boolean);
        if (!incoming.length) return;
        setPlayers((current) => {
            const known = new Set(current.map((name) => name.toLocaleLowerCase()));
            const next = [...current];
            incoming.forEach((name) => {
                if (!known.has(name.toLocaleLowerCase())) {
                    next.push(name);
                    known.add(name.toLocaleLowerCase());
                }
            });
            return next;
        });
        setEntry("");
        setDraw(null);
        setSelectedFormatId(null);
    };

    const addOne = () => addNames(entry);

    const handlePaste = (event) => {
        const pasted = event.clipboardData?.getData("text") || "";
        if (/[\n,;\t]/.test(pasted)) {
            event.preventDefault();
            addNames(pasted);
        }
    };

    // Reorder within a team, or swap players between teams without changing team sizes.
    const moveDrawPlayer = (targetGameId, targetTeamName, targetIndex) => {
        if (!draggedPlayer || !draw) return;
        const { gameId: sourceGameId, teamName: sourceTeamName, index: sourceIndex } = draggedPlayer;
        if (sourceGameId === targetGameId && sourceTeamName === targetTeamName && sourceIndex === targetIndex) {
            setDraggedPlayer(null);
            return;
        }

        setDraw((current) => {
            if (!current) return current;
            const games = current.games.map((game) => ({
                ...game,
                teams: game.teams.map((team) => ({ ...team, players: [...team.players] }))
            }));
            const sourceGame = games.find((game) => game.id === sourceGameId);
            const targetGame = games.find((game) => game.id === targetGameId);
            const sourceTeam = sourceGame?.teams.find((team) => team.name === sourceTeamName);
            const targetTeam = targetGame?.teams.find((team) => team.name === targetTeamName);
            if (!sourceTeam || !targetTeam || !sourceTeam.players[sourceIndex] || !targetTeam.players[targetIndex]) return current;

            if (sourceGameId === targetGameId && sourceTeamName === targetTeamName) {
                const [player] = sourceTeam.players.splice(sourceIndex, 1);
                sourceTeam.players.splice(targetIndex, 0, player);
            } else {
                const sourcePlayer = sourceTeam.players[sourceIndex];
                const targetPlayer = targetTeam.players[targetIndex];
                sourceTeam.players[sourceIndex] = targetPlayer;
                targetTeam.players[targetIndex] = sourcePlayer;
            }
            // Positions belong to the team slots, not to the person, so recalculate
            // them after every reorder or swap.
            games.forEach((game) => game.teams.forEach((team) => {
                const format = FORMATS[game.format === 'Fours' ? 8 : game.format === 'Trips' ? 6 : 4];
                team.players = team.players.map((player, index) => ({ ...player, position: format.positions[index] }));
            }));
            return { ...current, games };
        });
        setDraggedPlayer(null);
    };

    const generateDraw = () => {
        if (trimmedPlayers.length < 4 || !selectedFormat) return;
        const randomized = shuffle(trimmedPlayers);
        let cursor = 0;
        const games = selectedFormat.sizes.map((size, index) => {
            const format = FORMATS[size];
            const names = randomized.slice(cursor, cursor + size);
            cursor += size;
            const ordered = shuffle(names);
            return {
                id: `${Date.now()}-${index}`,
                name: `${format.name} Game ${index + 1}`,
                format: format.name,
                teams: [
                    { name: "Team A", players: ordered.slice(0, size / 2).map((player, i) => ({ name: player, position: format.positions[i] })) },
                    { name: "Team B", players: ordered.slice(size / 2).map((player, i) => ({ name: player, position: format.positions[i] })) }
                ]
            };
        });
        setDraw({ games, unused: randomized.slice(cursor), formatId: selectedFormat.id });
    };

    return (
        <div className="container-fluid py-2 quick-draw-page">
            <PageHeader title="Quick Draw" subtitle="Enter players and create a random lawn bowls draw." />

            <div className="card shadow-sm border-0 mb-4">
                <div className="card-header bg-white py-3">
                    <h2 className="h5 mb-0"><i className="bi bi-people me-2 text-success" />Players</h2>
                </div>
                <div className="card-body">
                    <label htmlFor="quick-draw-player" className="form-label">Add a player</label>
                    <div className="d-flex gap-2 align-items-start">
                        <div className="flex-grow-1">
                            <SpeechInput
                                ref={inputRef}
                                value={entry}
                                onChange={(event) => setEntry(event.target.value)}
                                onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addOne(); } }}
                                onPaste={handlePaste}
                                placeholder="Type, speak, or paste player names..."
                            />
                        </div>
                        <button type="button" className="btn btn-primary" onClick={addOne} disabled={!entry.trim()}>
                            <i className="bi bi-plus-lg me-1" /> Add
                        </button>
                    </div>
                    <div className="form-text">You can paste multiple names separated by new lines, commas or semicolons. Duplicate names are ignored.</div>

                    <div className="d-flex justify-content-between align-items-center mt-4 mb-2">
                        <h3 className="h6 mb-0">Player list</h3>
                        <span className="badge bg-primary fs-6">{trimmedPlayers.length}</span>
                    </div>
                    {trimmedPlayers.length === 0 ? (
                        <div className="text-center text-muted border rounded-3 py-5">
                            <i className="bi bi-person-plus display-6 d-block mb-2" />
                            No players added yet. Add the players who are available for this draw.
                        </div>
                    ) : (
                        <div className="row g-2">
                            {trimmedPlayers.map((name, index) => (
                                <div className="col-12 col-md-6 col-xl-4" key={`${name.toLocaleLowerCase()}-${index}`}>
                                    <div className="d-flex align-items-center justify-content-between border rounded-3 px-3 py-2 h-100">
                                        <span><span className="text-muted me-2">{index + 1}.</span>{name}</span>
                                        <button type="button" className="btn btn-sm btn-outline-danger ms-2" aria-label={`Remove ${name}`} title={`Remove ${name}`} onClick={() => { setPlayers((current) => current.filter((_, i) => i !== index)); setDraw(null); setSelectedFormatId(null); }}>
                                            <i className="bi bi-x-lg" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                    {trimmedPlayers.length >= 4 && formatOptions.length > 0 && (
                        <div className="mt-4">
                            <h3 className="h6 mb-2">Choose a proposed game format</h3>
                            <p className="text-muted small mb-3">BowlPoint shows different combinations that use the maximum number of available players. Select the format you prefer before generating the draw.</p>
                            <div className="row g-2">
                                {formatOptions.map((option, index) => {
                                    const selected = (selectedFormat?.id === option.id);
                                    return (
                                        <div className="col-12 col-md-6 col-xl-4" key={option.id}>
                                            <label className={`border rounded-3 p-3 d-flex gap-2 h-100 ${selected ? 'border-primary bg-primary-subtle' : 'bg-white'}`} style={{ cursor: 'pointer' }}>
                                                <input className="form-check-input mt-1" type="radio" name="quick-draw-format" value={option.id} checked={selected} onChange={() => { setSelectedFormatId(option.id); setDraw(null); }} />
                                                <span>
                                                    <span className="fw-semibold d-block">{formatOptionLabel(option)}</span>
                                                    <span className="small text-muted d-block">{option.sizes.length} game(s) · {option.used} players allocated{option.unused ? ` · ${option.unused} left out` : ''}</span>
                                                    {index === 0 && <span className="badge bg-success mt-2">Recommended</span>}
                                                </span>
                                            </label>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                    <div className="d-flex flex-wrap gap-2 mt-4">
                        <button type="button" className="btn btn-success btn-lg" onClick={generateDraw} disabled={trimmedPlayers.length < 4 || !selectedFormat}>
                            <i className="bi bi-shuffle me-2" />Generate Draw
                        </button>
                        <button type="button" className="btn btn-outline-secondary btn-lg" onClick={() => { setPlayers([]); setEntry(""); setDraw(null); setSelectedFormatId(null); }} disabled={players.length === 0}>
                            Clear Players
                        </button>
                    </div>
                    <div className="form-text mt-2">Game formats: Pairs (4 players), Trips (6 players) and Fours (8 players). The selected combination is randomized when you generate the draw.</div>
                </div>
            </div>

            {draw && (
                <div className="quick-draw-results">
                    <p className="text-muted small mb-3"><i className="bi bi-arrows-move me-1" />Drag players within a team to change their positions, or drag them onto a player in another team to swap them.</p>
                    <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
                        <div>
                            <h2 className="h4 mb-1">Proposed Draw</h2>
                            <p className="text-muted mb-0">{draw.games.length} game(s) • {trimmedPlayers.length - draw.unused.length} players allocated • Format: {formatOptionLabel(formatOptions.find((option) => option.id === draw.formatId) || selectedFormat || { label: {} })}</p>
                        </div>
                        <div className="d-flex gap-2">
                            <button type="button" className="btn btn-outline-primary" onClick={generateDraw}><i className="bi bi-shuffle me-1" />Regenerate</button>
                            <button type="button" className="btn btn-primary" onClick={() => window.print()}><i className="bi bi-printer me-1" />Print Draw</button>
                        </div>
                    </div>
                    {draw.games.map((game) => (
                        <div className="card shadow-sm border-0 mb-3" key={game.id}>
                            <div className="card-header bg-white py-3 d-flex flex-wrap justify-content-between gap-2">
                                <h3 className="h5 mb-0">{game.name}</h3>
                                <span className="badge bg-primary">{game.format}</span>
                            </div>
                            <div className="card-body">
                                <div className="row g-3">
                                    {game.teams.map((team) => (
                                        <div className="col-12 col-md-6" key={team.name}>
                                            <div className="border rounded-3 h-100">
                                                <div className="bg-light fw-semibold px-3 py-2">{team.name}</div>
                                                <ul className="list-group list-group-flush">
                                                    {team.players.map((player, playerIndex) => (
                                                        <li
                                                            className={`list-group-item d-flex justify-content-between align-items-center gap-2 ${draggedPlayer?.gameId === game.id && draggedPlayer?.teamName === team.name && draggedPlayer?.index === playerIndex ? 'opacity-50' : ''}`}
                                                            key={player.name}
                                                            draggable
                                                            onDragStart={(event) => {
                                                                setDraggedPlayer({ gameId: game.id, teamName: team.name, index: playerIndex });
                                                                event.dataTransfer.effectAllowed = 'move';
                                                                event.dataTransfer.setData('text/plain', player.name);
                                                            }}
                                                            onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = 'move'; }}
                                                            onDrop={(event) => { event.preventDefault(); moveDrawPlayer(game.id, team.name, playerIndex); }}
                                                            onDragEnd={() => setDraggedPlayer(null)}
                                                            title="Drag to reorder this team or swap with a player in another team"
                                                            style={{ cursor: 'grab' }}
                                                        >
                                                            <span className="d-flex align-items-center gap-2"><i className="bi bi-grip-vertical text-muted" aria-hidden="true" /><span>{player.name}</span></span>
                                                            <span className="text-muted">{player.position}</span>
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    ))}
                    {draw.unused.length > 0 && (
                        <div className="alert alert-warning">
                            <strong>{draw.unused.length} player(s) not allocated:</strong> {draw.unused.join(", ")}. The current game formats require 4, 6 or 8 players per game.
                        </div>
                    )}
                    <div className="alert alert-info">This is a one-off draw. It is not saved as a Quick Score tournament.</div>
                </div>
            )}
            <style>{`@media print { .sidebar, .quick-draw-page > .card, .quick-draw-page > .d-flex, .quick-draw-page button { display: none !important; } .quick-draw-results { display: block !important; } body { background: white !important; } }`}</style>
        </div>
    );
}
