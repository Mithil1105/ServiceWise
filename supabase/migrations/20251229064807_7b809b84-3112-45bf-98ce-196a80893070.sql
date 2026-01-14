-- Create booking status enum
CREATE TYPE public.booking_status AS ENUM ('inquiry', 'tentative', 'confirmed', 'ongoing', 'completed', 'cancelled');

-- Create trip type enum
CREATE TYPE public.trip_type AS ENUM ('local', 'outstation', 'airport', 'custom');

-- Create rate type enum
CREATE TYPE public.rate_type AS ENUM ('total', 'per_day', 'per_km', 'hybrid');

-- Create payment status enum
CREATE TYPE public.payment_status AS ENUM ('unpaid', 'partial', 'paid');

-- Create booking audit action enum
CREATE TYPE public.booking_audit_action AS ENUM ('created', 'updated', 'status_changed', 'vehicle_assigned', 'vehicle_removed', 'date_changed', 'rate_changed');

-- Create sequence for booking reference numbers
CREATE SEQUENCE IF NOT EXISTS public.booking_ref_seq START 1;

-- Create sequence for invoice numbers
CREATE SEQUENCE IF NOT EXISTS public.invoice_no_seq START 1;

-- Create bookings table
CREATE TABLE public.bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_ref TEXT UNIQUE NOT NULL DEFAULT ('PT-BK-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.booking_ref_seq')::text, 6, '0')),
  status public.booking_status NOT NULL DEFAULT 'inquiry',
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  trip_type public.trip_type NOT NULL DEFAULT 'local',
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ NOT NULL,
  pickup TEXT,
  dropoff TEXT,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT valid_date_range CHECK (end_at > start_at)
);

-- Create booking_vehicles table (supports multiple cars per booking)
CREATE TABLE public.booking_vehicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  car_id UUID NOT NULL REFERENCES public.cars(id),
  driver_name TEXT,
  driver_phone TEXT,
  rate_type public.rate_type NOT NULL DEFAULT 'total',
  rate_total NUMERIC,
  rate_per_day NUMERIC,
  rate_per_km NUMERIC,
  estimated_km NUMERIC,
  computed_total NUMERIC,
  advance_amount NUMERIC DEFAULT 0,
  payment_status public.payment_status NOT NULL DEFAULT 'unpaid',
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create booking_audit_log table
CREATE TABLE public.booking_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  action public.booking_audit_action NOT NULL,
  before JSONB,
  after JSONB,
  actor_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create tentative_holds table
CREATE TABLE public.tentative_holds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create invoices table
CREATE TABLE public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE UNIQUE,
  invoice_no TEXT UNIQUE NOT NULL DEFAULT ('PT-INV-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.invoice_no_seq')::text, 6, '0')),
  amount_total NUMERIC NOT NULL,
  advance_amount NUMERIC NOT NULL DEFAULT 0,
  amount_due NUMERIC NOT NULL,
  issued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX idx_bookings_dates ON public.bookings(start_at, end_at);
CREATE INDEX idx_bookings_status ON public.bookings(status);
CREATE INDEX idx_booking_vehicles_car ON public.booking_vehicles(car_id);
CREATE INDEX idx_booking_vehicles_booking ON public.booking_vehicles(booking_id);
CREATE INDEX idx_booking_audit_log_booking ON public.booking_audit_log(booking_id, created_at DESC);
CREATE INDEX idx_tentative_holds_expires ON public.tentative_holds(expires_at);

-- Enable RLS on all tables
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tentative_holds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

-- RLS Policies for bookings
CREATE POLICY "Authenticated users can view bookings"
  ON public.bookings FOR SELECT
  USING (true);

CREATE POLICY "Admin and Manager can insert bookings"
  ON public.bookings FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "Admin and Manager can update bookings"
  ON public.bookings FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

