-- ============================================
-- DUMMY DATA INSERTION SCRIPT
-- This script inserts comprehensive dummy data for debugging
-- Run this after all migrations have been applied
-- ============================================

-- Note: This assumes you have at least one user in auth.users
-- If not, create a user first through Supabase Auth

-- ============================================
-- 1. PROFILES & USER ROLES
-- ============================================
-- First, get existing user IDs or create test users
-- Assuming you have users, we'll reference them
-- If you need to create users, do it through Supabase Auth UI first

-- Insert profiles (assuming users exist in auth.users)
-- Handle cases where there might be 1, 2, or 3+ users
DO $$
DECLARE
  admin_user_id UUID;
  manager_user_id UUID;
  supervisor_user_id UUID;
  user_count INTEGER;
BEGIN
  -- Get user count
  SELECT COUNT(*) INTO user_count FROM auth.users;
  
  -- If no users exist, you'll need to create them through Supabase Auth first
  IF user_count = 0 THEN
    RAISE NOTICE 'No users found in auth.users. Please create users through Supabase Auth first.';
    RETURN;
  END IF;
  
  -- Get first user as admin
  SELECT id INTO admin_user_id FROM auth.users ORDER BY created_at LIMIT 1;
  
  -- Insert/update admin profile
  INSERT INTO public.profiles (id, name, created_at, updated_at)
  VALUES (admin_user_id, 'Admin User', now(), now())
  ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;
  
  -- Insert admin role
  INSERT INTO public.user_roles (user_id, role, created_at)
  VALUES (admin_user_id, 'admin'::public.app_role, now())
  ON CONFLICT (user_id, role) DO NOTHING;
  
  -- If we have a second user, assign manager role
  IF user_count >= 2 THEN
    SELECT id INTO manager_user_id FROM auth.users ORDER BY created_at OFFSET 1 LIMIT 1;
    
    INSERT INTO public.profiles (id, name, created_at, updated_at)
    VALUES (manager_user_id, 'Manager User', now(), now())
    ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;
    
    INSERT INTO public.user_roles (user_id, role, created_at)
    VALUES (manager_user_id, 'manager'::public.app_role, now())
    ON CONFLICT (user_id, role) DO NOTHING;
  ELSE
    -- If only one user, assign manager role to same user
    INSERT INTO public.user_roles (user_id, role, created_at)
    VALUES (admin_user_id, 'manager'::public.app_role, now())
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  
  -- If we have a third user, assign supervisor role
  IF user_count >= 3 THEN
    SELECT id INTO supervisor_user_id FROM auth.users ORDER BY created_at OFFSET 2 LIMIT 1;
    
    INSERT INTO public.profiles (id, name, created_at, updated_at)
    VALUES (supervisor_user_id, 'Supervisor User', now(), now())
    ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;
    
    INSERT INTO public.user_roles (user_id, role, created_at)
    VALUES (supervisor_user_id, 'supervisor'::public.app_role, now())
    ON CONFLICT (user_id, role) DO NOTHING;
  ELSE
    -- If less than 3 users, assign supervisor role to admin user
    INSERT INTO public.user_roles (user_id, role, created_at)
    VALUES (admin_user_id, 'supervisor'::public.app_role, now())
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
END $$;

