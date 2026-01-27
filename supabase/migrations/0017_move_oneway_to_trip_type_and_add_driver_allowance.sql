-- Migration 0017: Move 'oneway' from rate_type to trip_type and add driver allowance
-- This migration:
-- 1. Adds 'oneway' to trip_type enum (if not exists)
-- 2. Adds driver_allowance_per_day column to booking_requested_vehicles
-- Note: We keep 'oneway' in rate_type enum for backward compatibility with existing data

-- Add 'oneway' to trip_type enum if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM pg_enum 
    WHERE enumlabel = 'oneway' 
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'trip_type')
  ) THEN
    ALTER TYPE public.trip_type ADD VALUE 'oneway';
  END IF;
END $$;

-- Add driver_allowance_per_day column to booking_requested_vehicles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'booking_requested_vehicles' 
    AND column_name = 'driver_allowance_per_day'
  ) THEN
    ALTER TABLE public.booking_requested_vehicles
    ADD COLUMN driver_allowance_per_day NUMERIC DEFAULT 0;
    
    -- Add comment
    COMMENT ON COLUMN public.booking_requested_vehicles.driver_allowance_per_day IS 'Driver allowance per day for this vehicle. Total = driver_allowance_per_day × number of days';
  END IF;
END $$;

-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';
