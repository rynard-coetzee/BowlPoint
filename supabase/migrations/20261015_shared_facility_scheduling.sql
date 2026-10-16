-- BowlPoint shared club / green / rink scheduling foundation.
-- Safe to run once in the Supabase SQL Editor.

CREATE TABLE IF NOT EXISTS public.club_greens (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE RESTRICT,
    name text NOT NULL,
    active boolean NOT NULL DEFAULT true,
    allows_direction_change boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT club_greens_name_nonblank CHECK (length(trim(name)) > 0),
    CONSTRAINT club_greens_unique_name_per_club UNIQUE (club_id, name)
);

CREATE INDEX IF NOT EXISTS idx_club_greens_club_active
    ON public.club_greens (club_id, active);

CREATE TABLE IF NOT EXISTS public.green_rinks (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    green_id uuid NOT NULL REFERENCES public.club_greens(id) ON DELETE RESTRICT,
    label text NOT NULL,
    active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT green_rinks_label_nonblank CHECK (length(trim(label)) > 0),
    CONSTRAINT green_rinks_unique_label_per_green UNIQUE (green_id, label)
);

CREATE INDEX IF NOT EXISTS idx_green_rinks_green_active
    ON public.green_rinks (green_id, active);

-- A booking is one fixture's use of a physical rink during a time window.
-- competition_id and match_id are deliberately UUID references without FKs here
-- so this migration remains compatible with existing competition schema variants.
CREATE TABLE IF NOT EXISTS public.facility_bookings (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    competition_id uuid,
    match_id uuid,
    green_id uuid NOT NULL REFERENCES public.club_greens(id) ON DELETE RESTRICT,
    rink_id uuid NOT NULL REFERENCES public.green_rinks(id) ON DELETE RESTRICT,
    playing_date date NOT NULL,
    session_name text NOT NULL DEFAULT 'Morning',
    starts_at timestamptz NOT NULL,
    ends_at timestamptz NOT NULL,
    direction smallint NOT NULL DEFAULT 1,
    status text NOT NULL DEFAULT 'confirmed',
    notes text,
    created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT facility_bookings_valid_time CHECK (ends_at > starts_at),
    CONSTRAINT facility_bookings_valid_direction CHECK (direction IN (1, 2)),
    CONSTRAINT facility_bookings_valid_status CHECK (status IN ('tentative', 'confirmed', 'cancelled'))
);

CREATE INDEX IF NOT EXISTS idx_facility_bookings_date_status
    ON public.facility_bookings (playing_date, status);
CREATE INDEX IF NOT EXISTS idx_facility_bookings_competition
    ON public.facility_bookings (competition_id, playing_date);
CREATE INDEX IF NOT EXISTS idx_facility_bookings_green_time
    ON public.facility_bookings (green_id, starts_at, ends_at)
    WHERE status <> 'cancelled';
CREATE INDEX IF NOT EXISTS idx_facility_bookings_rink_time
    ON public.facility_bookings (rink_id, starts_at, ends_at)
    WHERE status <> 'cancelled';

-- Keep updated_at current on edits.
CREATE OR REPLACE FUNCTION public.set_facility_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at := now();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_club_greens_updated_at ON public.club_greens;
CREATE TRIGGER trg_club_greens_updated_at
BEFORE UPDATE ON public.club_greens
FOR EACH ROW EXECUTE FUNCTION public.set_facility_updated_at();

DROP TRIGGER IF EXISTS trg_green_rinks_updated_at ON public.green_rinks;
CREATE TRIGGER trg_green_rinks_updated_at
BEFORE UPDATE ON public.green_rinks
FOR EACH ROW EXECUTE FUNCTION public.set_facility_updated_at();

DROP TRIGGER IF EXISTS trg_facility_bookings_updated_at ON public.facility_bookings;
CREATE TRIGGER trg_facility_bookings_updated_at
BEFORE UPDATE ON public.facility_bookings
FOR EACH ROW EXECUTE FUNCTION public.set_facility_updated_at();