-- ============================================
-- 2. CARS
-- ============================================
INSERT INTO public.cars (id, vehicle_number, model, year, fuel_type, status, vin_chassis, notes, created_by, created_at, updated_at, seats)
VALUES 
  (gen_random_uuid(), 'MH-01-AB-1234', 'Toyota Innova Crysta', 2022, 'Diesel', 'active', 'VIN1234567890', 'Well maintained vehicle', (SELECT id FROM auth.users LIMIT 1), now(), now(), 7),
  (gen_random_uuid(), 'MH-01-CD-5678', 'Maruti Swift Dzire', 2021, 'Petrol', 'active', 'VIN2345678901', 'Good condition', (SELECT id FROM auth.users LIMIT 1), now(), now(), 5),
  (gen_random_uuid(), 'MH-01-EF-9012', 'Hyundai Creta', 2023, 'Petrol', 'active', 'VIN3456789012', 'New vehicle', (SELECT id FROM auth.users LIMIT 1), now(), now(), 5),
  (gen_random_uuid(), 'MH-01-GH-3456', 'Mahindra XUV700', 2022, 'Diesel', 'active', 'VIN4567890123', 'Premium SUV', (SELECT id FROM auth.users LIMIT 1), now(), now(), 7),
  (gen_random_uuid(), 'MH-01-IJ-7890', 'Honda City', 2021, 'Petrol', 'active', 'VIN5678901234', 'Sedan', (SELECT id FROM auth.users LIMIT 1), now(), now(), 5),
  (gen_random_uuid(), 'MH-01-KL-2345', 'Toyota Fortuner', 2023, 'Diesel', 'active', 'VIN6789012345', 'Luxury SUV', (SELECT id FROM auth.users LIMIT 1), now(), now(), 7),
  (gen_random_uuid(), 'MH-01-MN-6789', 'Maruti Ertiga', 2022, 'CNG', 'active', 'VIN7890123456', 'MPV', (SELECT id FROM auth.users LIMIT 1), now(), now(), 7),
  (gen_random_uuid(), 'MH-01-OP-0123', 'Tata Nexon', 2021, 'Electric', 'active', 'VIN8901234567', 'EV', (SELECT id FROM auth.users LIMIT 1), now(), now(), 5),
  (gen_random_uuid(), 'MH-01-QR-4567', 'Kia Seltos', 2023, 'Petrol', 'inactive', 'VIN9012345678', 'Under maintenance', (SELECT id FROM auth.users LIMIT 1), now(), now(), 5),
  (gen_random_uuid(), 'MH-01-ST-8901', 'Hyundai Verna', 2022, 'Petrol', 'active', 'VIN0123456789', 'Sedan', (SELECT id FROM auth.users LIMIT 1), now(), now(), 5)
ON CONFLICT (vehicle_number) DO NOTHING;

-- ============================================
-- 3. ODOMETER ENTRIES
-- ============================================
INSERT INTO public.odometer_entries (id, car_id, odometer_km, reading_at, entered_by, created_at)
SELECT 
  gen_random_uuid(),
  c.id,
  CASE 
    WHEN c.model ILIKE '%innova%' THEN 45000 + (random() * 10000)::INTEGER
    WHEN c.model ILIKE '%swift%' THEN 35000 + (random() * 10000)::INTEGER
    WHEN c.model ILIKE '%creta%' THEN 15000 + (random() * 5000)::INTEGER
    WHEN c.model ILIKE '%xuv%' THEN 30000 + (random() * 10000)::INTEGER
    WHEN c.model ILIKE '%city%' THEN 40000 + (random() * 10000)::INTEGER
    WHEN c.model ILIKE '%fortuner%' THEN 20000 + (random() * 5000)::INTEGER
    WHEN c.model ILIKE '%ertiga%' THEN 50000 + (random() * 10000)::INTEGER
    WHEN c.model ILIKE '%nexon%' THEN 25000 + (random() * 5000)::INTEGER
    WHEN c.model ILIKE '%seltos%' THEN 10000 + (random() * 5000)::INTEGER
    ELSE 30000 + (random() * 10000)::INTEGER
  END,
  now() - (random() * 30 || ' days')::INTERVAL,
  (SELECT id FROM auth.users LIMIT 1),
  now() - (random() * 30 || ' days')::INTERVAL
FROM public.cars c
WHERE c.status = 'active'
LIMIT 10;

-- Add historical odometer entries
INSERT INTO public.odometer_entries (id, car_id, odometer_km, reading_at, entered_by, created_at)
SELECT 
  gen_random_uuid(),
  c.id,
  (SELECT odometer_km FROM public.odometer_entries WHERE car_id = c.id ORDER BY reading_at DESC LIMIT 1) - (random() * 5000 + 1000)::INTEGER,
  now() - (random() * 60 + 30 || ' days')::INTERVAL,
  (SELECT id FROM auth.users LIMIT 1),
  now() - (random() * 60 + 30 || ' days')::INTERVAL
FROM public.cars c
WHERE c.status = 'active'
LIMIT 10;

