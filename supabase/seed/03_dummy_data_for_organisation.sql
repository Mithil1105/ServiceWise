-- Step 3: Insert dummy data (US-style cars, drivers, booking, challan) for an organisation.
-- Uses organisation slug to find org; uses first user in that org (or created_by from org) for created_by.
-- Run after Step 1 and Step 2. Safe to run for any organisation that has a slug.

DO $$
DECLARE
  v_org_slug  text := 'unimisk';
  v_org_id    uuid;
  v_user_id   uuid;

  v_car_sedan_id   uuid;
  v_car_suv_id     uuid;
  v_car_truck_id   uuid;
  v_booking_id     uuid;
  v_challan_type_id uuid;
  v_incident_id    uuid;
BEGIN
  SELECT id INTO v_org_id FROM public.organizations WHERE slug = v_org_slug LIMIT 1;
  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Organization with slug % not found.', v_org_slug;
  END IF;

  SELECT user_id INTO v_user_id
  FROM public.organization_members
  WHERE organization_id = v_org_id AND status = 'active'
  LIMIT 1;
  IF v_user_id IS NULL THEN
    SELECT created_by INTO v_user_id FROM public.organizations WHERE id = v_org_id;
  END IF;

  -- Cars (US-style)
  INSERT INTO public.cars (
    id, organization_id, vehicle_number, brand, model, year, fuel_type, seats,
    vehicle_type, vehicle_class, status, created_by, created_at, updated_at
  ) VALUES
    (gen_random_uuid(), v_org_id, 'CA-8ABC123', 'Toyota', 'Camry', 2021, 'gasoline', 5, 'private', 'lmv', 'active', v_user_id, now(), now()),
    (gen_random_uuid(), v_org_id, 'NY-KXM1023', 'Honda', 'CR-V', 2020, 'gasoline', 5, 'private', 'lmv', 'active', v_user_id, now(), now()),
    (gen_random_uuid(), v_org_id, 'TX-TRK5590', 'Ford', 'F-150', 2019, 'gasoline', 5, 'commercial', 'hmv', 'active', v_user_id, now(), now());

  SELECT id INTO v_car_sedan_id FROM public.cars WHERE organization_id = v_org_id AND vehicle_number = 'CA-8ABC123' LIMIT 1;
  SELECT id INTO v_car_suv_id   FROM public.cars WHERE organization_id = v_org_id AND vehicle_number = 'NY-KXM1023' LIMIT 1;
  SELECT id INTO v_car_truck_id FROM public.cars WHERE organization_id = v_org_id AND vehicle_number = 'TX-TRK5590' LIMIT 1;

  -- Drivers (US-style phone numbers)
  INSERT INTO public.drivers (
    id, organization_id, name, phone, location, region, license_expiry, status, notes, created_by, created_at, updated_at, license_type, driver_type
  ) VALUES
    (gen_random_uuid(), v_org_id, 'John Miller',   '+1-415-555-0123', 'San Francisco, CA', 'West Coast', (now() + interval '2 years')::date, 'active', 'Senior sedan driver', v_user_id, now(), now(), 'lmv', 'permanent'),
    (gen_random_uuid(), v_org_id, 'Sarah Johnson', '+1-212-555-0456', 'New York, NY', 'East Coast', (now() + interval '3 years')::date, 'active', 'SUV specialist', v_user_id, now(), now(), 'lmv', 'permanent'),
    (gen_random_uuid(), v_org_id, 'Mike Thompson', '+1-972-555-0789', 'Dallas, TX', 'South', (now() + interval '1 year')::date, 'active', 'Truck driver', v_user_id, now(), now(), 'hmv', 'permanent');

  -- Customers (US-style)
  INSERT INTO public.customers (id, organization_id, name, phone, created_at, updated_at)
  VALUES
    (gen_random_uuid(), v_org_id, 'Acme Corp (US)', '+1-650-555-0100', now(), now()),
    (gen_random_uuid(), v_org_id, 'Metro Logistics', '+1-312-555-0200', now(), now());

  -- Booking + assigned vehicle (for driver auto-fill when logging incident)
  v_booking_id := gen_random_uuid();
  INSERT INTO public.bookings (
    id, organization_id, booking_ref, customer_name, customer_phone, start_at, end_at, trip_type, status, pickup, dropoff, created_by, created_at
  ) VALUES (
    v_booking_id, v_org_id, 'UNI-BK-001', 'Acme Corp (US)', '+1-650-555-0100',
    now() - interval '1 hour', now() + interval '3 hours',
    'local', 'confirmed', 'Downtown San Francisco, CA', 'San Jose, CA', v_user_id, now()
  );

  INSERT INTO public.booking_vehicles (
    id, organization_id, booking_id, car_id, driver_name, driver_phone, rate_type, rate_total, estimated_km, advance_amount, created_at
  ) VALUES (
    gen_random_uuid(), v_org_id, v_booking_id, v_car_sedan_id, 'John Miller', '+1-415-555-0123', 'total', 1500, 120, 0, now()
  );

  -- Challan type
  INSERT INTO public.challan_types (id, organization_id, name, sort_order, created_at)
  VALUES (gen_random_uuid(), v_org_id, 'Red light violation', 0, now())
  RETURNING id INTO v_challan_type_id;

  -- Traffic challan incident + traffic_challans row
  INSERT INTO public.incidents (
    id, car_id, organization_id, incident_at, type, severity, description, location, cost, resolved, created_by, created_at, driver_name
  ) VALUES (
    gen_random_uuid(), v_car_sedan_id, v_org_id, now(), 'traffic_challan', 'medium',
    'Ran red light at downtown intersection', 'San Francisco, CA', 250, false, v_user_id, now(), 'John Miller'
  )
  RETURNING id INTO v_incident_id;

  INSERT INTO public.traffic_challans (
    id, organization_id, incident_id, car_id, driver_name, driver_phone, challan_type_id, amount, incident_at, location, description, created_at, created_by
  ) VALUES (
    gen_random_uuid(), v_org_id, v_incident_id, v_car_sedan_id, 'John Miller', '+1-415-555-0123',
    v_challan_type_id, 250, now(), 'San Francisco, CA', 'Test challan for Unimisk', now(), v_user_id
  );

  RAISE NOTICE 'Dummy data inserted for organisation slug: %', v_org_slug;
END $$;
