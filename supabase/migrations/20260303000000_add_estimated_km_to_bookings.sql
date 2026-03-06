-- Add estimated_km to bookings for trip-level estimated distance (used in Requested Vehicles & Rates)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'bookings'
    AND column_name = 'estimated_km'
  ) THEN
    ALTER TABLE public.bookings
    ADD COLUMN estimated_km NUMERIC NULL;
    COMMENT ON COLUMN public.bookings.estimated_km IS 'Trip-level estimated km; used for per_km/hybrid rate calculations in requested vehicles.';
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