-- ============================================
-- 4. SERVICE RULES
-- ============================================
INSERT INTO public.service_rules (id, name, interval_km, interval_days, is_critical, due_soon_threshold_km, due_soon_threshold_days, active, created_at, updated_at)
VALUES 
  (gen_random_uuid(), 'General Service', 10000, NULL, true, 500, 7, true, now(), now()),
  (gen_random_uuid(), 'Oil Change', 5000, 180, true, 500, 7, true, now(), now()),
  (gen_random_uuid(), 'Air Filter Replacement', 15000, NULL, false, 1000, NULL, true, now(), now()),
  (gen_random_uuid(), 'Brake Service', 20000, NULL, true, 1000, 7, true, now(), now()),
  (gen_random_uuid(), 'AC Service', NULL, 365, false, NULL, 30, true, now(), now()),
  (gen_random_uuid(), 'Battery Check', NULL, 180, false, NULL, 15, true, now(), now()),
  (gen_random_uuid(), 'Tyre Rotation', 10000, NULL, false, 1000, NULL, true, now(), now()),
  (gen_random_uuid(), 'Wheel Alignment', 15000, NULL, false, 1000, NULL, true, now(), now())
ON CONFLICT DO NOTHING;

-- ============================================
-- 5. CAR SERVICE RULES
-- ============================================
INSERT INTO public.car_service_rules (id, car_id, rule_id, enabled, last_serviced_km, last_serviced_at, created_at)
SELECT 
  gen_random_uuid(),
  c.id,
  sr.id,
  true,
  CASE 
    WHEN sr.name = 'General Service' THEN (SELECT odometer_km FROM public.odometer_entries WHERE car_id = c.id ORDER BY reading_at DESC LIMIT 1) - (random() * 3000 + 1000)::INTEGER
    WHEN sr.name = 'Oil Change' THEN (SELECT odometer_km FROM public.odometer_entries WHERE car_id = c.id ORDER BY reading_at DESC LIMIT 1) - (random() * 2000 + 500)::INTEGER
    ELSE (SELECT odometer_km FROM public.odometer_entries WHERE car_id = c.id ORDER BY reading_at DESC LIMIT 1) - (random() * 5000 + 2000)::INTEGER
  END,
  now() - (random() * 90 + 30 || ' days')::INTERVAL,
  now()
FROM public.cars c
CROSS JOIN public.service_rules sr
WHERE c.status = 'active'
LIMIT 50;

-- ============================================
-- 6. SERVICE RECORDS
-- ============================================
INSERT INTO public.service_records (id, car_id, rule_id, service_name, serviced_at, odometer_km, vendor_name, vendor_location, cost, notes, bill_path, entered_by, created_at, warranty_expiry, serial_number)
SELECT 
  gen_random_uuid(),
  c.id,
  csr.rule_id,
  sr.name,
  csr.last_serviced_at,
  csr.last_serviced_km,
  CASE (random() * 5)::INTEGER
    WHEN 0 THEN 'ABC Motors'
    WHEN 1 THEN 'XYZ Service Center'
    WHEN 2 THEN 'Quick Service Auto'
    WHEN 3 THEN 'Premium Car Care'
    ELSE 'City Auto Service'
  END,
  CASE (random() * 3)::INTEGER
    WHEN 0 THEN 'Mumbai'
    WHEN 1 THEN 'Pune'
    ELSE 'Delhi'
  END,
  CASE 
    WHEN sr.name = 'General Service' THEN 3000 + (random() * 2000)::NUMERIC
    WHEN sr.name = 'Oil Change' THEN 1500 + (random() * 1000)::NUMERIC
    WHEN sr.name = 'Brake Service' THEN 5000 + (random() * 3000)::NUMERIC
    ELSE 2000 + (random() * 2000)::NUMERIC
  END,
  'Regular maintenance service',
  NULL,
  (SELECT id FROM auth.users LIMIT 1),
  csr.last_serviced_at,
  CASE WHEN random() > 0.5 THEN csr.last_serviced_at + (random() * 180 + 90 || ' days')::INTERVAL ELSE NULL END,
  'SN' || (random() * 1000000)::INTEGER::TEXT
FROM public.car_service_rules csr
JOIN public.cars c ON csr.car_id = c.id
JOIN public.service_rules sr ON csr.rule_id = sr.id
WHERE c.status = 'active'
LIMIT 30;

