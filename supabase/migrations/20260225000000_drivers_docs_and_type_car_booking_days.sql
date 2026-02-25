-- Drivers: document uploads (Aadhaar, police verification, health certificate) and permanent/temporary type.
-- Fleet: RPC to get total booking days per car (for cars not on permanent assignment).

-- 1) drivers: add document columns and driver_type
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'drivers' AND column_name = 'aadhaar_file_path') THEN
    ALTER TABLE public.drivers ADD COLUMN aadhaar_file_path TEXT NULL;
    ALTER TABLE public.drivers ADD COLUMN aadhaar_file_name TEXT NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'drivers' AND column_name = 'police_verification_file_path') THEN
    ALTER TABLE public.drivers ADD COLUMN police_verification_file_path TEXT NULL;
    ALTER TABLE public.drivers ADD COLUMN police_verification_file_name TEXT NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'drivers' AND column_name = 'health_certificate_file_path') THEN
    ALTER TABLE public.drivers ADD COLUMN health_certificate_file_path TEXT NULL;
    ALTER TABLE public.drivers ADD COLUMN health_certificate_file_name TEXT NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'drivers' AND column_name = 'driver_type') THEN
    ALTER TABLE public.drivers ADD COLUMN driver_type TEXT NOT NULL DEFAULT 'temporary' CHECK (driver_type IN ('permanent', 'temporary'));
    COMMENT ON COLUMN public.drivers.driver_type IS 'Whether the driver is permanent or temporary.';
  END IF;
END $$;

COMMENT ON COLUMN public.drivers.aadhaar_file_path IS 'Storage path for Aadhaar card document (driver-licenses bucket).';
COMMENT ON COLUMN public.drivers.police_verification_file_path IS 'Storage path for police verification document (driver-licenses bucket).';
COMMENT ON COLUMN public.drivers.health_certificate_file_path IS 'Storage path for health certificate document (driver-licenses bucket).';

-- 2) RPC: total booking days per car (only for cars where on_permanent_assignment = false).
-- Returns (car_id, total_booking_days). RLS on cars applies so caller sees only their org's cars.
CREATE OR REPLACE FUNCTION public.get_car_booking_days()
RETURNS TABLE(car_id uuid, total_booking_days bigint)
LANGUAGE sql
SECURITY INVOKER
SET search_path TO 'public'
AS $$
  SELECT
    c.id AS car_id,
    COALESCE(SUM(
      GREATEST(1, (DATE(b.end_at) - DATE(b.start_at))::integer + 1)
    ), 0)::bigint AS total_booking_days
  FROM cars c
  LEFT JOIN booking_vehicles bv ON bv.car_id = c.id
  LEFT JOIN bookings b ON b.id = bv.booking_id
  WHERE COALESCE(c.on_permanent_assignment, false) = false
  GROUP BY c.id;
$$;

COMMENT ON FUNCTION public.get_car_booking_days() IS 'Total number of days each car has been on the road for bookings. Only for cars not on permanent assignment. RLS applies.';
