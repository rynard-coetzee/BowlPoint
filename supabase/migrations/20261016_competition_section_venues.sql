-- Persist a single host club for each section in a competition.
-- Apply in Supabase SQL Editor before using the Section Host Clubs controls.

CREATE TABLE IF NOT EXISTS public.competition_section_venues (
    competition_id uuid NOT NULL,
    section_id uuid NOT NULL REFERENCES public.competition_sections(id) ON DELETE CASCADE,
    club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE RESTRICT,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (competition_id, section_id)
);

CREATE INDEX IF NOT EXISTS idx_competition_section_venues_club
    ON public.competition_section_venues (club_id);

ALTER TABLE public.competition_section_venues ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view section host clubs" ON public.competition_section_venues;
CREATE POLICY "Authenticated users can view section host clubs"
ON public.competition_section_venues
FOR SELECT TO authenticated
USING (true);

DROP POLICY IF EXISTS "Competition managers can insert section host clubs" ON public.competition_section_venues;
CREATE POLICY "Competition managers can insert section host clubs"
ON public.competition_section_venues
FOR INSERT TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid()
          AND p.active = true
          AND p.role IN ('admin', 'comp_secretary')
    )
);

DROP POLICY IF EXISTS "Competition managers can update section host clubs" ON public.competition_section_venues;
CREATE POLICY "Competition managers can update section host clubs"
ON public.competition_section_venues
FOR UPDATE TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid()
          AND p.active = true
          AND p.role IN ('admin', 'comp_secretary')
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid()
          AND p.active = true
          AND p.role IN ('admin', 'comp_secretary')
    )
);

DROP POLICY IF EXISTS "Competition managers can delete section host clubs" ON public.competition_section_venues;
CREATE POLICY "Competition managers can delete section host clubs"
ON public.competition_section_venues
FOR DELETE TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid()
          AND p.active = true
          AND p.role IN ('admin', 'comp_secretary')
    )
);

-- Correct same-session capacity: each of the six rinks can host one game in either direction.
-- Opposite directions still conflict because the lanes cross the same green.
CREATE OR REPLACE FUNCTION public.validate_facility_booking()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    v_rink_green_id uuid;
    v_rink_active boolean;
    v_green_active boolean;
    v_green_allows_direction_change boolean;
BEGIN
    SELECT r.green_id, r.active INTO v_rink_green_id, v_rink_active
    FROM public.green_rinks r
    WHERE r.id = NEW.rink_id;

    IF v_rink_green_id IS NULL THEN
        RAISE EXCEPTION 'Selected rink does not exist.' USING ERRCODE = '23503';
    END IF;

    IF NOT COALESCE(v_rink_active, false) THEN
        RAISE EXCEPTION 'Selected rink is marked unavailable.' USING ERRCODE = '23514';
    END IF;

    IF v_rink_green_id <> NEW.green_id THEN
        RAISE EXCEPTION 'Selected rink does not belong to the selected green.' USING ERRCODE = '23514';
    END IF;

    SELECT g.allows_direction_change, g.active INTO v_green_allows_direction_change, v_green_active
    FROM public.club_greens g
    WHERE g.id = NEW.green_id;

    IF NOT COALESCE(v_green_active, false) THEN
        RAISE EXCEPTION 'Selected green is marked unavailable.' USING ERRCODE = '23514';
    END IF;

    IF NEW.direction = 2 AND NOT COALESCE(v_green_allows_direction_change, false) THEN
        RAISE EXCEPTION 'This green is not configured for perpendicular direction changes.' USING ERRCODE = '23514';
    END IF;

    -- Lock key serializes allocation attempts for this green across sessions/competitions.
    PERFORM pg_advisory_xact_lock(hashtextextended(NEW.green_id::text, 0));

    IF NEW.status <> 'cancelled' AND EXISTS (
        SELECT 1
        FROM public.facility_bookings b
        WHERE b.green_id = NEW.green_id
          AND b.status <> 'cancelled'
          AND b.id IS DISTINCT FROM NEW.id
          AND b.starts_at < NEW.ends_at
          AND NEW.starts_at < b.ends_at
          AND (
              -- A direction change conflicts with every lane on that green;
              -- within the same direction, only the same physical lane conflicts.
              NEW.direction <> b.direction
              OR b.rink_id = NEW.rink_id
          )
    ) THEN
        RAISE EXCEPTION 'Facility conflict: this green/rink is already booked for an overlapping time. Check other BowlPoint competitions.'
            USING ERRCODE = '23P01';
    END IF;

    RETURN NEW;
END;
$$;

