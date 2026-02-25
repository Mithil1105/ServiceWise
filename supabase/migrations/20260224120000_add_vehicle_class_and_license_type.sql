-- Add vehicle_class (LMV/HMV) to cars and license_type (LMV/HMV) to drivers.
-- Default existing rows to 'lmv'.

-- 1. Cars: vehicle_class
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'cars' AND column_name = 'vehicle_class'
  ) THEN
    ALTER TABLE public.cars
      ADD COLUMN vehicle_class TEXT NOT NULL DEFAULT 'lmv'
        CHECK (vehicle_class IN ('lmv', 'hmv'));
    COMMENT ON COLUMN public.cars.vehicle_class IS 'LMV = Light Motor Vehicle, HMV = Heavy Motor Vehicle';
  END IF;
END $$;

-- 2. Drivers: license_type
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'drivers' AND column_name = 'license_type'
  ) THEN
    ALTER TABLE public.drivers
      ADD COLUMN license_type TEXT NOT NULL DEFAULT 'lmv'
        CHECK (license_type IN ('lmv', 'hmv'));
    COMMENT ON COLUMN public.drivers.license_type IS 'License type: LMV or HMV. HMV can drive both.';
  END IF;
END $$;
