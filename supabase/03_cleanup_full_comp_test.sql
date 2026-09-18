-- BowlPoint Full Competition TEST cleanup
-- Removes TEST teams and their competition data for one competition.
-- Global TEST clubs/players are retained for reuse.

BEGIN;

DO $$
DECLARE v_competition_id uuid := 'PUT-YOUR-COMPETITION-UUID-HERE';
BEGIN
  DELETE FROM public.competition_match_players
  WHERE match_id IN (SELECT id FROM public.competition_matches WHERE competition_id=v_competition_id);

  DELETE FROM public.competition_matches
  WHERE competition_id=v_competition_id;

  DELETE FROM public.competition_rounds
  WHERE competition_id=v_competition_id;

  DELETE FROM public.competition_section_teams
  WHERE section_id IN (
    SELECT id FROM public.competition_sections WHERE competition_id=v_competition_id
  );

  DELETE FROM public.competition_sections
  WHERE competition_id=v_competition_id;

  DELETE FROM public.competition_team_players
  WHERE competition_team_id IN (
    SELECT id FROM public.competition_teams
    WHERE competition_id=v_competition_id AND team_name LIKE 'TEST - Team %'
  );

  DELETE FROM public.competition_teams
  WHERE competition_id=v_competition_id AND team_name LIKE 'TEST - Team %';

  DELETE FROM public.competition_clubs
  WHERE competition_id=v_competition_id
    AND club_id IN (SELECT id FROM public.clubs WHERE name LIKE 'TEST - Club %');

  RAISE NOTICE 'TEST competition data removed.';
END $$;

COMMIT;