-- ============================================
-- 7. SERVICE BILL FILES
-- ============================================
INSERT INTO public.service_bill_files (id, service_record_id, file_path, file_name, file_size, file_type, created_at)
SELECT 
  gen_random_uuid(),
  sr.id,
  'service-bills/' || sr.id::TEXT || '/bill.pdf',
  'service_bill_' || sr.id::TEXT || '.pdf',
  (random() * 500000 + 100000)::INTEGER,
  'application/pdf',
  sr.created_at
FROM public.service_records sr
LIMIT 20;

-- ============================================
-- 8. DOWNTIME LOGS
-- ============================================
INSERT INTO public.downtime_logs (id, car_id, started_at, ended_at, reason, notes, source, created_by, created_at, estimated_uptime_at)
SELECT 
  gen_random_uuid(),
  c.id,
  now() - (random() * 30 + 5 || ' days')::INTERVAL,
  CASE WHEN random() > 0.3 THEN now() - (random() * 25 || ' days')::INTERVAL ELSE NULL END,
  CASE (random() * 4)::INTEGER
    WHEN 0 THEN 'service'
    WHEN 1 THEN 'breakdown'
    WHEN 2 THEN 'accident'
    ELSE 'other'
  END,
  'Vehicle under maintenance',
  'manual',
  (SELECT id FROM auth.users LIMIT 1),
  now() - (random() * 30 + 5 || ' days')::INTERVAL,
  CASE WHEN random() > 0.5 THEN now() + (random() * 7 + 1 || ' days')::INTERVAL ELSE NULL END
FROM public.cars c
WHERE c.status = 'active'
LIMIT 5;

-- ============================================
-- 9. INCIDENTS
-- ============================================
INSERT INTO public.incidents (id, car_id, incident_at, type, severity, description, location, cost, resolved, resolved_at, resolved_notes, created_by, created_at, driver_name, estimated_return_at)
SELECT 
  gen_random_uuid(),
  c.id,
  now() - (random() * 60 + 10 || ' days')::INTERVAL,
  CASE (random() * 6)::INTEGER
    WHEN 0 THEN 'breakdown'
    WHEN 1 THEN 'overheating'
    WHEN 2 THEN 'puncture'
    WHEN 3 THEN 'towing'
    WHEN 4 THEN 'accident'
    ELSE 'other'
  END,
  CASE (random() * 3)::INTEGER
    WHEN 0 THEN 'low'
    WHEN 1 THEN 'medium'
    ELSE 'high'
  END,
  CASE (random() * 3)::INTEGER
    WHEN 0 THEN 'Engine overheating issue detected'
    WHEN 1 THEN 'Tyre puncture on highway'
    ELSE 'Minor accident, bumper damage'
  END,
  CASE (random() * 3)::INTEGER
    WHEN 0 THEN 'Mumbai-Pune Expressway'
    WHEN 1 THEN 'NH48, Near Pune'
    ELSE 'City Center'
  END,
  CASE WHEN random() > 0.5 THEN (random() * 10000 + 2000)::NUMERIC ELSE NULL END,
  random() > 0.4,
  CASE WHEN random() > 0.4 THEN now() - (random() * 50 || ' days')::INTERVAL ELSE NULL END,
  CASE WHEN random() > 0.4 THEN 'Issue resolved, vehicle back in service' ELSE NULL END,
  (SELECT id FROM auth.users LIMIT 1),
  now() - (random() * 60 + 10 || ' days')::INTERVAL,
  CASE (random() * 5)::INTEGER
    WHEN 0 THEN 'Rajesh Kumar'
    WHEN 1 THEN 'Suresh Patel'
    WHEN 2 THEN 'Amit Sharma'
    WHEN 3 THEN 'Vikram Singh'
    ELSE 'Ramesh Yadav'
  END,
  CASE WHEN random() > 0.5 THEN now() + (random() * 5 + 1 || ' days')::INTERVAL ELSE NULL END
FROM public.cars c
WHERE c.status = 'active'
LIMIT 8;

-- ============================================
-- 10. CAR NOTES
-- ============================================
INSERT INTO public.car_notes (id, car_id, note, pinned, created_by, created_at)
SELECT 
  gen_random_uuid(),
  c.id,
  CASE (random() * 4)::INTEGER
    WHEN 0 THEN 'Regular maintenance required. Check AC filter.'
    WHEN 1 THEN 'Customer complaint about noise from engine. Investigate.'
    WHEN 2 THEN 'Good condition, well maintained by driver.'
    ELSE 'Scheduled for major service next month.'
  END,
  random() > 0.7,
  (SELECT id FROM auth.users LIMIT 1),
  now() - (random() * 90 || ' days')::INTERVAL
