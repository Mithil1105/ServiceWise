-- Allow org-customizable dropdown values: trip_type as text, relax car vehicle_type/vehicle_class checks.
-- Organization admin defines options in Settings; values are stored as-is.

-- 1) bookings.trip_type: change from enum to TEXT so any org-defined value can be stored
DO $$
DECLARE
  col_type text;
BEGIN
  SELECT data_type INTO col_type
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'bookings' AND column_name = 'trip_type';
  IF col_type = 'USER-DEFINED' THEN
    ALTER TABLE public.bookings
      ALTER COLUMN trip_type TYPE text USING trip_type::text;
    COMMENT ON COLUMN public.bookings.trip_type IS 'Trip type; value from org booking_form_config.tripTypeOptions or legacy enum values';
  END IF;
END $$;

-- 2) cars.vehicle_type: drop CHECK so org can use custom category values
ALTER TABLE public.cars
  DROP CONSTRAINT IF EXISTS cars_vehicle_type_check;
COMMENT ON COLUMN public.cars.vehicle_type IS 'Category; value from org fleet_new_car_form_config.vehicleTypeOptions or legacy private/commercial';

-- 3) cars.vehicle_class: drop CHECK so org can use custom type-of-vehicle values
ALTER TABLE public.cars
  DROP CONSTRAINT IF EXISTS cars_vehicle_class_check;
COMMENT ON COLUMN public.cars.vehicle_class IS 'Type of vehicle; value from org fleet_new_car_form_config.vehicleClassOptions or legacy lmv/hmv';
