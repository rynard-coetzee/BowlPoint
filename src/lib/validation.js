export function hasTournamentName(tournament) {
    return tournament.name.trim().length > 0;
}

export function hasEnoughTeams(tournament) {
    return tournament.teams.length >= 2;
}

export function hasEvenTeams(tournament) {
    return tournament.teams.length % 2 === 0;
}

export function hasDuplicateTeams(tournament) {

    const names = tournament.teams.map(team =>
        team.name.trim().toLowerCase()
    );

    return new Set(names).size !== names.length;
}

export function canGenerateTournament(tournament) {

    return (
        hasTournamentName(tournament) &&
        hasEnoughTeams(tournament) &&
        !hasDuplicateTeams(tournament)
    );

}