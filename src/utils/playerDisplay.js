/*
 * Centralised player display name for BowlPoint competition pages.
 *
 * If a nickname is configured, BowlPoint displays:
 *     Nickname Surname
 * Otherwise it falls back to the player's normal name.
 *
 * display_name remains the database/legal full-name value and is only used
 * as a final fallback for older records.
 */
export function getPlayerDisplayName(player) {
    if (!player) return "";

    const nickname = String(player.nickname || "").trim();
    const firstName = String(player.first_name || "").trim();
    const lastName = String(player.last_name || "").trim();

    const givenName = nickname || firstName;
    const name = `${givenName} ${lastName}`.trim();

    if (name) return name;

    return String(player.display_name || "").trim();
}