-- Direction 1 uses one individual rink at a time; separate rinks may operate
-- concurrently in Direction 1. Direction 2 crosses the green, so it occupies
-- the whole green and must not overlap any other direction on that green.
-- Serialize writes per green to prevent concurrent double-booking races.
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
              -- perpendicular direction occupies the full green
              NEW.direction = 2 OR b.direction = 2
              -- in lengthwise direction, only the same physical rink conflicts
              OR b.rink_id = NEW.rink_id
          )
    ) THEN
        RAISE EXCEPTION 'Facility conflict: this green/rink is already booked for an overlapping time. Check other BowlPoint competitions.'
            USING ERRCODE = '23P01';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_facility_booking ON public.facility_bookings;
CREATE TRIGGER trg_validate_facility_booking
BEFORE INSERT OR UPDATE OF green_id, rink_id, starts_at, ends_at, direction, status
ON public.facility_bookings
FOR EACH ROW EXECUTE FUNCTION public.validate_facility_booking();

-- RLS: signed-in users can view shared facilities; only active admin/comp secretary
-- profiles can manage facility configuration and bookings.
ALTER TABLE public.club_greens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.green_rinks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.facility_bookings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view club greens" ON public.club_greens;
CREATE POLICY "Authenticated users can view club greens"
ON public.club_greens FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Facility managers can insert club greens" ON public.club_greens;
CREATE POLICY "Facility managers can insert club greens"
ON public.club_greens FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.active = true AND p.role IN ('admin', 'comp_secretary')));
DROP POLICY IF EXISTS "Facility managers can update club greens" ON public.club_greens;
CREATE POLICY "Facility managers can update club greens"
ON public.club_greens FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.active = true AND p.role IN ('admin', 'comp_secretary')))
WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.active = true AND p.role IN ('admin', 'comp_secretary')));

DROP POLICY IF EXISTS "Authenticated users can view green rinks" ON public.green_rinks;
CREATE POLICY "Authenticated users can view green rinks"
ON public.green_rinks FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Facility managers can insert green rinks" ON public.green_rinks;
CREATE POLICY "Facility managers can insert green rinks"
ON public.green_rinks FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.active = true AND p.role IN ('admin', 'comp_secretary')));
DROP POLICY IF EXISTS "Facility managers can update green rinks" ON public.green_rinks;
CREATE POLICY "Facility managers can update green rinks"
ON public.green_rinks FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.active = true AND p.role IN ('admin', 'comp_secretary')))
WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.active = true AND p.role IN ('admin', 'comp_secretary')));

DROP POLICY IF EXISTS "Authenticated users can view facility bookings" ON public.facility_bookings;
CREATE POLICY "Authenticated users can view facility bookings"
ON public.facility_bookings FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Facility managers can insert facility bookings" ON public.facility_bookings;
CREATE POLICY "Facility managers can insert facility bookings"
ON public.facility_bookings FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.active = true AND p.role IN ('admin', 'comp_secretary')));
DROP POLICY IF EXISTS "Facility managers can update facility bookings" ON public.facility_bookings;
CREATE POLICY "Facility managers can update facility bookings"
ON public.facility_bookings FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.active = true AND p.role IN ('admin', 'comp_secretary')))
WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.active = true AND p.role IN ('admin', 'comp_secretary')));
DROP POLICY IF EXISTS "Facility managers can delete facility bookings" ON public.facility_bookings;
CREATE POLICY "Facility managers can delete facility bookings"
ON public.facility_bookings FOR DELETE TO authenticated
USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.active = true AND p.role IN ('admin', 'comp_secretary')));

GRANT SELECT ON public.club_greens, public.green_rinks, public.facility_bookings TO authenticated;
GRANT INSERT, UPDATE ON public.club_greens, public.green_rinks, public.facility_bookings TO authenticated;
GRANT DELETE ON public.facility_bookings TO authenticated;
