import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";

let workerConfigured = false;

function configurePdfWorker() {
    if (workerConfigured) {
        return;
    }

    pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
        "pdfjs-dist/legacy/build/pdf.worker.mjs",
        import.meta.url
    ).toString();

    workerConfigured = true;
}

function normalizeText(value) {
    return String(value || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-zA-Z0-9]+/g, " ")
        .trim()
        .toLowerCase();
}

function normalizeBsa(value) {
    return String(value || "")
        .replace(/[^0-9]/g, "")
        .trim();
}

function normalizeClubName(value) {
    return normalizeText(value)
        .replace(/\b(bowling|bowls|club)\b/g, "")
        .replace(/\s+/g, "")
        .trim();
}

function normalizeClubCode(value) {
    const code = String(value || "")
        .replace(/[^a-zA-Z0-9]/g, "")
        .toUpperCase();

    const aliases = {
        HOKBC: "HOK",
        ISCOR: "IBC",
        MEYERTON: "MBC",
        RIVERSIDE: "RBC",
        SASOLBURG: "SBC",
        VANDERBIJLPARK: "VDB"
    };

    return aliases[code] || code;
}

const MASTER_CLUB_CODES = new Set([
    "DBC",
    "HOKBC",
    "ISCOR",
    "MEYERTON",
    "RIVERSIDE",
    "SASOLBURG",
    "VANDERBIJLPARK"
]);

const MASTER_CLUB_NAMES_BY_CODE = {
    DBC: "SED Deneysville Bowls Club",
    HOKBC: "SED Henley On Klip Bowling Club",
    ISCOR: "SED Iscor Bowling Club",
    MEYERTON: "SED Meyerton Bowling Club",
    RIVERSIDE: "SED Riverside Bowling Club",
    SASOLBURG: "SED Sasolburg Bowling Club",
    VANDERBIJLPARK: "SED Vanderbijlpark Town Bowling Club"
};

function extractMasterClubCode(line) {
    for (const item of line.items || []) {
        const normalized = String(item.text || "")
            .replace(/[^a-zA-Z0-9]/g, "")
            .toUpperCase();

        if (!normalized) {
            continue;
        }

        const match = [...MASTER_CLUB_CODES]
            .sort((a, b) => b.length - a.length)
            .find(code => normalized === code || normalized.startsWith(code));

        if (match) {
            return match;
        }
    }

    return "";
}


function parseMasterDate(value) {
    const match = String(value || "").match(/^(\d{2})\/(\d{2})\/(\d{4})$/);

    if (!match) {
        return null;
    }

    return `${match[3]}-${match[2]}-${match[1]}`;
}

function splitPlayerName(value) {
    const clean = String(value || "")
        .replace(/\s+/g, " ")
        .trim();

    const commaIndex = clean.indexOf(",");

    if (commaIndex === -1) {
        return {
            last_name: clean,
            first_name: ""
        };
    }

    return {
        last_name: clean.slice(0, commaIndex).trim(),
        first_name: clean.slice(commaIndex + 1).trim()
    };
}

function groupItemsByLine(items) {
    const lines = [];
    const tolerance = 2.5;

    for (const item of items) {
        const text = String(item.str || "").replace(/\s+/g, " ").trim();

        if (!text) {
            continue;
        }

        const x = Number(item.transform?.[4] || 0);
        const y = Number(item.transform?.[5] || 0);

        let line = lines.find(candidate => Math.abs(candidate.y - y) <= tolerance);

        if (!line) {
            line = {
                y,
                items: []
            };
            lines.push(line);
        }

        line.items.push({
            text,
            x
        });
    }

    return lines
        .sort((a, b) => b.y - a.y)
        .map(line => ({
            ...line,
            items: line.items.sort((a, b) => a.x - b.x)
        }));
}

function lineText(line) {
    return line.items
        .map(item => item.text)
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();
}

function isBsaNumber(value) {
    return /^\d{3,7}$/.test(String(value || "").trim());
}

