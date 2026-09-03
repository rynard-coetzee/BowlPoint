-- BowlPoint TEST DATA CLEANUP
-- Removes ONLY records whose names/display names start with "TEST - "
-- or "Test### Player".
--
-- Run this after testing.
--
-- The order matters because BowlPoint has foreign keys between competition
-- data, teams, players and clubs.

BEGIN;

-- Delete test competition match-player rows first.
DELETE FROM public.competition_match_players cmp
WHERE EXISTS (
    SELECT 1
    FROM public.competition_matches cm
    JOIN public.competitions c
      ON c.id = cm.competition_id
    WHERE cm.id = cmp.match_id
      AND c.name LIKE 'TEST - %'
);

-- Delete test competition matches.
DELETE FROM public.competition_matches cm
WHERE EXISTS (
    SELECT 1
    FROM public.competitions c
    WHERE c.id = cm.competition_id
      AND c.name LIKE 'TEST - %'
);

-- Delete test competition section/team links.
DELETE FROM public.competition_section_teams cst
WHERE EXISTS (
    SELECT 1
    FROM public.competition_sections cs
    JOIN public.competitions c
      ON c.id = cs.competition_id
    WHERE cs.id = cst.section_id
      AND c.name LIKE 'TEST - %'
);

-- Delete test competition team players.
DELETE FROM public.competition_team_players ctp
WHERE EXISTS (
    SELECT 1
    FROM public.competition_teams ct
    WHERE ct.id = ctp.competition_team_id
      AND ct.team_name LIKE 'TEST - %'
);

-- Delete test competition teams.
DELETE FROM public.competition_teams ct
WHERE ct.team_name LIKE 'TEST - %';

-- Delete test competition rounds.
DELETE FROM public.competition_rounds cr
WHERE EXISTS (
    SELECT 1
    FROM public.competitions c
    WHERE c.id = cr.competition_id
      AND c.name LIKE 'TEST - %'
);

-- Delete test competition days.
DELETE FROM public.competition_days cd
WHERE EXISTS (
    SELECT 1
    FROM public.competitions c
    WHERE c.id = cd.competition_id
      AND c.name LIKE 'TEST - %'
);

-- Delete test participating-club links.
DELETE FROM public.competition_clubs cc
WHERE EXISTS (
    SELECT 1
    FROM public.competitions c
    WHERE c.id = cc.competition_id
      AND c.name LIKE 'TEST - %'
);

-- Delete test competitions themselves.
DELETE FROM public.competitions
WHERE name LIKE 'TEST - %';

-- Delete seeded test players.
DELETE FROM public.players
WHERE display_name LIKE 'Test% Player'
   OR first_name LIKE 'Test%'
   OR last_name = 'Player';

-- Delete seeded test clubs.
DELETE FROM public.clubs
WHERE name LIKE 'TEST - %';

COMMIT;
