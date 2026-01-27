-- Migration 0001: Add booking_requested_vehicles table and link to booking_vehicles
-- This allows marketing/admin to specify requested vehicles with pricing,
-- and supervisors to assign actual vehicles matching those requests

-- Create rate_type enum if it doesn't exist (needed for this migration)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON t.typnamespace = n.oid
    WHERE n.nspname = 'public' AND t.typname = 'rate_type'
  ) THEN
    CREATE TYPE public.rate_type AS ENUM ('total', 'per_day', 'per_km', 'hybrid');
  END IF;
END $$;

-- Create booking_requested_vehicles table (only if bookings table exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'bookings') THEN
    -- Create booking_requested_vehicles table
    CREATE TABLE IF NOT EXISTS public.booking_requested_vehicles (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
      brand TEXT NOT NULL,
      model TEXT NOT NULL,
      rate_type public.rate_type NOT NULL DEFAULT 'total',
      rate_total NUMERIC,
      rate_per_day NUMERIC,
      rate_per_km NUMERIC,
      estimated_km NUMERIC,
      advance_amount NUMERIC DEFAULT 0,
      created_by UUID REFERENCES auth.users(id),
      updated_by UUID REFERENCES auth.users(id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  END IF;
END $$;

-- Add requested_vehicle_id to booking_vehicles to link assigned vehicles to requested vehicles
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'booking_vehicles') THEN
    -- Add column if it doesn't exist
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'booking_vehicles' 
      AND column_name = 'requested_vehicle_id'
    ) THEN
      ALTER TABLE public.booking_vehicles
      ADD COLUMN requested_vehicle_id UUID REFERENCES public.booking_requested_vehicles(id) ON DELETE SET NULL;
    END IF;
  END IF;
END $$;

-- Create indexes for performance
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'booking_requested_vehicles') THEN
    CREATE INDEX IF NOT EXISTS idx_booking_requested_vehicles_booking_id ON public.booking_requested_vehicles(booking_id);
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'booking_vehicles') THEN
    CREATE INDEX IF NOT EXISTS idx_booking_vehicles_requested_vehicle_id ON public.booking_vehicles(requested_vehicle_id);
  END IF;
END $$;

-- RLS Policies for booking_requested_vehicles
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'booking_requested_vehicles') THEN
    -- Enable RLS
    ALTER TABLE public.booking_requested_vehicles ENABLE ROW LEVEL SECURITY;

    -- Drop existing policies if they exist (to avoid conflicts on re-run)
    DROP POLICY IF EXISTS "Authenticated users can view requested vehicles" ON public.booking_requested_vehicles;
    DROP POLICY IF EXISTS "Admin and Manager can insert requested vehicles" ON public.booking_requested_vehicles;
    DROP POLICY IF EXISTS "Admin and Manager can update requested vehicles" ON public.booking_requested_vehicles;
    DROP POLICY IF EXISTS "Admin and Manager can delete requested vehicles" ON public.booking_requested_vehicles;

    -- All authenticated users can view requested vehicles
    CREATE POLICY "Authenticated users can view requested vehicles" ON public.booking_requested_vehicles
      FOR SELECT TO authenticated USING (true);

    -- Admin and Manager can insert requested vehicles
    CREATE POLICY "Admin and Manager can insert requested vehicles" ON public.booking_requested_vehicles
      FOR INSERT TO authenticated 
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.user_roles 
          WHERE user_id = auth.uid() 
          AND role IN ('admin', 'manager')
        )
      );

    -- Admin and Manager can update requested vehicles
    CREATE POLICY "Admin and Manager can update requested vehicles" ON public.booking_requested_vehicles
      FOR UPDATE TO authenticated 
      USING (
        EXISTS (
          SELECT 1 FROM public.user_roles 
          WHERE user_id = auth.uid() 
          AND role IN ('admin', 'manager')
        )
      );

    -- Admin and Manager can delete requested vehicles
    CREATE POLICY "Admin and Manager can delete requested vehicles" ON public.booking_requested_vehicles
      FOR DELETE TO authenticated 
      USING (
        EXISTS (
          SELECT 1 FROM public.user_roles 
          WHERE user_id = auth.uid() 
          AND role IN ('admin', 'manager')
        )
      );
  END IF;
END $$;

-- Update assign_car_to_booking function to support requested_vehicle_id
-- Only update if the function already exists (it will be created in a later migration)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' AND p.proname = 'assign_car_to_booking'
  ) THEN
    EXECUTE '