FROM public.cars c
WHERE c.status = 'active'
LIMIT 15;

-- ============================================
-- 11. CUSTOMERS
-- ============================================
INSERT INTO public.customers (id, name, phone, created_at, updated_at, created_by)
VALUES 
  (gen_random_uuid(), 'Rajesh Kumar', '+919876543210', now(), now(), (SELECT id FROM auth.users LIMIT 1)),
  (gen_random_uuid(), 'Priya Sharma', '+919876543211', now(), now(), (SELECT id FROM auth.users LIMIT 1)),
  (gen_random_uuid(), 'Amit Patel', '+919876543212', now(), now(), (SELECT id FROM auth.users LIMIT 1)),
  (gen_random_uuid(), 'Sneha Desai', '+919876543213', now(), now(), (SELECT id FROM auth.users LIMIT 1)),
  (gen_random_uuid(), 'Vikram Singh', '+919876543214', now(), now(), (SELECT id FROM auth.users LIMIT 1)),
  (gen_random_uuid(), 'Anjali Mehta', '+919876543215', now(), now(), (SELECT id FROM auth.users LIMIT 1)),
  (gen_random_uuid(), 'Rohit Verma', '+919876543216', now(), now(), (SELECT id FROM auth.users LIMIT 1)),
  (gen_random_uuid(), 'Kavita Reddy', '+919876543217', now(), now(), (SELECT id FROM auth.users LIMIT 1)),
  (gen_random_uuid(), 'Manish Joshi', '+919876543218', now(), now(), (SELECT id FROM auth.users LIMIT 1)),
  (gen_random_uuid(), 'Deepika Nair', '+919876543219', now(), now(), (SELECT id FROM auth.users LIMIT 1))
ON CONFLICT (phone) DO NOTHING;

-- ============================================
-- 12. DRIVERS
-- ============================================
INSERT INTO public.drivers (id, name, phone, location, region, license_expiry, license_file_path, license_file_name, status, notes, created_by, created_at, updated_at)
VALUES 
  (gen_random_uuid(), 'Rajesh Kumar', '+919111111111', 'Mumbai', 'West', CURRENT_DATE + (random() * 365 + 180 || ' days')::INTERVAL, 'driver-licenses/license1.pdf', 'license_rajesh.pdf', 'active', 'Experienced driver', (SELECT id FROM auth.users LIMIT 1), now(), now()),
  (gen_random_uuid(), 'Suresh Patel', '+919111111112', 'Pune', 'West', CURRENT_DATE + (random() * 365 + 180 || ' days')::INTERVAL, 'driver-licenses/license2.pdf', 'license_suresh.pdf', 'active', 'Good track record', (SELECT id FROM auth.users LIMIT 1), now(), now()),
  (gen_random_uuid(), 'Amit Sharma', '+919111111113', 'Delhi', 'North', CURRENT_DATE + (random() * 365 + 180 || ' days')::INTERVAL, 'driver-licenses/license3.pdf', 'license_amit.pdf', 'active', 'Professional driver', (SELECT id FROM auth.users LIMIT 1), now(), now()),
  (gen_random_uuid(), 'Vikram Singh', '+919111111114', 'Bangalore', 'South', CURRENT_DATE + (random() * 365 + 180 || ' days')::INTERVAL, 'driver-licenses/license4.pdf', 'license_vikram.pdf', 'active', 'Long distance specialist', (SELECT id FROM auth.users LIMIT 1), now(), now()),
  (gen_random_uuid(), 'Ramesh Yadav', '+919111111115', 'Mumbai', 'West', CURRENT_DATE + (random() * 365 + 180 || ' days')::INTERVAL, 'driver-licenses/license5.pdf', 'license_ramesh.pdf', 'active', 'City driving expert', (SELECT id FROM auth.users LIMIT 1), now(), now())
ON CONFLICT DO NOTHING;

