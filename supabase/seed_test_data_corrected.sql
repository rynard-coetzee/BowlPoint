-- BowlPoint TEST DATA SEED
-- Safe test data only. All records are clearly prefixed TEST -.
-- This version does NOT insert players.display_name because it is a generated column.

BEGIN;

-- Test clubs
INSERT INTO public.clubs (name, short_name, active)
VALUES
    ('TEST - Henley Bowling Club', 'TEST-HEN', true),
    ('TEST - Riverside Bowling Club', 'TEST-RIV', true),
    ('TEST - Lakeside Bowling Club', 'TEST-LAK', true),
    ('TEST - Central Bowling Club', 'TEST-CEN', true),
    ('TEST - Parkview Bowling Club', 'TEST-PAR', true),
    ('TEST - Northside Bowling Club', 'TEST-NOR', true),
    ('TEST - Southern Bowling Club', 'TEST-SOU', true),
    ('TEST - Eastside Bowling Club', 'TEST-EAS', true);

-- Test players
-- 16 players per club = 128 players.
DO $$
DECLARE
    club_rec RECORD;
    player_no INTEGER;
BEGIN
    FOR club_rec IN
        SELECT id, name
        FROM public.clubs
        WHERE name LIKE 'TEST - %'
        ORDER BY name
    LOOP
        FOR player_no IN 1..16 LOOP
            INSERT INTO public.players (first_name, last_name, club_id, active)
            VALUES (
                'Test',
                format('%s Player %s', replace(club_rec.name, 'TEST - ', ''), lpad(player_no::text, 2, '0')),
                club_rec.id,
                true
            );
        END LOOP;
    END LOOP;
END $$;

COMMIT;

-- Verify:
SELECT COUNT(*) AS test_clubs FROM public.clubs WHERE name LIKE 'TEST - %';
SELECT COUNT(*) AS test_players
FROM public.players
WHERE first_name = 'Test'
  AND last_name LIKE '% Player %';

-- NOTE:
-- The optional 32-team competition population is intentionally omitted here.
-- We will populate a specific competition after you create it in BowlPoint,
-- so the seed cannot accidentally attach test teams to the wrong competition.