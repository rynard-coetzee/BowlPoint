export function getWinner(match) {
    const team1Score = match.team1.score;
    const team2Score = match.team2.score;

    if (team1Score === "" || team2Score === "") {
        return null;
    }

    const score1 = Number(team1Score);
    const score2 = Number(team2Score);

    if (score1 > score2) {
        return match.team1.name;
    }

    if (score2 > score1) {
        return match.team2.name;
    }

    return "Draw";
}