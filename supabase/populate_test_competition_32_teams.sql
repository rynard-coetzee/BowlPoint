-- BowlPoint TEST: populate an existing competition with 32 test teams
-- Competition:
-- 3bf616b3-d634-466a-af93-c97fb2fd28fe
--
-- Assumptions confirmed from the current BowlPoint schema:
--   competition_clubs links clubs to competitions
--   competition_teams stores the competition teams
--   competition_team_players stores player assignments
--   players.display_name is GENERATED, so it is never inserted.
--
-- This script:
--   1. Adds existing TEST - ... clubs to the competition.
--   2. Creates 32 test four-player competition teams.
--   3. Uses 4 teams per test club.
--   4. Uses unique seeded players for every team.
--   5. Does not touch non-TEST clubs/teams.
--   6. Can be run repeatedly without creating another set of 32 teams.

BEGIN;

DO $$
DECLARE
    v_competition_id uuid := '3bf616b3-d634-466a-af93-c97fb2fd28fe';
    v_club record;
    v_player_ids uuid[];
    v_player_offset integer := 0;
    v_team_number integer;
    v_team_id uuid;
    v_team_name text;
    v_existing_count integer;
    v_club_count integer;
    v_player_count integer;
    v_club_index integer := 0;
    v_team_index integer;
    v_team_in_club integer;
BEGIN

    -- Confirm the competition exists.
    IF NOT EXISTS (
        SELECT 1
        FROM public.competitions
        WHERE id = v_competition_id
    ) THEN
        RAISE EXCEPTION
            'Competition % does not exist.',
            v_competition_id;
    END IF;

    -- Confirm this is a Fours competition.
    IF EXISTS (
        SELECT 1
        FROM public.competitions
        WHERE id = v_competition_id
          AND format <> 'fours'
    ) THEN
        RAISE EXCEPTION
            'Competition % is not configured as Fours.',
            v_competition_id;
    END IF;

    -- Count the seeded clubs.
    SELECT COUNT(*)
    INTO v_club_count
    FROM public.clubs
    WHERE name LIKE 'TEST - %';

    IF v_club_count < 8 THEN
        RAISE EXCEPTION
            'Expected at least 8 TEST clubs, found %.',
            v_club_count;
    END IF;

    -- Count the seeded players.
    SELECT COUNT(*)
    INTO v_player_count
    FROM public.players p
    JOIN public.clubs c ON c.id = p.club_id
    WHERE c.name LIKE 'TEST - %'
      AND p.first_name = 'Test';

    IF v_player_count < 128 THEN
        RAISE EXCEPTION
            'Expected at least 128 TEST players, found %.',
            v_player_count;
    END IF;

    ----------------------------------------------------------------------
    -- 1. Add the first 8 TEST clubs to this competition.
    ----------------------------------------------------------------------
    INSERT INTO public.competition_clubs (
        competition_id,
        club_id
    )
    SELECT
        v_competition_id,
        c.id
    FROM public.clubs c
    WHERE c.name LIKE 'TEST - %'
    ORDER BY c.name
    LIMIT 8
    ON CONFLICT DO NOTHING;

    ----------------------------------------------------------------------
    -- 2. Do not create duplicate test teams if they already exist.
    ----------------------------------------------------------------------
    SELECT COUNT(*)
    INTO v_existing_count
    FROM public.competition_teams ct
    WHERE ct.competition_id = v_competition_id
      AND ct.team_name LIKE 'TEST - Team %';

    IF v_existing_count > 0 THEN
        RAISE NOTICE
            'Found % existing TEST teams in this competition. No new teams created.',
            v_existing_count;
        RETURN;
    END IF;

    ----------------------------------------------------------------------
    -- 3. Create 32 teams.
    --
    -- 8 clubs x 4 teams.
    -- 4 players per team.
    -- 128 unique seeded players.
    ----------------------------------------------------------------------
    FOR v_club IN
        SELECT
            c.id,
            c.name,
            row_number() OVER (ORDER BY c.name)::integer AS club_no
        FROM public.clubs c
        WHERE c.name LIKE 'TEST - %'
        ORDER BY c.name
        LIMIT 8
    LOOP

        v_club_index := v_club.club_no;

        -- Get exactly 16 seeded players for this club.
        SELECT ARRAY_AGG(p.id ORDER BY p.id)
        INTO v_player_ids
        FROM (
            SELECT p.id
            FROM public.players p
            WHERE p.club_id = v_club.id
              AND p.first_name = 'Test'
            ORDER BY p.id
            LIMIT 16
        ) p;

        IF COALESCE(array_length(v_player_ids, 1), 0) < 16 THEN
            RAISE EXCEPTION
                'Club % does not have 16 seeded TEST players.',
                v_club.name;
        END IF;

        FOR v_team_in_club IN 1..4 LOOP

            v_team_index :=
                ((v_club_index - 1) * 4) + v_team_in_club;

            v_team_number := v_team_index;

            v_team_name :=
                format(
                    'TEST - Team %s',
                    lpad(v_team_number::text, 2, '0')
                );

            INSERT INTO public.competition_teams (
                competition_id,
                club_id,
                team_number,
                team_name,
                status
            )
            VALUES (
                v_competition_id,
                v_club.id,
                v_team_number,
                v_team_name,
                'active'
            )
            RETURNING id INTO v_team_id;

            -- Each club contributes 16 players:
            -- 4 players x 4 teams.
            INSERT INTO public.competition_team_players (
                competition_team_id,
                player_id,
                position,
                position_order
            )
            VALUES
                (
                    v_team_id,
                    v_player_ids[((v_team_in_club - 1) * 4) + 1],
                    'lead',
                    1
                ),
                (
                    v_team_id,
                    v_player_ids[((v_team_in_club - 1) * 4) + 2],
                    'second',
                    2
                ),
                (
                    v_team_id,
                    v_player_ids[((v_team_in_club - 1) * 4) + 3],
                    'third',
                    3
                ),
                (
                    v_team_id,
                    v_player_ids[((v_team_in_club - 1) * 4) + 4],
                    'skip',
                    4
                );

        END LOOP;
    END LOOP;

    RAISE NOTICE
        'Created 32 TEST teams with 128 unique TEST players.';

