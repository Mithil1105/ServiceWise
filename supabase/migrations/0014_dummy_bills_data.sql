-- Migration 0014: Insert dummy bills data
-- This creates sample bills for existing bookings

DO $$
DECLARE
  booking1_id UUID;
  booking2_id UUID;
  booking3_id UUID;
  booking7_id UUID;
  booking9_id UUID;
  admin_user_id UUID;
  bill1_id UUID;
  bill2_id UUID;
  bill3_id UUID;
  bill4_id UUID;
  bill5_id UUID;
BEGIN
  -- Only proceed if bills table exists
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'bills') THEN
    RAISE NOTICE 'Bills table does not exist. Skipping dummy data insertion.';
    RETURN;
  END IF;

  -- Get admin user ID
  SELECT id INTO admin_user_id FROM auth.users LIMIT 1;

  -- Get booking IDs (completed or ongoing bookings)
  SELECT id INTO booking1_id FROM public.bookings WHERE status IN ('completed', 'ongoing') ORDER BY created_at LIMIT 1 OFFSET 0;
  SELECT id INTO booking2_id FROM public.bookings WHERE status IN ('completed', 'ongoing') ORDER BY created_at LIMIT 1 OFFSET 1;
  SELECT id INTO booking3_id FROM public.bookings WHERE status IN ('completed', 'ongoing') ORDER BY created_at LIMIT 1 OFFSET 2;
  SELECT id INTO booking7_id FROM public.bookings WHERE status IN ('completed', 'ongoing') ORDER BY created_at LIMIT 1 OFFSET 3;
  SELECT id INTO booking9_id FROM public.bookings WHERE status IN ('completed', 'ongoing') ORDER BY created_at LIMIT 1 OFFSET 4;

  -- Bill 1: Draft bill for booking1 (Total amount booking)
  IF booking1_id IS NOT NULL THEN
    DECLARE
      booking1_data RECORD;
      req_veh1_data RECORD;
    BEGIN
      SELECT * INTO booking1_data FROM public.bookings WHERE id = booking1_id;
      SELECT * INTO req_veh1_data FROM public.booking_requested_vehicles WHERE booking_id = booking1_id LIMIT 1;
      
      INSERT INTO public.bills (
        booking_id, bill_number, status,
        customer_name, customer_phone,
        start_at, end_at, pickup, dropoff,
        km_calculation_method, total_km_driven,
        vehicle_details,
        total_amount, advance_amount, balance_amount,
        created_by
      ) VALUES (
        booking1_id,
        'PT-BILL-2026-000001',
        'draft',
        booking1_data.customer_name,
        booking1_data.customer_phone,
        booking1_data.start_at,
        booking1_data.end_at,
        booking1_data.pickup,
        booking1_data.dropoff,
        'manual',
        0,
        '[]'::jsonb,
        COALESCE(req_veh1_data.rate_total, 2500),
        COALESCE(req_veh1_data.advance_amount, 1000),
        COALESCE(req_veh1_data.rate_total, 2500) - COALESCE(req_veh1_data.advance_amount, 1000),
        admin_user_id
      ) RETURNING id INTO bill1_id;
    END;
  END IF;

  -- Bill 2: Sent bill for booking2 (Hybrid booking)
  IF booking2_id IS NOT NULL THEN
    DECLARE
      booking2_data RECORD;
      req_veh2_data RECORD;
      assigned_veh2_data RECORD;
      car2_vehicle_number TEXT;
      days_count INTEGER;
      total_km_val NUMERIC;
      final_amount_val NUMERIC;
    BEGIN
      SELECT * INTO booking2_data FROM public.bookings WHERE id = booking2_id;
      SELECT * INTO req_veh2_data FROM public.booking_requested_vehicles WHERE booking_id = booking2_id LIMIT 1;
      SELECT * INTO assigned_veh2_data FROM public.booking_vehicles WHERE booking_id = booking2_id LIMIT 1;
      
      -- Get vehicle number safely
      car2_vehicle_number := 'MH-12-AB-1234'; -- Default
      IF assigned_veh2_data.car_id IS NOT NULL THEN
        SELECT vehicle_number INTO car2_vehicle_number FROM public.cars WHERE id = assigned_veh2_data.car_id;
        IF car2_vehicle_number IS NULL THEN
          car2_vehicle_number := 'MH-12-AB-1234';
        END IF;
      END IF;
      
      -- Calculate days
      days_count := EXTRACT(EPOCH FROM (booking2_data.end_at - booking2_data.start_at)) / 86400;
      days_count := GREATEST(1, CEIL(days_count));
      
      -- Use final_km if available, otherwise estimated_km
      total_km_val := COALESCE(assigned_veh2_data.final_km, req_veh2_data.estimated_km, 800);
      
      -- Calculate hybrid amount
      final_amount_val := (COALESCE(req_veh2_data.rate_per_day, 3500) * days_count) + 
                          (COALESCE(req_veh2_data.rate_per_km, 12) * total_km_val);
      
      INSERT INTO public.bills (
        booking_id, bill_number, status,
        customer_name, customer_phone,
        start_at, end_at, pickup, dropoff,
        start_odometer_reading, end_odometer_reading,
        km_calculation_method, total_km_driven,
        vehicle_details,
        total_amount, advance_amount, balance_amount,
        sent_at, created_by
      ) VALUES (
        booking2_id,
        'PT-BILL-2026-000002',
        'sent',
        booking2_data.customer_name,
        booking2_data.customer_phone,
        booking2_data.start_at,
        booking2_data.end_at,
        booking2_data.pickup,
        booking2_data.dropoff,
        50000,
        50000 + total_km_val,
        'odometer',
        total_km_val,
        jsonb_build_array(
          jsonb_build_object(
            'vehicle_number', car2_vehicle_number,
            'driver_name', assigned_veh2_data.driver_name,
            'driver_phone', assigned_veh2_data.driver_phone,
            'rate_type', 'hybrid',
            'rate_breakdown', jsonb_build_object(
              'rate_per_day', req_veh2_data.rate_per_day,
              'rate_per_km', req_veh2_data.rate_per_km,
              'days', days_count,
              'km_driven', total_km_val,
              'base_amount', COALESCE(req_veh2_data.rate_per_day, 3500) * days_count,
              'km_amount', COALESCE(req_veh2_data.rate_per_km, 12) * total_km_val,
              'final_amount', final_amount_val
            ),
            'final_amount', final_amount_val
          )
        ),
        final_amount_val,
        COALESCE(req_veh2_data.advance_amount, 5000),
        final_amount_val - COALESCE(req_veh2_data.advance_amount, 5000),
        NOW() - INTERVAL '1 day',
        admin_user_id
      ) RETURNING id INTO bill2_id;
    END;
  END IF;

  -- Bill 3: Paid bill for booking3 (Total amount booking)
  IF booking3_id IS NOT NULL THEN
    DECLARE
      booking3_data RECORD;
      req_veh3_data RECORD;
      assigned_veh3_data RECORD;
      car3_vehicle_number TEXT;
    BEGIN
      SELECT * INTO booking3_data FROM public.bookings WHERE id = booking3_id;
      SELECT * INTO req_veh3_data FROM public.booking_requested_vehicles WHERE booking_id = booking3_id LIMIT 1;
      SELECT * INTO assigned_veh3_data FROM public.booking_vehicles WHERE booking_id = booking3_id LIMIT 1;
      
      -- Get vehicle number safely
      car3_vehicle_number := 'MH-12-CD-5678'; -- Default
      IF assigned_veh3_data.car_id IS NOT NULL THEN
        SELECT vehicle_number INTO car3_vehicle_number FROM public.cars WHERE id = assigned_veh3_data.car_id;
        IF car3_vehicle_number IS NULL THEN
          car3_vehicle_number := 'MH-12-CD-5678';
        END IF;
      END IF;
      
      INSERT INTO public.bills (
        booking_id, bill_number, status,
        customer_name, customer_phone,
        start_at, end_at, pickup, dropoff,
        km_calculation_method, total_km_driven,
        vehicle_details,
        total_amount, advance_amount, balance_amount,
        sent_at, paid_at, created_by
      ) VALUES (
        booking3_id,
        'PT-BILL-2026-000003',
        'paid',
        booking3_data.customer_name,
        booking3_data.customer_phone,
        booking3_data.start_at,
        booking3_data.end_at,
        booking3_data.pickup,
        booking3_data.dropoff,
        'manual',
        COALESCE(assigned_veh3_data.final_km, 120),
        jsonb_build_array(
          jsonb_build_object(
            'vehicle_number', car3_vehicle_number,
            'driver_name', assigned_veh3_data.driver_name,
            'driver_phone', assigned_veh3_data.driver_phone,
            'rate_type', 'total',
            'rate_breakdown', jsonb_build_object(
              'rate_total', COALESCE(req_veh3_data.rate_total, 1200),
              'final_amount', COALESCE(req_veh3_data.rate_total, 1200)
            ),
            'final_amount', COALESCE(req_veh3_data.rate_total, 1200)
          )
        ),
        COALESCE(req_veh3_data.rate_total, 1200),
        COALESCE(req_veh3_data.advance_amount, 500),
        COALESCE(req_veh3_data.rate_total, 1200) - COALESCE(req_veh3_data.advance_amount, 500),
        NOW() - INTERVAL '5 days',
        NOW() - INTERVAL '3 days',
        admin_user_id
      ) RETURNING id INTO bill3_id;
    END;
  END IF;

  -- Bill 4: Sent bill for booking7 (Per KM booking)
  IF booking7_id IS NOT NULL THEN
    DECLARE
      booking7_data RECORD;
      req_veh7_data RECORD;
      assigned_veh7_data RECORD;
      car7_data RECORD;
      car7_vehicle_number TEXT;
      total_km_val NUMERIC;
      final_amount_val NUMERIC;
      min_km_threshold NUMERIC := 100;
    BEGIN
      SELECT * INTO booking7_data FROM public.bookings WHERE id = booking7_id;
      SELECT * INTO req_veh7_data FROM public.booking_requested_vehicles WHERE booking_id = booking7_id LIMIT 1;
      SELECT * INTO assigned_veh7_data FROM public.booking_vehicles WHERE booking_id = booking7_id LIMIT 1;
      
      -- Get vehicle number safely
      car7_vehicle_number := 'MH-12-EF-9012'; -- Default
      IF assigned_veh7_data.car_id IS NOT NULL THEN
        SELECT vehicle_number INTO car7_vehicle_number FROM public.cars WHERE id = assigned_veh7_data.car_id;
        IF car7_vehicle_number IS NULL THEN
          car7_vehicle_number := 'MH-12-EF-9012';
        END IF;
      END IF;
      
      -- Use final_km if available, otherwise estimated_km
      total_km_val := COALESCE(assigned_veh7_data.final_km, req_veh7_data.estimated_km, 85);
      
      -- Apply minimum threshold
      IF total_km_val < min_km_threshold THEN
        final_amount_val := COALESCE(req_veh7_data.rate_per_km, 15) * min_km_threshold;
      ELSE
        final_amount_val := COALESCE(req_veh7_data.rate_per_km, 15) * total_km_val;
      END IF;
      
      INSERT INTO public.bills (
        booking_id, bill_number, status,
        customer_name, customer_phone,
        start_at, end_at, pickup, dropoff,
        start_odometer_reading, end_odometer_reading,
        km_calculation_method, total_km_driven,
        vehicle_details,
        total_amount, advance_amount, balance_amount,
        threshold_note,
        sent_at, created_by
      ) VALUES (
        booking7_id,
        'PT-BILL-2026-000004',
        'sent',
        booking7_data.customer_name,
        booking7_data.customer_phone,
        booking7_data.start_at,
        booking7_data.end_at,
        booking7_data.pickup,
        booking7_data.dropoff,
        45000,
        45000 + total_km_val,
        'odometer',
        total_km_val,
        jsonb_build_array(
          jsonb_build_object(
            'vehicle_number', car7_vehicle_number,
            'driver_name', assigned_veh7_data.driver_name,
            'driver_phone', assigned_veh7_data.driver_phone,
            'rate_type', 'per_km',
            'rate_breakdown', jsonb_build_object(
              'rate_per_km', req_veh7_data.rate_per_km,
              'km_driven', total_km_val,
              'km_amount', final_amount_val,
              'final_amount', final_amount_val
            ),
            'final_amount', final_amount_val
          )
        ),
        final_amount_val,
        COALESCE(req_veh7_data.advance_amount, 1000),
        final_amount_val - COALESCE(req_veh7_data.advance_amount, 1000),
        CASE WHEN total_km_val < min_km_threshold THEN 
          format('Minimum KM threshold applied: %s km (Company Policy). Actual KM: %s km.', min_km_threshold, total_km_val)
        ELSE NULL END,
        NOW() - INTERVAL '2 days',
        admin_user_id
      ) RETURNING id INTO bill4_id;
    END;
  END IF;

  -- Bill 5: Draft bill for booking9 (Per Day booking)
  IF booking9_id IS NOT NULL THEN
    DECLARE
      booking9_data RECORD;
      req_veh9_data RECORD;
      assigned_veh9_data RECORD;
      car9_vehicle_number TEXT;
      days_count INTEGER;
      final_amount_val NUMERIC;
    BEGIN
      SELECT * INTO booking9_data FROM public.bookings WHERE id = booking9_id;
      SELECT * INTO req_veh9_data FROM public.booking_requested_vehicles WHERE booking_id = booking9_id LIMIT 1;
      SELECT * INTO assigned_veh9_data FROM public.booking_vehicles WHERE booking_id = booking9_id LIMIT 1;
      
      -- Get vehicle number safely
      car9_vehicle_number := 'MH-12-GH-3456'; -- Default
      IF assigned_veh9_data.car_id IS NOT NULL THEN
        SELECT vehicle_number INTO car9_vehicle_number FROM public.cars WHERE id = assigned_veh9_data.car_id;
        IF car9_vehicle_number IS NULL THEN
          car9_vehicle_number := 'MH-12-GH-3456';
        END IF;
      END IF;
      
      -- Calculate days
      days_count := EXTRACT(EPOCH FROM (booking9_data.end_at - booking9_data.start_at)) / 86400;
      days_count := GREATEST(1, CEIL(days_count));
      
      -- Calculate per day amount
      final_amount_val := COALESCE(req_veh9_data.rate_per_day, 6000) * days_count;
      
      INSERT INTO public.bills (
        booking_id, bill_number, status,
        customer_name, customer_phone,
        start_at, end_at, pickup, dropoff,
        km_calculation_method, total_km_driven,
        vehicle_details,
        total_amount, advance_amount, balance_amount,
        created_by
      ) VALUES (
        booking9_id,
        'PT-BILL-2026-000005',
        'draft',
        booking9_data.customer_name,
        booking9_data.customer_phone,
        booking9_data.start_at,
        booking9_data.end_at,
        booking9_data.pickup,
        booking9_data.dropoff,
        'manual',
        0,
        jsonb_build_array(
          jsonb_build_object(
            'vehicle_number', car9_vehicle_number,
            'driver_name', assigned_veh9_data.driver_name,
            'driver_phone', assigned_veh9_data.driver_phone,
            'rate_type', 'per_day',
            'rate_breakdown', jsonb_build_object(
              'rate_per_day', req_veh9_data.rate_per_day,
              'days', days_count,
              'base_amount', final_amount_val,
              'final_amount', final_amount_val
            ),
            'final_amount', final_amount_val
          )
        ),
        final_amount_val,
        COALESCE(req_veh9_data.advance_amount, 10000),
        final_amount_val - COALESCE(req_veh9_data.advance_amount, 10000),
        admin_user_id
      ) RETURNING id INTO bill5_id;
    END;
  END IF;

END $$;