-- RLS Policies for booking_vehicles
CREATE POLICY "Authenticated users can view booking vehicles"
  ON public.booking_vehicles FOR SELECT
  USING (true);

CREATE POLICY "Admin and Manager can insert booking vehicles"
  ON public.booking_vehicles FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "Admin and Manager can update booking vehicles"
  ON public.booking_vehicles FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "Admin and Manager can delete booking vehicles"
  ON public.booking_vehicles FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

-- RLS Policies for booking_audit_log
CREATE POLICY "Authenticated users can view audit logs"
  ON public.booking_audit_log FOR SELECT
  USING (true);

CREATE POLICY "Admin and Manager can insert audit logs"
  ON public.booking_audit_log FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

-- RLS Policies for tentative_holds
CREATE POLICY "Authenticated users can view tentative holds"
  ON public.tentative_holds FOR SELECT
  USING (true);

CREATE POLICY "Admin and Manager can manage tentative holds"
  ON public.tentative_holds FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

-- RLS Policies for invoices
CREATE POLICY "Authenticated users can view invoices"
  ON public.invoices FOR SELECT
  USING (true);

CREATE POLICY "Admin and Manager can insert invoices"
  ON public.invoices FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "Admin and Manager can update invoices"
  ON public.invoices FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

-- Trigger to update updated_at on bookings
CREATE TRIGGER update_bookings_updated_at
  BEFORE UPDATE ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger to update updated_at on booking_vehicles
CREATE TRIGGER update_booking_vehicles_updated_at
  BEFORE UPDATE ON public.booking_vehicles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Function to check available cars for a date range