END $$;

COMMIT;


-- -------------------------------------------------------------------------
-- Verification
-- -------------------------------------------------------------------------

-- Test clubs participating in this competition.
SELECT
    c.name AS club,
    COUNT(ct.id) AS teams
FROM public.competition_clubs cc
JOIN public.clubs c
    ON c.id = cc.club_id
LEFT JOIN public.competition_teams ct
    ON ct.competition_id = cc.competition_id
   AND ct.club_id = cc.club_id
WHERE cc.competition_id =
    '3bf616b3-d634-466a-af93-c97fb2fd28fe'
  AND c.name LIKE 'TEST - %'
GROUP BY c.id, c.name
ORDER BY c.name;


-- Total TEST teams.
SELECT COUNT(*) AS test_teams
FROM public.competition_teams
WHERE competition_id =
    '3bf616b3-d634-466a-af93-c97fb2fd28fe'
  AND team_name LIKE 'TEST - Team %';


-- Total TEST player assignments.
SELECT COUNT(*) AS test_player_assignments
FROM public.competition_team_players ctp
JOIN public.competition_teams ct
    ON ct.id = ctp.competition_team_id
WHERE ct.competition_id =
    '3bf616b3-d634-466a-af93-c97fb2fd28fe'
  AND ct.team_name LIKE 'TEST - Team %';


-- Full team list.
SELECT
    ct.team_number,
    ct.team_name,
    c.name AS club,
    COUNT(ctp.player_id) AS players
FROM public.competition_teams ct
JOIN public.clubs c
    ON c.id = ct.club_id
LEFT JOIN public.competition_team_players ctp
    ON ctp.competition_team_id = ct.id
WHERE ct.competition_id =
    '3bf616b3-d634-466a-af93-c97fb2fd28fe'
  AND ct.team_name LIKE 'TEST - Team %'
GROUP BY ct.id, ct.team_number, ct.team_name, c.name
ORDER BY ct.team_number;