function findField(line, xMin, xMax, pattern) {
    return line.items
        .filter(item => item.x >= xMin && item.x <= xMax)
        .map(item => item.text)
        .find(text => pattern.test(text));
}

function extractPlayerRecords(lines) {
    const records = [];
    const bsaLines = [];

    for (let index = 0; index < lines.length; index += 1) {
        const line = lines[index];
        const bsaItem = line.items.find(item => isBsaNumber(item.text));

        if (bsaItem) {
            bsaLines.push({ index, line, bsaItem });
        }
    }

    for (const entry of bsaLines) {
        const { index, line, bsaItem } = entry;
        const nameParts = line.items
            .filter(item => item.x >= 130 && item.x < bsaItem.x)
            .map(item => item.text);

        if (nameParts.length === 0) {
            continue;
        }

        let playerName = nameParts.join(" ").trim();

        // Long first names can wrap onto the next visual line. The next line
        // usually contains only the continuation of the name in the same
        // column, before the next club/member row begins.
        const nextLine = lines[index + 1];
        if (nextLine) {
            const continuation = nextLine.items
                .filter(item => item.x >= 130 && item.x < bsaItem.x)
                .map(item => item.text)
                .join(" ")
                .trim();

            if (
                continuation &&
                !/^SED$/i.test(continuation) &&
                !/^(Sedibeng|District Members)$/i.test(continuation) &&
                !isBsaNumber(continuation)
            ) {
                playerName = `${playerName} ${continuation}`.replace(/\s+/g, " ").trim();
            }
        }

        // The Bowls SA report has a dedicated Club Class column on the
        // same row as the player. It contains a reliable club identifier
        // such as DBC, HOKBC, Iscor, Meyerton, Riverside, Sasolburg or
        // Vanderbijlpark. Use that identifier first, because the affiliated
        // club name itself can wrap across multiple PDF lines.
        const clubCode = extractMasterClubCode(line);

        // Keep a clean fallback source name for cases where a future report
        // contains a club code we do not yet know. Find the SED club block
        // around the player's row and ignore the table heading.
        const clubLines = [];

        for (let cursor = Math.max(0, index - 3); cursor <= Math.min(lines.length - 1, index + 3); cursor += 1) {
            const part = lines[cursor].items
                .filter(item => item.x >= 75 && item.x < 130)
                .map(item => item.text)
                .join(" ")
                .replace(/\s+/g, " ")
                .trim();

            if (!part || /^Affiliated Club$/i.test(part) || /^Sedibeng$/i.test(part)) {
                continue;
            }

            clubLines.push({ y: lines[cursor].y, text: part });
        }

        const clubText = clubLines
            .filter(item => !/^SED$/i.test(item.text))
            .map(item => item.text)
            .filter(text => !/^Bowls Club$/i.test(text) && !/^Bowling Club$/i.test(text))
            .join(" ")
            .replace(/\s+/g, " ")
            .trim();

        let club = MASTER_CLUB_NAMES_BY_CODE[
            String(clubCode || "")
                .replace(/[^a-zA-Z0-9]/g, "")
                .toUpperCase()
        ] || clubText;

        // Keep the main membership status fields when they are visible on
        // the same line. They are useful in the review screen but are not
        // required to create a BowlPoint player.
        const status = findField(line, 600, 730, /^(Active|Inactive)$/i) || "";
        const registrationDate = findField(line, 690, 800, /^\d{2}\/\d{2}\/\d{4}$/) || "";

        records.push({
            source_name: playerName,
            bsa_number: bsaItem.text.trim(),
            club_name: club,
            club_code: clubCode,
            status,
            registration_date: registrationDate
        });
    }

    const seen = new Set();
    return records.filter(record => {
        const key = normalizeBsa(record.bsa_number);
        if (!key || seen.has(key)) {
            return false;
        }
        seen.add(key);
        return true;
    });
}

async function extractPageRecords(page) {
    const content = await page.getTextContent({
        normalizeWhitespace: true,
        disableCombineTextItems: false
    });

    const lines = groupItemsByLine(content.items || []);
    return extractPlayerRecords(lines);
}

