-- Migration 0012: Ensure foreign key relationships are properly set up for PostgREST
-- This migration verifies and fixes foreign key constraints to ensure PostgREST can resolve relationships

DO $$
BEGIN
  -- Verify booking_vehicles has proper foreign key to cars
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'booking_vehicles') THEN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'cars') THEN
      -- Check if foreign key constraint exists
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu 
          ON tc.constraint_name = kcu.constraint_name
        WHERE tc.table_schema = 'public' 
          AND tc.table_name = 'booking_vehicles'
          AND tc.constraint_type = 'FOREIGN KEY'
          AND kcu.column_name = 'car_id'
      ) THEN
        -- Add foreign key constraint if it doesn't exist
        ALTER TABLE public.booking_vehicles
        ADD CONSTRAINT booking_vehicles_car_id_fkey
        FOREIGN KEY (car_id) REFERENCES public.cars(id) ON DELETE CASCADE;
      END IF;
    END IF;
  END IF;
END $$;

-- Refresh PostgREST schema cache by creating a dummy view (forces schema refresh)
DO $$
BEGIN
  -- Create a temporary view to force PostgREST to refresh its schema cache
  -- This view will be dropped immediately
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'bookings') THEN
    DROP VIEW IF EXISTS public._postgrest_refresh_schema CASCADE;
    CREATE VIEW public._postgrest_refresh_schema AS 
    SELECT 1 as dummy;
    DROP VIEW IF EXISTS public._postgrest_refresh_schema CASCADE;
  END IF;
END $$;
