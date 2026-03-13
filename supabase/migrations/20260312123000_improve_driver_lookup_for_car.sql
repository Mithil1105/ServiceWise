-- Improve driver lookup for incidents & traffic challans.
-- Fallback: if no booking covers the exact incident time, use the most recent booking
-- for that car (any status) so driver name/phone can still be auto-filled.

CREATE OR REPLACE FUNCTION public.get_driver_for_car_at_time(p_car_id uuid, p_at timestamptz)
RETURNS TABLE (driver_name text, driver_phone text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- First preference: booking active at the given time, with confirmed/ongoing status
  -- Fallback: latest booking for this car when none matches the exact time window.
  RETURN QUERY
  SELECT driver_name, driver_phone
  FROM (
    SELECT
      bv.driver_name::text AS driver_name,
      bv.driver_phone::text AS driver_phone,
      1 AS sort_priority,
      b.end_at
    FROM booking_vehicles bv
    JOIN bookings b ON b.id = bv.booking_id
    WHERE bv.car_id = p_car_id
      AND b.start_at <= p_at
      AND b.end_at >= p_at
      AND b.status IN ('confirmed', 'ongoing')

    UNION ALL

    SELECT
      bv2.driver_name::text AS driver_name,
      bv2.driver_phone::text AS driver_phone,
      2 AS sort_priority,
      b2.end_at
    FROM booking_vehicles bv2
    JOIN bookings b2 ON b2.id = bv2.booking_id
    WHERE bv2.car_id = p_car_id
  ) s
  ORDER BY s.sort_priority, s.end_at DESC
  LIMIT 1;
END;
$$;

COMMENT ON FUNCTION public.get_driver_for_car_at_time(uuid, timestamptz) IS
  'Returns driver_name and driver_phone for the booking that had the given car at the given time, falling back to the most recent booking for that car when no exact-time match exists.';

NOTIFY pgrst, 'reload schema';

