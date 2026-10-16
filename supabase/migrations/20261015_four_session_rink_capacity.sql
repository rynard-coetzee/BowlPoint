-- BowlPoint: support six lanes in each direction across four daily sessions.
-- Same-direction games may use different rinks concurrently. Perpendicular
-- directions must not overlap because their playing areas cross on the green.
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

    SELECT g.allows_direction_change, g.active
      INTO v_green_allows_direction_change, v_green_active
    FROM public.club_greens g
    WHERE g.id = NEW.green_id;

    IF NOT COALESCE(v_green_active, false) THEN
        RAISE EXCEPTION 'Selected green is marked unavailable.' USING ERRCODE = '23514';
    END IF;

    IF NEW.direction = 2 AND NOT COALESCE(v_green_allows_direction_change, false) THEN
        RAISE EXCEPTION 'This green is not configured for perpendicular direction changes.' USING ERRCODE = '23514';
    END IF;

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
              -- Crosswise and lengthwise lanes intersect: different directions
              -- cannot overlap, even if their rink labels differ.
              b.direction <> NEW.direction
              -- Within one direction, only the same lane conflicts.
              OR b.rink_id = NEW.rink_id
          )
    ) THEN
        RAISE EXCEPTION 'Facility conflict: this green/rink is already booked for an overlapping time. Check other BowlPoint competitions.'
            USING ERRCODE = '23P01';
    END IF;

    RETURN NEW;
END;
$$;