-- ============================================
-- 13. CAR DOCUMENTS
-- ============================================
INSERT INTO public.car_documents (id, car_id, document_type, expiry_date, file_path, file_name, notes, created_by, created_at, updated_at)
SELECT 
  gen_random_uuid(),
  c.id,
  'rc',
  CURRENT_DATE + (random() * 365 + 180 || ' days')::INTERVAL,
  'car-documents/rc_' || c.id::TEXT || '.pdf',
  'RC_' || c.vehicle_number || '.pdf',
  'Registration Certificate',
  (SELECT id FROM auth.users LIMIT 1),
  now(),
  now()
FROM public.cars c
WHERE c.status = 'active'
LIMIT 10
ON CONFLICT (car_id, document_type) DO NOTHING;

INSERT INTO public.car_documents (id, car_id, document_type, expiry_date, file_path, file_name, notes, created_by, created_at, updated_at)
SELECT 
  gen_random_uuid(),
  c.id,
  'puc',
  CURRENT_DATE + (random() * 180 + 30 || ' days')::INTERVAL,
  'car-documents/puc_' || c.id::TEXT || '.pdf',
  'PUC_' || c.vehicle_number || '.pdf',
  'Pollution Under Control Certificate',
  (SELECT id FROM auth.users LIMIT 1),
  now(),
  now()
FROM public.cars c
WHERE c.status = 'active'
LIMIT 10
ON CONFLICT (car_id, document_type) DO NOTHING;

INSERT INTO public.car_documents (id, car_id, document_type, expiry_date, file_path, file_name, notes, created_by, created_at, updated_at)
SELECT 
  gen_random_uuid(),
  c.id,
  'insurance',
  CURRENT_DATE + (random() * 365 + 90 || ' days')::INTERVAL,
  'car-documents/insurance_' || c.id::TEXT || '.pdf',
  'Insurance_' || c.vehicle_number || '.pdf',
  'Vehicle Insurance',
  (SELECT id FROM auth.users LIMIT 1),
  now(),
  now()
FROM public.cars c
WHERE c.status = 'active'
LIMIT 10
ON CONFLICT (car_id, document_type) DO NOTHING;

-- ============================================
-- 14. BOOKINGS
-- ============================================
-- Note: booking_ref will be auto-generated by the default value, but we'll let it use the sequence
INSERT INTO public.bookings (id, status, customer_name, customer_phone, trip_type, start_at, end_at, pickup, dropoff, notes, created_by, updated_by, created_at, updated_at)
SELECT 
  gen_random_uuid(),
  CASE (random() * 6)::INTEGER
    WHEN 0 THEN 'inquiry'::public.booking_status
    WHEN 1 THEN 'tentative'::public.booking_status
    WHEN 2 THEN 'confirmed'::public.booking_status
    WHEN 3 THEN 'ongoing'::public.booking_status
    WHEN 4 THEN 'completed'::public.booking_status
    ELSE 'cancelled'::public.booking_status
  END,
  c.name,
  c.phone,
  CASE (random() * 4)::INTEGER
    WHEN 0 THEN 'local'::public.trip_type
    WHEN 1 THEN 'outstation'::public.trip_type
    WHEN 2 THEN 'airport'::public.trip_type
    ELSE 'custom'::public.trip_type
  END,
  start_date,
  start_date + (random() * 3 + 1 || ' days')::INTERVAL,
  CASE (random() * 3)::INTEGER
    WHEN 0 THEN 'Mumbai Airport'
    WHEN 1 THEN 'Pune Railway Station'
    ELSE 'Hotel Taj, Mumbai'
  END,
  CASE (random() * 3)::INTEGER
    WHEN 0 THEN 'Mumbai Airport'
    WHEN 1 THEN 'Pune Railway Station'
    ELSE 'Hotel Taj, Mumbai'
  END,
  'Customer booking for ' || CASE (random() * 2)::INTEGER WHEN 0 THEN 'business trip' ELSE 'family vacation' END,
  (SELECT id FROM auth.users LIMIT 1),
  (SELECT id FROM auth.users LIMIT 1),
  now() - (random() * 60 || ' days')::INTERVAL,
  now() - (random() * 60 || ' days')::INTERVAL
FROM (
  SELECT 
    c.name,
    c.phone,
    now() + (random() * 30 || ' days')::INTERVAL as start_date
  FROM public.customers c
  LIMIT 15
) c;

