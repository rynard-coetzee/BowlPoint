-- BowlPoint Competition Skins
-- Adds per-match skin counts to competition fixtures.

ALTER TABLE public.competition_matches
    ADD COLUMN IF NOT EXISTS skins_a integer;

ALTER TABLE public.competition_matches
    ADD COLUMN IF NOT EXISTS skins_b integer;

ALTER TABLE public.competition_matches
    DROP CONSTRAINT IF EXISTS competition_matches_skins_a_nonnegative;

ALTER TABLE public.competition_matches
    ADD CONSTRAINT competition_matches_skins_a_nonnegative
    CHECK (skins_a IS NULL OR skins_a >= 0);

ALTER TABLE public.competition_matches
    DROP CONSTRAINT IF EXISTS competition_matches_skins_b_nonnegative;

ALTER TABLE public.competition_matches
    ADD CONSTRAINT competition_matches_skins_b_nonnegative
    CHECK (skins_b IS NULL OR skins_b >= 0);
