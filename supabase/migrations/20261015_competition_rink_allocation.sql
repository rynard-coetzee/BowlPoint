-- BowlPoint Stage 2: atomic save for match-level rink allocations.
-- Run after 20261015_shared_facility_scheduling.sql.
-- Replaces only bookings for match IDs included in the submitted allocation batch.
-- Any conflict raised by validate_facility_booking aborts the whole transaction.

CREATE OR REPLACE FUNCTION public.save_competition_facility_bookings(
    p_competition_id uuid,
    p_bookings jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_booking jsonb;
    v_match_id uuid;
BEGIN
    IF auth.uid() IS NULL OR NOT EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid()
          AND p.active = true
          AND p.role IN ('admin', 'comp_secretary')
    ) THEN
        RAISE EXCEPTION 'You do not have permission to allocate competition facilities.' USING ERRCODE = '42501';
    END IF;

    IF p_competition_id IS NULL OR jsonb_typeof(p_bookings) IS DISTINCT FROM 'array' THEN
        RAISE EXCEPTION 'A competition ID and an array of bookings are required.' USING ERRCODE = '22023';
    END IF;

    -- Validate IDs before deleting anything. The transaction still rolls back on any error.
    FOR v_booking IN SELECT value FROM jsonb_array_elements(p_bookings)
    LOOP
        IF NULLIF(v_booking->>'match_id', '') IS NULL
           OR NULLIF(v_booking->>'green_id', '') IS NULL
           OR NULLIF(v_booking->>'rink_id', '') IS NULL
           OR NULLIF(v_booking->>'starts_at', '') IS NULL
           OR NULLIF(v_booking->>'ends_at', '') IS NULL
           OR NULLIF(v_booking->>'playing_date', '') IS NULL THEN
            RAISE EXCEPTION 'Each booking must include match, green, rink, date and time fields.' USING ERRCODE = '22023';
        END IF;
    END LOOP;

    DELETE FROM public.facility_bookings fb
    WHERE fb.competition_id = p_competition_id
      AND fb.match_id IN (
        SELECT (value->>'match_id')::uuid
        FROM jsonb_array_elements(p_bookings)
      );

    FOR v_booking IN SELECT value FROM jsonb_array_elements(p_bookings)
    LOOP
        INSERT INTO public.facility_bookings (
            competition_id, match_id, green_id, rink_id, playing_date,
            session_name, starts_at, ends_at, direction, status, notes, created_by
        ) VALUES (
            p_competition_id,
            (v_booking->>'match_id')::uuid,
            (v_booking->>'green_id')::uuid,
            (v_booking->>'rink_id')::uuid,
            (v_booking->>'playing_date')::date,
            COALESCE(NULLIF(v_booking->>'session_name', ''), 'Morning'),
            (v_booking->>'starts_at')::timestamptz,
            (v_booking->>'ends_at')::timestamptz,
            COALESCE((v_booking->>'direction')::smallint, 1),
            COALESCE(NULLIF(v_booking->>'status', ''), 'confirmed'),
            NULLIF(v_booking->>'notes', ''),
            auth.uid()
        );
    END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.save_competition_facility_bookings(uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_competition_facility_bookings(uuid, jsonb) TO authenticated;
