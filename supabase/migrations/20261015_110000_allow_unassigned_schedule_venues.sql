-- BowlPoint schedule workflow: venue is allocated per match after dates are saved.
-- Safe to run after the shared facility scheduling migrations.
-- This does not alter existing draws, rounds, scores, or facility bookings.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'competition_days'
      AND column_name = 'venue_club_id'
  ) THEN
    ALTER TABLE public.competition_days
      ALTER COLUMN venue_club_id DROP NOT NULL;
  END IF;
END
$$;
