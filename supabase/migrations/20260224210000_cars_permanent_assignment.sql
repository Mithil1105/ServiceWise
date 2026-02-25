-- Add permanent assignment flag and optional note to cars.
-- Vehicles with on_permanent_assignment = true are excluded from booking assignment and check availability.

ALTER TABLE public.cars
  ADD COLUMN IF NOT EXISTS on_permanent_assignment boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS permanent_assignment_note text;

COMMENT ON COLUMN public.cars.on_permanent_assignment IS 'When true, vehicle is not shown in booking vehicle assignment or check availability.';
COMMENT ON COLUMN public.cars.permanent_assignment_note IS 'Optional: who or what this vehicle is assigned to (e.g. driver name, CEO car).';

-- Exclude permanently assigned cars from check_available_cars (booking + availability).
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
  WITH active_cars AS (
    SELECT c.id, c.vehicle_number, c.model, COALESCE(c.seats, 5) as seats,
           COALESCE(c.vehicle_class, 'lmv')::text as vehicle_class
    FROM cars c
    WHERE c.status = 'active'
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
      p.name as booked_by_name
    FROM booking_vehicles bv
    JOIN bookings b ON bv.booking_id = b.id
    LEFT JOIN profiles p ON b.created_by = p.id
    WHERE b.status IN ('inquiry', 'tentative', 'confirmed', 'ongoing')
      AND (p_exclude_booking_id IS NULL OR b.id != p_exclude_booking_id)
      AND (p_start_at < (b.end_at + (p_buffer_minutes || ' minutes')::INTERVAL))
      AND (p_end_at > (b.start_at - (p_buffer_minutes || ' minutes')::INTERVAL))
  )
  SELECT
    ac.id as car_id,
    ac.vehicle_number,
    ac.model,
    ac.seats,
    ac.vehicle_class,
    (cid.car_id IS NULL AND cb.car_id IS NULL) as is_available,
    cb.booking_ref as conflict_booking_ref,
    cb.start_at as conflict_start,
    cb.end_at as conflict_end,
    cb.booked_by_name as conflict_booked_by
  FROM active_cars ac
  LEFT JOIN cars_in_downtime cid ON ac.id = cid.car_id
  LEFT JOIN conflicting_bookings cb ON ac.id = cb.car_id
  WHERE cid.car_id IS NULL
  ORDER BY (cb.car_id IS NULL) DESC, ac.vehicle_number;
END;
$function$;
