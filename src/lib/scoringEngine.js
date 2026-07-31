export function isCompleted(match) {

    return match.completed;

}

export function isDraw(match) {

    return (
        match.completed &&
        match.scoreA === match.scoreB
    );

}

export function getWinner(match) {

    if (!match.completed) {
        return null;
    }

    if (match.scoreA > match.scoreB) {
        return match.teamA;
    }

    if (match.scoreB > match.scoreA) {
        return match.teamB;
    }

    return null;

}

export function getLoser(match) {

    if (!match.completed) {
        return null;
    }

    if (match.scoreA > match.scoreB) {
        return match.teamB;
    }

    if (match.scoreB > match.scoreA) {
        return match.teamA;
    }

    return null;

}

export function getTeamMatchPoints(
    match,
    teamId,
    scoring
) {

    if (!match.completed) {
        return 0;
    }

    let points = 0;

    if (isDraw(match)) {

        points += scoring.win / 2;

    } else {

        const winner = getWinner(match);

        if (winner.id === teamId) {
            points += scoring.win;
        }

    }

    if (scoring.skins.enabled) {

        if (teamId === match.teamA.id) {

            points +=
                (match.skinsA ?? 0) *
                scoring.skins.pointsPerSkin;

        } else {

            points +=
                (match.skinsB ?? 0) *
                scoring.skins.pointsPerSkin;

        }

    }

    return points;

}