export async function parseMembershipPdf(file) {
    if (!file) {
        throw new Error("Please select a membership PDF.");
    }

    configurePdfWorker();

    const buffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({
        data: new Uint8Array(buffer)
    }).promise;

    const records = [];

    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
        const page = await pdf.getPage(pageNumber);
        const pageRecords = await extractPageRecords(page);

        records.push(
            ...pageRecords.map(record => ({
                ...record,
                page: pageNumber
            }))
        );
    }

    if (records.length === 0) {
        throw new Error(
            "No membership records could be read from this PDF. Please make sure this is the Bowls SA Members Database membership report."
        );
    }

    return records;
}

function findClub(clubs, sourceClubName, sourceClubCode) {
    const sourceNameKey = normalizeClubName(sourceClubName);
    const sourceCodeKey = normalizeClubCode(sourceClubCode);

    if (sourceCodeKey) {
        const codeMatch = (clubs || []).find(club => {
            const shortKey = normalizeClubCode(club.short_name);
            const nameKey = normalizeClubName(club.name);

            return (
                shortKey === sourceCodeKey ||
                nameKey === sourceCodeKey ||
                nameKey.replace(/^sed/, "") === sourceCodeKey
            );
        });

        if (codeMatch) {
            return codeMatch;
        }
    }

    if (!sourceNameKey) {
        return null;
    }

    return (clubs || []).find(club =>
        normalizeClubName(club.name) === sourceNameKey ||
        normalizeClubName(club.short_name) === sourceNameKey
    ) || null;
}


export function reconcileMembership(records, players, clubs) {
    const dbByBsa = new Map();
    const masterByBsa = new Map();

    for (const player of players || []) {
        const bsa = normalizeBsa(player.bsa_number);
        if (bsa) {
            dbByBsa.set(bsa, player);
        }
    }

    for (const record of records || []) {
        const bsa = normalizeBsa(record.bsa_number);
        if (bsa) {
            masterByBsa.set(bsa, record);
        }
    }

    const newPlayers = [];
    const matchedPlayers = [];
    const missingPlayers = [];
    const clubMismatches = [];

    for (const record of records) {
        const bsa = normalizeBsa(record.bsa_number);
        const existing = dbByBsa.get(bsa);
        const club = findClub(clubs, record.club_name, record.club_code);

        if (!existing) {
            newPlayers.push({
                ...record,
                club_name: club?.name || record.club_name,
                club_id: club?.id || null,
                club_match: Boolean(club)
            });
            continue;
        }

        const sameName =
            normalizeText(existing.first_name) === normalizeText(splitPlayerName(record.source_name).first_name) &&
            normalizeText(existing.last_name) === normalizeText(splitPlayerName(record.source_name).last_name);

        const sameClub =
            club && existing.club_id
                ? club.id === existing.club_id
                : normalizeClubName(existing.clubs?.name) === normalizeClubName(record.club_name);

        if (!sameClub) {
            clubMismatches.push({
                ...record,
                club_name: club?.name || record.club_name,
                player: existing,
                club_id: club?.id || null,
                club_match: Boolean(club),
                name_match: sameName
            });
        } else {
            matchedPlayers.push({
                ...record,
                club_name: club?.name || record.club_name,
                player: existing,
                name_match: sameName
            });
        }
    }

    for (const player of players || []) {
        const bsa = normalizeBsa(player.bsa_number);

        if (!bsa || !masterByBsa.has(bsa)) {
            missingPlayers.push(player);
        }
    }

    return {
        newPlayers,
        missingPlayers,
        clubMismatches,
        matchedPlayers,
        masterCount: records.length,
        databaseCount: players.length
    };
}

export function buildPlayerInsert(record) {
    const name = splitPlayerName(record.source_name);

    return {
        first_name: name.first_name,
        last_name: name.last_name,
        club_id: record.club_id,
        bsa_number: normalizeBsa(record.bsa_number) || null,
        date_registered: parseMasterDate(record.registration_date),
        id_number: null,
        nickname: null,
        active: String(record.status || "Active").toLowerCase() === "active"
    };
}