-- ============================================
-- 15. BOOKING VEHICLES
-- ============================================
INSERT INTO public.booking_vehicles (id, booking_id, car_id, driver_name, driver_phone, rate_type, rate_total, rate_per_day, rate_per_km, estimated_km, computed_total, advance_amount, payment_status, created_by, updated_by, created_at, updated_at, final_km)
SELECT 
  gen_random_uuid(),
  b.id,
  (SELECT id FROM public.cars WHERE status = 'active' ORDER BY random() LIMIT 1),
  (SELECT name FROM public.drivers ORDER BY random() LIMIT 1),
  (SELECT phone FROM public.drivers ORDER BY random() LIMIT 1),
  CASE (random() * 4)::INTEGER
    WHEN 0 THEN 'total'::public.rate_type
    WHEN 1 THEN 'per_day'::public.rate_type
    WHEN 2 THEN 'per_km'::public.rate_type
    ELSE 'hybrid'::public.rate_type
  END,
  CASE WHEN random() > 0.5 THEN (random() * 10000 + 3000)::NUMERIC ELSE NULL END,
  CASE WHEN random() > 0.5 THEN (random() * 2000 + 1000)::NUMERIC ELSE NULL END,
  CASE WHEN random() > 0.5 THEN (random() * 15 + 8)::NUMERIC ELSE NULL END,
  CASE WHEN random() > 0.5 THEN (random() * 500 + 100)::NUMERIC ELSE NULL END,
  (random() * 10000 + 3000)::NUMERIC,
  CASE WHEN random() > 0.5 THEN (random() * 5000 + 1000)::NUMERIC ELSE 0 END,
  CASE (random() * 3)::INTEGER
    WHEN 0 THEN 'unpaid'::public.payment_status
    WHEN 1 THEN 'partial'::public.payment_status
    ELSE 'paid'::public.payment_status
  END,
  (SELECT id FROM auth.users LIMIT 1),
  (SELECT id FROM auth.users LIMIT 1),
  b.created_at,
  b.updated_at,
  CASE WHEN b.status = 'completed'::public.booking_status THEN (random() * 500 + 100)::NUMERIC ELSE NULL END
FROM public.bookings b
WHERE b.status IN ('confirmed'::public.booking_status, 'ongoing'::public.booking_status, 'completed'::public.booking_status)
LIMIT 12
ON CONFLICT (booking_id, car_id) DO NOTHING;

-- ============================================
-- 16. BOOKING AUDIT LOG
-- ============================================
INSERT INTO public.booking_audit_log (id, booking_id, action, before, after, actor_id, created_at)
SELECT 
  gen_random_uuid(),
  b.id,
  CASE (random() * 7)::INTEGER
    WHEN 0 THEN 'created'::public.booking_audit_action
    WHEN 1 THEN 'updated'::public.booking_audit_action
    WHEN 2 THEN 'status_changed'::public.booking_audit_action
    WHEN 3 THEN 'vehicle_assigned'::public.booking_audit_action
    WHEN 4 THEN 'vehicle_removed'::public.booking_audit_action
    WHEN 5 THEN 'date_changed'::public.booking_audit_action
    ELSE 'rate_changed'::public.booking_audit_action
  END,
  '{"old_value": "previous state"}'::JSONB,
  '{"new_value": "updated state"}'::JSONB,
  (SELECT id FROM auth.users LIMIT 1),
  b.created_at + (random() * (EXTRACT(EPOCH FROM (now() - b.created_at)) || ' seconds')::INTERVAL)
FROM public.bookings b
LIMIT 25;

-- ============================================
-- 17. TENTATIVE HOLDS
-- ============================================
INSERT INTO public.tentative_holds (id, booking_id, expires_at, created_at)
SELECT 
  gen_random_uuid(),
  b.id,
  now() + (random() * 7 + 1 || ' days')::INTERVAL,
  b.created_at
FROM public.bookings b
WHERE b.status = 'tentative'
LIMIT 3
ON CONFLICT (booking_id) DO NOTHING;