CREATE OR REPLACE FUNCTION public.assign_car_to_booking(
  p_booking_id UUID,
  p_car_id UUID,
  p_driver_name TEXT DEFAULT NULL,
  p_driver_phone TEXT DEFAULT NULL,
  p_rate_type public.rate_type DEFAULT ''total'',
  p_rate_total NUMERIC DEFAULT NULL,
  p_rate_per_day NUMERIC DEFAULT NULL,
  p_rate_per_km NUMERIC DEFAULT NULL,
  p_estimated_km NUMERIC DEFAULT NULL,
  p_advance_amount NUMERIC DEFAULT 0,
  p_buffer_minutes INTEGER DEFAULT 60,
  p_requested_vehicle_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_booking RECORD;
  v_car RECORD;
  v_conflict RECORD;
  v_computed_total NUMERIC;
  v_days INTEGER;
  v_vehicle_id UUID;
BEGIN
  -- Get booking details
  SELECT * INTO v_booking FROM bookings WHERE id = p_booking_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object(''success'', false, ''error'', ''Booking not found'');
  END IF;

  -- Get car details
  SELECT * INTO v_car FROM cars WHERE id = p_car_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object(''success'', false, ''error'', ''Car not found'');
  END IF;

  -- Check car is active
  IF v_car.status != ''active'' THEN
    RETURN jsonb_build_object(''success'', false, ''error'', ''Car is not active'');
  END IF;

  -- Check car is not in downtime
  IF EXISTS (
    SELECT 1 FROM downtime_logs dl
    WHERE dl.car_id = p_car_id
      AND dl.started_at <= v_booking.end_at
      AND (dl.ended_at IS NULL OR dl.ended_at >= v_booking.start_at)
  ) THEN
    RETURN jsonb_build_object(''success'', false, ''error'', ''Car is currently in downtime'');
  END IF;

  -- Check for overlapping bookings
  SELECT 
    b.booking_ref,
    b.start_at,
    b.end_at,
    p.name as booked_by
  INTO v_conflict
  FROM booking_vehicles bv
  JOIN bookings b ON bv.booking_id = b.id
  LEFT JOIN profiles p ON b.created_by = p.id
  WHERE bv.car_id = p_car_id
    AND b.id != p_booking_id
    AND b.status IN (''tentative'', ''confirmed'', ''ongoing'')
    AND (v_booking.start_at < (b.end_at + (p_buffer_minutes || '' minutes'')::INTERVAL))
    AND (v_booking.end_at > (b.start_at - (p_buffer_minutes || '' minutes'')::INTERVAL))
  LIMIT 1;

  IF FOUND THEN
    RETURN jsonb_build_object(
      ''success'', false,
      ''error'', format(''Car already booked from %s to %s (Booking Ref: %s, Booked by: %s)'',
        to_char(v_conflict.start_at AT TIME ZONE ''Asia/Kolkata'', ''DD Mon YYYY HH24:MI''),
        to_char(v_conflict.end_at AT TIME ZONE ''Asia/Kolkata'', ''DD Mon YYYY HH24:MI''),
        v_conflict.booking_ref,
        COALESCE(v_conflict.booked_by, ''Unknown'')
      )
    );
  END IF;

  -- Compute total based on rate type
  v_days := CEIL(EXTRACT(EPOCH FROM (v_booking.end_at - v_booking.start_at)) / 86400);
  IF v_days < 1 THEN v_days := 1; END IF;

  CASE p_rate_type
    WHEN ''total'' THEN
      v_computed_total := p_rate_total;
    WHEN ''per_day'' THEN
      v_computed_total := v_days * COALESCE(p_rate_per_day, 0);
    WHEN ''per_km'' THEN
      v_computed_total := COALESCE(p_rate_per_km, 0) * COALESCE(p_estimated_km, 0);
    WHEN ''hybrid'' THEN
      v_computed_total := (v_days * COALESCE(p_rate_per_day, 0)) + (COALESCE(p_rate_per_km, 0) * COALESCE(p_estimated_km, 0));
  END CASE;

  -- Insert or update booking_vehicle
  INSERT INTO booking_vehicles (
    booking_id, car_id, driver_name, driver_phone,
    rate_type, rate_total, rate_per_day, rate_per_km, estimated_km,
    computed_total, advance_amount, requested_vehicle_id, created_by, updated_by
  )
  VALUES (
    p_booking_id, p_car_id, p_driver_name, p_driver_phone,
    p_rate_type, p_rate_total, p_rate_per_day, p_rate_per_km, p_estimated_km,
    v_computed_total, p_advance_amount, p_requested_vehicle_id, auth.uid(), auth.uid()
  )
  ON CONFLICT (booking_id, car_id) DO UPDATE SET
    driver_name = EXCLUDED.driver_name,
    driver_phone = EXCLUDED.driver_phone,
    rate_type = EXCLUDED.rate_type,
    rate_total = EXCLUDED.rate_total,
    rate_per_day = EXCLUDED.rate_per_day,
    rate_per_km = EXCLUDED.rate_per_km,
    estimated_km = EXCLUDED.estimated_km,
    computed_total = EXCLUDED.computed_total,
    advance_amount = EXCLUDED.advance_amount,
    requested_vehicle_id = EXCLUDED.requested_vehicle_id,
    updated_by = auth.uid(),
    updated_at = now()
  RETURNING id INTO v_vehicle_id;

  RETURN jsonb_build_object(
    ''success'', true,
    ''vehicle_id'', v_vehicle_id,
    ''computed_total'', v_computed_total
  );
END;
$func$';
  END IF;
END $$;

-- Add comments for documentation
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'booking_requested_vehicles') THEN
    COMMENT ON TABLE public.booking_requested_vehicles IS 'Requested vehicles specified by marketing/admin team with pricing details';
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'booking_vehicles' 
    AND column_name = 'requested_vehicle_id'
  ) THEN
    COMMENT ON COLUMN public.booking_vehicles.requested_vehicle_id IS 'Links assigned vehicle to the requested vehicle it fulfills';
  END IF;
END $$;
