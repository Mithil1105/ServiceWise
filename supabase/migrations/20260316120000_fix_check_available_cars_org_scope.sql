-- Fix check_available_cars: restore organization scope (lost when 20260224210000 added permanent assignment).
-- The function must BOTH filter by current user's org AND exclude on_permanent_assignment cars.

DROP FUNCTION IF EXISTS public.check_available_cars(timestamp with time zone, timestamp with time zone, integer, uuid);

CREATE OR REPLACE FUNCTION public.check_available_cars(
  p_start_at timestamp with time zone,
  p_end_at timestamp with time zone,
  p_buffer_minutes integer DEFAULT 60,
  p_exclude_booking_id uuid DEFAULT NULL::uuid
)
RETURNS TABLE(
  car_id uuid,
  vehicle_number text,
  model text,
  seats integer,
  vehicle_class text,
  is_available boolean,
  conflict_booking_ref text,
  conflict_start timestamp with time zone,
  conflict_end timestamp with time zone,
  conflict_booked_by text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  WITH my_org AS (
    SELECT public.get_my_org_id() AS id
  ),
  active_cars AS (
    SELECT c.id, c.vehicle_number, c.model, COALESCE(c.seats, 5) AS seats,
           COALESCE(c.vehicle_class, 'lmv')::text AS vehicle_class
    FROM cars c
    CROSS JOIN my_org o
    WHERE c.status = 'active'
      AND o.id IS NOT NULL
      AND c.organization_id = o.id
      AND COALESCE(c.on_permanent_assignment, false) = false
  ),
  cars_in_downtime AS (
    SELECT DISTINCT dl.car_id
    FROM downtime_logs dl
    WHERE dl.started_at <= p_end_at
      AND (dl.ended_at IS NULL OR dl.ended_at >= p_start_at)
  ),
  conflicting_bookings AS (
    SELECT
      bv.car_id,
      b.booking_ref,
      b.start_at,
      b.end_at,
      p.name AS booked_by_name
    FROM booking_vehicles bv
    JOIN bookings b ON bv.booking_id = b.id
    LEFT JOIN profiles p ON b.created_by = p.id
    WHERE b.status IN ('inquiry', 'tentative', 'confirmed', 'ongoing')
      AND (p_exclude_booking_id IS NULL OR b.id != p_exclude_booking_id)
      AND (p_start_at < (b.end_at + (p_buffer_minutes || ' minutes')::INTERVAL))
      AND (p_end_at > (b.start_at - (p_buffer_minutes || ' minutes')::INTERVAL))
  )
  SELECT
    ac.id AS car_id,
    ac.vehicle_number,
    ac.model,
    ac.seats,
    ac.vehicle_class,
    (cid.car_id IS NULL AND cb.car_id IS NULL) AS is_available,
    cb.booking_ref AS conflict_booking_ref,
    cb.start_at AS conflict_start,
    cb.end_at AS conflict_end,
    cb.booked_by_name AS conflict_booked_by
  FROM active_cars ac
  LEFT JOIN cars_in_downtime cid ON ac.id = cid.car_id
  LEFT JOIN conflicting_bookings cb ON ac.id = cb.car_id
  WHERE cid.car_id IS NULL
  ORDER BY (cb.car_id IS NULL) DESC, ac.vehicle_number;
END;
$function$;

COMMENT ON FUNCTION public.check_available_cars IS 'Returns available cars for date range, scoped to current user organization. Excludes permanently assigned vehicles.';