-- ============================================
-- 18. INVOICES
-- ============================================
-- Note: invoice_no will be auto-generated by the default value
INSERT INTO public.invoices (id, booking_id, amount_total, advance_amount, amount_due, issued_at, created_by, created_at)
SELECT 
  gen_random_uuid(),
  b.id,
  COALESCE((SELECT computed_total FROM public.booking_vehicles WHERE booking_id = b.id LIMIT 1), (random() * 10000 + 3000)::NUMERIC),
  COALESCE((SELECT advance_amount FROM public.booking_vehicles WHERE booking_id = b.id LIMIT 1), (random() * 5000 + 1000)::NUMERIC),
  COALESCE((SELECT computed_total FROM public.booking_vehicles WHERE booking_id = b.id LIMIT 1), (random() * 10000 + 3000)::NUMERIC) - COALESCE((SELECT advance_amount FROM public.booking_vehicles WHERE booking_id = b.id LIMIT 1), (random() * 5000 + 1000)::NUMERIC),
  b.created_at + (random() * 30 || ' days')::INTERVAL,
  (SELECT id FROM auth.users LIMIT 1),
  b.created_at + (random() * 30 || ' days')::INTERVAL
FROM public.bookings b
WHERE b.status IN ('completed'::public.booking_status, 'ongoing'::public.booking_status)
LIMIT 8
ON CONFLICT (booking_id) DO NOTHING;

-- ============================================
-- 19. CAR ASSIGNMENTS
-- ============================================
INSERT INTO public.car_assignments (id, car_id, supervisor_id, assigned_at, assigned_by, notes)
SELECT 
  gen_random_uuid(),
  c.id,
  (SELECT id FROM auth.users WHERE id IN (SELECT user_id FROM public.user_roles WHERE role = 'supervisor') LIMIT 1),
  now() - (random() * 90 || ' days')::INTERVAL,
  (SELECT id FROM auth.users LIMIT 1),
  'Assigned for supervision'
FROM public.cars c
WHERE c.status = 'active'
LIMIT 5
ON CONFLICT (car_id, supervisor_id) DO NOTHING;

-- ============================================
-- 20. SUPERVISOR ACTIVITY LOG
-- ============================================
INSERT INTO public.supervisor_activity_log (id, supervisor_id, car_id, action_type, action_details, created_at)
SELECT 
  gen_random_uuid(),
  (SELECT id FROM auth.users WHERE id IN (SELECT user_id FROM public.user_roles WHERE role = 'supervisor') LIMIT 1),
  c.id,
  CASE (random() * 4)::INTEGER
    WHEN 0 THEN 'car_assigned'
    WHEN 1 THEN 'incident_reported'
    WHEN 2 THEN 'maintenance_scheduled'
    ELSE 'inspection_completed'
  END,
  jsonb_build_object('details', 'Activity performed', 'timestamp', now()::TEXT),
  now() - (random() * 60 || ' days')::INTERVAL
FROM public.cars c
WHERE c.status = 'active'
LIMIT 10;

-- ============================================
-- 21. USER SNOOZES
-- ============================================
INSERT INTO public.user_snoozes (id, user_id, snooze_until, created_at)
SELECT 
  gen_random_uuid(),
  u.id,
  now() + (random() * 7 + 1 || ' days')::INTERVAL,
  now() - (random() * 30 || ' days')::INTERVAL
FROM auth.users u
LIMIT 3
ON CONFLICT (user_id) DO UPDATE SET snooze_until = EXCLUDED.snooze_until;

-- ============================================
-- COMPLETION MESSAGE
-- ============================================
DO $$
BEGIN
  RAISE NOTICE 'Dummy data insertion completed successfully!';
  RAISE NOTICE 'Summary:';
  RAISE NOTICE '  - Cars: %', (SELECT COUNT(*) FROM public.cars);
  RAISE NOTICE '  - Odometer Entries: %', (SELECT COUNT(*) FROM public.odometer_entries);
  RAISE NOTICE '  - Service Records: %', (SELECT COUNT(*) FROM public.service_records);
  RAISE NOTICE '  - Bookings: %', (SELECT COUNT(*) FROM public.bookings);
  RAISE NOTICE '  - Customers: %', (SELECT COUNT(*) FROM public.customers);
  RAISE NOTICE '  - Drivers: %', (SELECT COUNT(*) FROM public.drivers);
  RAISE NOTICE '  - Incidents: %', (SELECT COUNT(*) FROM public.incidents);
  RAISE NOTICE '  - Downtime Logs: %', (SELECT COUNT(*) FROM public.downtime_logs);
END $$;

