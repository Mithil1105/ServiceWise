-- Migration 0011: Clear existing bookings and insert dummy booking data
-- This removes all existing bookings and creates sample booking data for testing

-- ============================================================================
-- 1. Delete all existing bookings (CASCADE will handle related records)
-- ============================================================================
DO $$
BEGIN
  -- Delete all bookings (this will cascade to booking_vehicles, booking_requested_vehicles, bills, etc.)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'bookings') THEN
    DELETE FROM public.bookings;
  END IF;
END $$;

-- ============================================================================
-- 2. Insert dummy booking data
-- ============================================================================
DO $$
DECLARE
  booking1_id UUID;
  booking2_id UUID;
  booking3_id UUID;
  booking4_id UUID;
  booking5_id UUID;
  booking6_id UUID;
  booking7_id UUID;
  booking8_id UUID;
  booking9_id UUID;
  booking10_id UUID;
  admin_user_id UUID;
BEGIN
  -- Only proceed if bookings table exists
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'bookings') THEN
    RAISE NOTICE 'Bookings table does not exist. Skipping dummy data insertion.';
    RETURN;
  END IF;

  -- Get admin user ID (use first user if available, or NULL)
  SELECT id INTO admin_user_id FROM auth.users LIMIT 1;

  -- Booking 1: Confirmed - Local Trip
  INSERT INTO public.bookings (
    booking_ref, status, customer_name, customer_phone, trip_type,
    start_at, end_at, pickup, dropoff, notes, created_by, updated_by
  ) VALUES (
    'PT-BK-2025-000001', 'confirmed', 'Rajesh Kumar', '9876543210', 'local',
    NOW() + INTERVAL '2 days', NOW() + INTERVAL '2 days' + INTERVAL '8 hours',
    'Airport Road, Indore', 'Rajwada Palace, Indore',
    'Customer requested AC car. Prefer Maruti Swift or similar.',
    admin_user_id, admin_user_id
  ) RETURNING id INTO booking1_id;

  -- Booking 2: Ongoing - Outstation Trip
  INSERT INTO public.bookings (
    booking_ref, status, customer_name, customer_phone, trip_type,
    start_at, end_at, pickup, dropoff, notes, created_by, updated_by
  ) VALUES (
    'PT-BK-2025-000002', 'ongoing', 'Priya Sharma', '9876543211', 'outstation',
    NOW() - INTERVAL '1 day', NOW() + INTERVAL '2 days',
    'Indore', 'Udaipur, Rajasthan',
    'Multi-day trip. Need comfortable vehicle for family of 4.',
    admin_user_id, admin_user_id
  ) RETURNING id INTO booking2_id;

  -- Booking 3: Completed - Airport Transfer
  INSERT INTO public.bookings (
    booking_ref, status, customer_name, customer_phone, trip_type,
    start_at, end_at, pickup, dropoff, notes, created_by, updated_by,
    start_odometer_reading, end_odometer_reading
  ) VALUES (
    'PT-BK-2025-000003', 'completed', 'Amit Patel', '9876543212', 'airport',
    NOW() - INTERVAL '5 days', NOW() - INTERVAL '5 days' + INTERVAL '2 hours',
    'Devi Ahilya Bai Holkar Airport, Indore', 'Hotel Sayaji, Indore',
    'Airport pickup completed successfully.',
    admin_user_id, admin_user_id,
    45000, 45120
  ) RETURNING id INTO booking3_id;

  -- Booking 4: Tentative - Custom Trip
  INSERT INTO public.bookings (
    booking_ref, status, customer_name, customer_phone, trip_type,
    start_at, end_at, pickup, dropoff, notes, created_by, updated_by
  ) VALUES (
    'PT-BK-2025-000004', 'tentative', 'Sneha Verma', '9876543213', 'custom',
    NOW() + INTERVAL '7 days', NOW() + INTERVAL '10 days',
    'Indore', 'Goa',
    'Long distance trip. Waiting for customer confirmation.',
    admin_user_id, admin_user_id
  ) RETURNING id INTO booking4_id;

  -- Booking 5: Confirmed - Local Trip
  INSERT INTO public.bookings (
    booking_ref, status, customer_name, customer_phone, trip_type,
    start_at, end_at, pickup, dropoff, notes, created_by, updated_by
  ) VALUES (
    'PT-BK-2025-000005', 'confirmed', 'Vikram Singh', '9876543214', 'local',
    NOW() + INTERVAL '3 days', NOW() + INTERVAL '3 days' + INTERVAL '6 hours',
    'Palasia, Indore', 'MR10, Indore',
    'City tour. Need driver.',
    admin_user_id, admin_user_id
  ) RETURNING id INTO booking5_id;

  -- Booking 6: Inquiry - Outstation
  INSERT INTO public.bookings (
    booking_ref, status, customer_name, customer_phone, trip_type,
    start_at, end_at, pickup, dropoff, notes, created_by, updated_by
  ) VALUES (
    'PT-BK-2025-000006', 'inquiry', 'Meera Joshi', '9876543215', 'outstation',
    NOW() + INTERVAL '15 days', NOW() + INTERVAL '18 days',
    'Indore', 'Mumbai',
    'Customer inquiring about rates. Need to provide quote.',
    admin_user_id, admin_user_id
  ) RETURNING id INTO booking6_id;

  -- Booking 7: Completed - Local Trip
  INSERT INTO public.bookings (
    booking_ref, status, customer_name, customer_phone, trip_type,
    start_at, end_at, pickup, dropoff, notes, created_by, updated_by,
    start_odometer_reading, end_odometer_reading
  ) VALUES (
    'PT-BK-2025-000007', 'completed', 'Rahul Mehta', '9876543216', 'local',
    NOW() - INTERVAL '3 days', NOW() - INTERVAL '3 days' + INTERVAL '4 hours',
    'Vijay Nagar, Indore', 'Bhawarkua, Indore',
    'Wedding event transportation.',
    admin_user_id, admin_user_id,
    52000, 52085
  ) RETURNING id INTO booking7_id;

  -- Booking 8: Ongoing - Airport Transfer
  INSERT INTO public.bookings (
    booking_ref, status, customer_name, customer_phone, trip_type,
    start_at, end_at, pickup, dropoff, notes, created_by, updated_by
  ) VALUES (
    'PT-BK-2025-000008', 'ongoing', 'Anjali Desai', '9876543217', 'airport',
    NOW() - INTERVAL '2 hours', NOW() + INTERVAL '1 hour',
    'Hotel Radisson, Indore', 'Devi Ahilya Bai Holkar Airport, Indore',
    'Airport drop. Flight delayed.',
    admin_user_id, admin_user_id
  ) RETURNING id INTO booking8_id;

  -- Booking 9: Confirmed - Outstation
  INSERT INTO public.bookings (
    booking_ref, status, customer_name, customer_phone, trip_type,
    start_at, end_at, pickup, dropoff, notes, created_by, updated_by
  ) VALUES (
    'PT-BK-2025-000009', 'confirmed', 'Karan Malhotra', '9876543218', 'outstation',
    NOW() + INTERVAL '5 days', NOW() + INTERVAL '7 days',
    'Indore', 'Pune',
    'Business trip. Need premium vehicle.',
    admin_user_id, admin_user_id
  ) RETURNING id INTO booking9_id;

  -- Booking 10: Cancelled - Local Trip
  INSERT INTO public.bookings (
    booking_ref, status, customer_name, customer_phone, trip_type,
    start_at, end_at, pickup, dropoff, notes, created_by, updated_by
  ) VALUES (
    'PT-BK-2025-000010', 'cancelled', 'Neha Agarwal', '9876543219', 'local',
    NOW() - INTERVAL '10 days', NOW() - INTERVAL '10 days' + INTERVAL '5 hours',
    'Indore', 'Indore',
    'Customer cancelled due to personal reasons.',
    admin_user_id, admin_user_id
  ) RETURNING id INTO booking10_id;

  -- Insert dummy requested vehicles for some bookings
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'booking_requested_vehicles') THEN
    -- Booking 1: Requested vehicles
    INSERT INTO public.booking_requested_vehicles (
      booking_id, brand, model, rate_type, rate_total, advance_amount,
      advance_payment_method, advance_collected_by, created_by, updated_by
    ) VALUES
    (booking1_id, 'Maruti', 'Swift', 'total', 2500, 1000, 'cash', 'Rajesh Admin', admin_user_id, admin_user_id),
    (booking1_id, 'Hyundai', 'i20', 'total', 2800, 0, NULL, NULL, admin_user_id, admin_user_id);

    -- Booking 2: Requested vehicles (ongoing)
    INSERT INTO public.booking_requested_vehicles (
      booking_id, brand, model, rate_type, rate_per_day, estimated_km, rate_per_km,
      advance_amount, advance_payment_method, advance_account_type, created_by, updated_by
    ) VALUES
    (booking2_id, 'Toyota', 'Innova', 'hybrid', 3500, 800, 12, 5000, 'online', 'company', admin_user_id, admin_user_id);

    -- Booking 3: Requested vehicles (completed)
    INSERT INTO public.booking_requested_vehicles (
      booking_id, brand, model, rate_type, rate_total, advance_amount,
      advance_payment_method, advance_collected_by, created_by, updated_by
    ) VALUES
    (booking3_id, 'Maruti', 'Dzire', 'total', 1200, 500, 'cash', 'Amit Admin', admin_user_id, admin_user_id);

    -- Booking 5: Requested vehicles
    INSERT INTO public.booking_requested_vehicles (
      booking_id, brand, model, rate_type, rate_per_day, estimated_km,
      advance_amount, advance_payment_method, advance_account_type, created_by, updated_by
    ) VALUES
    (booking5_id, 'Hyundai', 'Creta', 'per_day', 4000, 150, 2000, 'online', 'personal', admin_user_id, admin_user_id);

    -- Booking 7: Requested vehicles (completed)
    INSERT INTO public.booking_requested_vehicles (
      booking_id, brand, model, rate_type, rate_per_km, estimated_km,
      advance_amount, advance_payment_method, advance_collected_by, created_by, updated_by
    ) VALUES
    (booking7_id, 'Maruti', 'Ertiga', 'per_km', 15, 85, 1000, 'cash', 'Rahul Admin', admin_user_id, admin_user_id);

    -- Booking 9: Requested vehicles
    INSERT INTO public.booking_requested_vehicles (
      booking_id, brand, model, rate_type, rate_per_day, estimated_km, rate_per_km,
      advance_amount, advance_payment_method, advance_account_type, created_by, updated_by
    ) VALUES
    (booking9_id, 'Toyota', 'Fortuner', 'hybrid', 6000, 1200, 18, 10000, 'online', 'company', admin_user_id, admin_user_id);
  END IF;

  -- Insert dummy assigned vehicles (booking_vehicles) for some bookings
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'booking_vehicles') THEN
    -- Get car IDs (assuming cars exist, use first available cars)
    DECLARE
      car1_id UUID;
      car2_id UUID;
      car3_id UUID;
      req_veh1_id UUID;
      req_veh2_id UUID;
      req_veh3_id UUID;
    BEGIN
      -- Get first 3 cars
      SELECT id INTO car1_id FROM public.cars WHERE status = 'active' LIMIT 1 OFFSET 0;
      SELECT id INTO car2_id FROM public.cars WHERE status = 'active' LIMIT 1 OFFSET 1;
      SELECT id INTO car3_id FROM public.cars WHERE status = 'active' LIMIT 1 OFFSET 2;

      -- Get requested vehicle IDs
      SELECT id INTO req_veh1_id FROM public.booking_requested_vehicles WHERE booking_id = booking1_id LIMIT 1;
      SELECT id INTO req_veh2_id FROM public.booking_requested_vehicles WHERE booking_id = booking2_id LIMIT 1;
      SELECT id INTO req_veh3_id FROM public.booking_requested_vehicles WHERE booking_id = booking3_id LIMIT 1;

      -- Booking 1: Assigned vehicle
      IF car1_id IS NOT NULL AND req_veh1_id IS NOT NULL THEN
        INSERT INTO public.booking_vehicles (
          booking_id, car_id, driver_name, driver_phone, rate_type, rate_total,
          computed_total, advance_amount, payment_status, requested_vehicle_id,
          created_by, updated_by
        ) VALUES (
          booking1_id, car1_id, 'Ramesh Kumar', '9876543301', 'total', 2500,
          2500, 1000, 'partial', req_veh1_id, admin_user_id, admin_user_id
        );
      END IF;

      -- Booking 2: Assigned vehicle (ongoing)
      IF car2_id IS NOT NULL AND req_veh2_id IS NOT NULL THEN
        INSERT INTO public.booking_vehicles (
          booking_id, car_id, driver_name, driver_phone, rate_type, rate_per_day,
          rate_per_km, estimated_km, computed_total, advance_amount, payment_status,
          requested_vehicle_id, created_by, updated_by
        ) VALUES (
          booking2_id, car2_id, 'Suresh Yadav', '9876543302', 'hybrid', 3500,
          12, 800, 35000, 5000, 'partial', req_veh2_id, admin_user_id, admin_user_id
        );
      END IF;

      -- Booking 3: Assigned vehicle (completed)
      IF car3_id IS NOT NULL AND req_veh3_id IS NOT NULL THEN
        INSERT INTO public.booking_vehicles (
          booking_id, car_id, driver_name, driver_phone, rate_type, rate_total,
          computed_total, advance_amount, payment_status, requested_vehicle_id,
          final_km, created_by, updated_by
        ) VALUES (
          booking3_id, car3_id, 'Mahesh Patel', '9876543303', 'total', 1200,
          1200, 500, 'partial', req_veh3_id, 120, admin_user_id, admin_user_id
        );
      END IF;

      -- Booking 7: Assigned vehicle (completed)
      IF car1_id IS NOT NULL THEN
        DECLARE
          req_veh7_id UUID;
        BEGIN
          SELECT id INTO req_veh7_id FROM public.booking_requested_vehicles WHERE booking_id = booking7_id LIMIT 1;
          
          INSERT INTO public.booking_vehicles (
            booking_id, car_id, driver_name, driver_phone, rate_type, rate_per_km,
            estimated_km, computed_total, advance_amount, payment_status,
            requested_vehicle_id, final_km, created_by, updated_by
          ) VALUES (
            booking7_id, car1_id, 'Lokesh Sharma', '9876543304', 'per_km', 15,
            85, 1275, 1000, 'partial', req_veh7_id, 85, admin_user_id, admin_user_id
          );
        END;
      END IF;
    END;
  END IF;

END $$;