CREATE OR REPLACE FUNCTION public.check_available_cars(
  p_start_at TIMESTAMPTZ,
  p_end_at TIMESTAMPTZ,
  p_buffer_minutes INTEGER DEFAULT 60,
  p_exclude_booking_id UUID DEFAULT NULL
)
RETURNS TABLE (
  car_id UUID,
  vehicle_number TEXT,
  model TEXT,
  is_available BOOLEAN,
  conflict_booking_ref TEXT,
  conflict_start TIMESTAMPTZ,
  conflict_end TIMESTAMPTZ,
  conflict_booked_by TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH active_cars AS (
    SELECT c.id, c.vehicle_number, c.model
    FROM cars c
    WHERE c.status = 'active'
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
    WHERE b.status IN ('tentative', 'confirmed', 'ongoing')
      AND (p_exclude_booking_id IS NULL OR b.id != p_exclude_booking_id)
      AND (p_start_at < (b.end_at + (p_buffer_minutes || ' minutes')::INTERVAL))
      AND (p_end_at > (b.start_at - (p_buffer_minutes || ' minutes')::INTERVAL))
  )
  SELECT 
    ac.id as car_id,
    ac.vehicle_number,
    ac.model,
    (cid.car_id IS NULL AND cb.car_id IS NULL) as is_available,
    cb.booking_ref as conflict_booking_ref,
    cb.start_at as conflict_start,
    cb.end_at as conflict_end,
    cb.booked_by_name as conflict_booked_by
  FROM active_cars ac
  LEFT JOIN cars_in_downtime cid ON ac.id = cid.car_id
  LEFT JOIN conflicting_bookings cb ON ac.id = cb.car_id
  WHERE cid.car_id IS NULL -- Exclude cars in downtime
  ORDER BY (cb.car_id IS NULL) DESC, ac.vehicle_number;
END;
$$;

-- Function to assign a car to a booking with conflict prevention
CREATE OR REPLACE FUNCTION public.assign_car_to_booking(
  p_booking_id UUID,
  p_car_id UUID,
  p_driver_name TEXT DEFAULT NULL,
  p_driver_phone TEXT DEFAULT NULL,
  p_rate_type public.rate_type DEFAULT 'total',
  p_rate_total NUMERIC DEFAULT NULL,
  p_rate_per_day NUMERIC DEFAULT NULL,
  p_rate_per_km NUMERIC DEFAULT NULL,
  p_estimated_km NUMERIC DEFAULT NULL,
  p_advance_amount NUMERIC DEFAULT 0,
  p_buffer_minutes INTEGER DEFAULT 60
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
    RETURN jsonb_build_object('success', false, 'error', 'Booking not found');
  END IF;

  -- Get car details
  SELECT * INTO v_car FROM cars WHERE id = p_car_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Car not found');
  END IF;

  -- Check car is active
  IF v_car.status != 'active' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Car is not active');
  END IF;

  -- Check car is not in downtime
  IF EXISTS (
    SELECT 1 FROM downtime_logs dl
    WHERE dl.car_id = p_car_id
      AND dl.started_at <= v_booking.end_at
      AND (dl.ended_at IS NULL OR dl.ended_at >= v_booking.start_at)
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Car is currently in downtime');
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
    AND b.status IN ('tentative', 'confirmed', 'ongoing')
    AND (v_booking.start_at < (b.end_at + (p_buffer_minutes || ' minutes')::INTERVAL))
    AND (v_booking.end_at > (b.start_at - (p_buffer_minutes || ' minutes')::INTERVAL))
  LIMIT 1;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', format('Car already booked from %s to %s (Booking Ref: %s, Booked by: %s)',
        to_char(v_conflict.start_at AT TIME ZONE 'Asia/Kolkata', 'DD Mon YYYY HH24:MI'),
        to_char(v_conflict.end_at AT TIME ZONE 'Asia/Kolkata', 'DD Mon YYYY HH24:MI'),
        v_conflict.booking_ref,
        COALESCE(v_conflict.booked_by, 'Unknown')
      )
    );
  END IF;

  -- Compute total based on rate type
  v_days := CEIL(EXTRACT(EPOCH FROM (v_booking.end_at - v_booking.start_at)) / 86400);
  IF v_days < 1 THEN v_days := 1; END IF;

  CASE p_rate_type
    WHEN 'total' THEN
      v_computed_total := p_rate_total;
    WHEN 'per_day' THEN
      v_computed_total := v_days * COALESCE(p_rate_per_day, 0);
    WHEN 'per_km' THEN
      v_computed_total := COALESCE(p_rate_per_km, 0) * COALESCE(p_estimated_km, 0);
    WHEN 'hybrid' THEN
      v_computed_total := (v_days * COALESCE(p_rate_per_day, 0)) + (COALESCE(p_rate_per_km, 0) * COALESCE(p_estimated_km, 0));
  END CASE;

  -- Insert or update booking_vehicle
  INSERT INTO booking_vehicles (
    booking_id, car_id, driver_name, driver_phone,
    rate_type, rate_total, rate_per_day, rate_per_km, estimated_km,
    computed_total, advance_amount, created_by, updated_by
  )
  VALUES (
    p_booking_id, p_car_id, p_driver_name, p_driver_phone,
    p_rate_type, p_rate_total, p_rate_per_day, p_rate_per_km, p_estimated_km,
    v_computed_total, p_advance_amount, auth.uid(), auth.uid()
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
    updated_by = auth.uid(),
    updated_at = now()
  RETURNING id INTO v_vehicle_id;

  -- Log the assignment
  INSERT INTO booking_audit_log (booking_id, action, after, actor_id)
  VALUES (
    p_booking_id,
    'vehicle_assigned',
    jsonb_build_object('car_id', p_car_id, 'vehicle_number', v_car.vehicle_number),
    auth.uid()
  );

  RETURN jsonb_build_object(
    'success', true,
    'vehicle_id', v_vehicle_id,
    'computed_total', v_computed_total
  );
END;
$$;

-- Add unique constraint for booking_vehicles to prevent duplicate car assignments
ALTER TABLE public.booking_vehicles ADD CONSTRAINT unique_booking_car UNIQUE (booking_id, car_id);