-- ============================================
-- ADD 60-70 CARS WITH COMPREHENSIVE DATA
-- This script adds 60-70 cars with all related information
-- ============================================

-- Get a user ID for created_by fields
DO $$
DECLARE
  admin_user_id UUID;
  car_models TEXT[] := ARRAY[
    'Toyota Innova Crysta', 'Maruti Swift Dzire', 'Hyundai Creta', 'Mahindra XUV700',
    'Honda City', 'Toyota Fortuner', 'Maruti Ertiga', 'Tata Nexon', 'Kia Seltos',
    'Hyundai Verna', 'Maruti Baleno', 'Honda Amaze', 'Toyota Glanza', 'Maruti XL6',
    'Mahindra Scorpio', 'Tata Harrier', 'MG Hector', 'Hyundai Venue', 'Maruti Brezza',
    'Toyota Camry', 'Honda Accord', 'Nissan Magnite', 'Renault Duster', 'Ford EcoSport',
    'Volkswagen Polo', 'Skoda Rapid', 'Mahindra Thar', 'Tata Altroz', 'Maruti Ciaz',
    'Hyundai i20', 'Maruti WagonR', 'Maruti Alto', 'Tata Tiago', 'Renault Kwid',
    'Datsun GO', 'Maruti S-Presso', 'Hyundai Santro', 'Maruti Ignis', 'Tata Punch',
    'Mahindra Bolero', 'Force Gurkha', 'Isuzu D-Max', 'Mahindra XUV300', 'Tata Safari',
    'Jeep Compass', 'MG Astor', 'Hyundai Alcazar', 'Toyota Urban Cruiser', 'Maruti Grand Vitara',
    'Skoda Kushaq', 'Volkswagen Taigun', 'Citroen C3', 'Nissan Kicks', 'Renault Kiger',
    'Ford Endeavour', 'Toyota Vellfire', 'Mercedes-Benz C-Class', 'BMW 3 Series', 'Audi A4',
    'Jaguar XE', 'Volvo XC40', 'Land Rover Discovery', 'Range Rover Evoque', 'Porsche Macan'
  ];
  fuel_types TEXT[] := ARRAY['Petrol', 'Diesel', 'CNG', 'Electric', 'Hybrid'];
  statuses TEXT[] := ARRAY['active', 'active', 'active', 'active', 'inactive']; -- Mostly active
  vehicle_numbers TEXT[];
  i INTEGER;
  j INTEGER;
  car_id_val UUID;
  current_km INTEGER;
  last_service_km INTEGER;
  service_date DATE;
BEGIN
  -- Get admin user
  SELECT id INTO admin_user_id FROM auth.users LIMIT 1;
  
  IF admin_user_id IS NULL THEN
    RAISE EXCEPTION 'No users found. Please create a user first.';
  END IF;

  -- Generate 65 cars
  FOR i IN 1..65 LOOP
    -- Generate unique vehicle number
    DECLARE
      state_code TEXT := 'MH-01';
      series_num INTEGER := (i % 26) + 1; -- A-Z
      series_char1 TEXT := CHR(64 + series_num);
      series_char2 TEXT := CHR(64 + ((i / 26)::INTEGER % 26) + 1);
      reg_num TEXT := LPAD((i * 123)::TEXT, 4, '0');
      vehicle_num TEXT := state_code || '-' || series_char1 || series_char2 || '-' || reg_num;
    BEGIN
      -- Insert car
      INSERT INTO public.cars (
        id, vehicle_number, model, year, fuel_type, status, vin_chassis, notes, 
        created_by, created_at, updated_at, seats
      )
      VALUES (
        gen_random_uuid(),
        vehicle_num,
        car_models[(i % array_length(car_models, 1)) + 1],
        2020 + (i % 5), -- Years 2020-2024
        fuel_types[(i % array_length(fuel_types, 1)) + 1],
        statuses[(i % array_length(statuses, 1)) + 1],
        'VIN' || LPAD(i::TEXT, 10, '0'),
        CASE (i % 4)
          WHEN 0 THEN 'Well maintained vehicle'
          WHEN 1 THEN 'Regular service required'
          WHEN 2 THEN 'Good condition'
          ELSE 'Premium vehicle'
        END,
        admin_user_id,
        now() - (random() * 365 || ' days')::INTERVAL,
        now() - (random() * 365 || ' days')::INTERVAL,
        CASE 
          WHEN car_models[(i % array_length(car_models, 1)) + 1] ILIKE '%innova%' OR 
               car_models[(i % array_length(car_models, 1)) + 1] ILIKE '%ertiga%' OR
               car_models[(i % array_length(car_models, 1)) + 1] ILIKE '%xuv%' THEN 7
          WHEN car_models[(i % array_length(car_models, 1)) + 1] ILIKE '%thar%' THEN 4
          ELSE 5
        END
      )
      RETURNING id INTO car_id_val;

      -- Generate odometer entries (3-8 entries per car)
      current_km := 10000 + (random() * 60000)::INTEGER;
      
      FOR j IN 1..(3 + (random() * 5)::INTEGER) LOOP
        INSERT INTO public.odometer_entries (
          id, car_id, odometer_km, reading_at, entered_by, created_at
        )
        VALUES (
          gen_random_uuid(),
          car_id_val,
          current_km - ((j - 1) * (1000 + random() * 2000))::INTEGER,
          now() - ((j - 1) * 15 + random() * 10 || ' days')::INTERVAL,
          admin_user_id,
          now() - ((j - 1) * 15 + random() * 10 || ' days')::INTERVAL
        );
      END LOOP;

      -- Get latest odometer reading
      SELECT odometer_km INTO current_km
      FROM public.odometer_entries
      WHERE car_id = car_id_val
      ORDER BY reading_at DESC
      LIMIT 1;

      -- Add car service rules (attach 3-5 service rules per car)
      INSERT INTO public.car_service_rules (id, car_id, rule_id, enabled, last_serviced_km, last_serviced_at, created_at)
      SELECT 
        gen_random_uuid(),
        car_id_val,
        sr.id,
        true,
        current_km - (random() * 5000 + 1000)::INTEGER,
        now() - (random() * 90 + 30 || ' days')::INTERVAL,
        now()
      FROM public.service_rules sr
      ORDER BY random()
      LIMIT (3 + (random() * 2)::INTEGER)
      ON CONFLICT (car_id, rule_id) DO NOTHING;

      -- Add service records (2-5 per car)
      FOR j IN 1..(2 + (random() * 3)::INTEGER) LOOP
        last_service_km := current_km - (random() * 10000 + 2000)::INTEGER;
        service_date := CURRENT_DATE - (random() * 180 + 30 || ' days')::INTERVAL;
        
        INSERT INTO public.service_records (
          id, car_id, rule_id, service_name, serviced_at, odometer_km, vendor_name,
          vendor_location, cost, notes, bill_path, entered_by, created_at, warranty_expiry, serial_number
        )
        SELECT 
          gen_random_uuid(),
          car_id_val,
          (SELECT rule_id FROM public.car_service_rules WHERE car_id = car_id_val ORDER BY random() LIMIT 1),
          sr.name,
          service_date,
          last_service_km,
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
          admin_user_id,
          service_date,
          CASE WHEN random() > 0.5 THEN service_date + (random() * 180 + 90 || ' days')::INTERVAL ELSE NULL END,
          'SN' || (random() * 1000000)::INTEGER::TEXT
        FROM public.service_rules sr
        ORDER BY random()
        LIMIT 1;
      END LOOP;

      -- Add downtime logs (0-2 per car, 30% chance)
      IF random() < 0.3 THEN
        INSERT INTO public.downtime_logs (
          id, car_id, started_at, ended_at, reason, notes, source, created_by, created_at, estimated_uptime_at
        )
        VALUES (
          gen_random_uuid(),
          car_id_val,
          now() - (random() * 60 + 5 || ' days')::INTERVAL,
          CASE WHEN random() > 0.4 THEN now() - (random() * 50 || ' days')::INTERVAL ELSE NULL END,
          CASE (random() * 4)::INTEGER
            WHEN 0 THEN 'service'
            WHEN 1 THEN 'breakdown'
            WHEN 2 THEN 'accident'
            ELSE 'other'
          END,
          'Vehicle under maintenance',
          'manual',
          admin_user_id,
          now() - (random() * 60 + 5 || ' days')::INTERVAL,
          CASE WHEN random() > 0.5 THEN now() + (random() * 7 + 1 || ' days')::INTERVAL ELSE NULL END
        );
      END IF;

      -- Add incidents (0-3 per car, 40% chance)
      IF random() < 0.4 THEN
        FOR j IN 1..(1 + (random() * 2)::INTEGER) LOOP
          INSERT INTO public.incidents (
            id, car_id, incident_at, type, severity, description, location, cost,
            resolved, resolved_at, resolved_notes, created_by, created_at, driver_name, estimated_return_at
          )
          VALUES (
            gen_random_uuid(),
            car_id_val,
            now() - (random() * 90 + 10 || ' days')::INTERVAL,
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
            CASE WHEN random() > 0.4 THEN now() - (random() * 70 || ' days')::INTERVAL ELSE NULL END,
            CASE WHEN random() > 0.4 THEN 'Issue resolved, vehicle back in service' ELSE NULL END,
            admin_user_id,
            now() - (random() * 90 + 10 || ' days')::INTERVAL,
            CASE (random() * 5)::INTEGER
              WHEN 0 THEN 'Rajesh Kumar'
              WHEN 1 THEN 'Suresh Patel'
              WHEN 2 THEN 'Amit Sharma'
              WHEN 3 THEN 'Vikram Singh'
              ELSE 'Ramesh Yadav'
            END,
            CASE WHEN random() > 0.5 THEN now() + (random() * 5 + 1 || ' days')::INTERVAL ELSE NULL END
          );
        END LOOP;
      END IF;

      -- Add car notes (1-3 per car)
      FOR j IN 1..(1 + (random() * 2)::INTEGER) LOOP
        INSERT INTO public.car_notes (id, car_id, note, pinned, created_by, created_at)
        VALUES (
          gen_random_uuid(),
          car_id_val,
          CASE (random() * 4)::INTEGER
            WHEN 0 THEN 'Regular maintenance required. Check AC filter.'
            WHEN 1 THEN 'Customer complaint about noise from engine. Investigate.'
            WHEN 2 THEN 'Good condition, well maintained by driver.'
            ELSE 'Scheduled for major service next month.'
          END,
          random() > 0.7,
          admin_user_id,
          now() - (random() * 90 || ' days')::INTERVAL
        );
      END LOOP;

      -- Add car documents (RC, PUC, Insurance)
      INSERT INTO public.car_documents (id, car_id, document_type, expiry_date, file_path, file_name, notes, created_by, created_at, updated_at)
      VALUES 
        (gen_random_uuid(), car_id_val, 'rc', CURRENT_DATE + (random() * 365 + 180 || ' days')::INTERVAL, 
         'car-documents/rc_' || car_id_val::TEXT || '.pdf', 'RC_' || vehicle_num || '.pdf', 
         'Registration Certificate', admin_user_id, now(), now()),
        (gen_random_uuid(), car_id_val, 'puc', CURRENT_DATE + (random() * 180 + 30 || ' days')::INTERVAL,
         'car-documents/puc_' || car_id_val::TEXT || '.pdf', 'PUC_' || vehicle_num || '.pdf',
         'Pollution Under Control Certificate', admin_user_id, now(), now()),
        (gen_random_uuid(), car_id_val, 'insurance', CURRENT_DATE + (random() * 365 + 90 || ' days')::INTERVAL,
         'car-documents/insurance_' || car_id_val::TEXT || '.pdf', 'Insurance_' || vehicle_num || '.pdf',
         'Vehicle Insurance', admin_user_id, now(), now())
      ON CONFLICT (car_id, document_type) DO NOTHING;

      -- Progress indicator every 10 cars
      IF i % 10 = 0 THEN
        RAISE NOTICE 'Created % cars...', i;
      END IF;
    END;
  END LOOP;

  RAISE NOTICE 'Successfully created 65 cars with comprehensive data!';
  RAISE NOTICE 'Summary:';
  RAISE NOTICE '  - Total Cars: %', (SELECT COUNT(*) FROM public.cars);
  RAISE NOTICE '  - Odometer Entries: %', (SELECT COUNT(*) FROM public.odometer_entries);
  RAISE NOTICE '  - Service Records: %', (SELECT COUNT(*) FROM public.service_records);
  RAISE NOTICE '  - Car Service Rules: %', (SELECT COUNT(*) FROM public.car_service_rules);
  RAISE NOTICE '  - Downtime Logs: %', (SELECT COUNT(*) FROM public.downtime_logs);
  RAISE NOTICE '  - Incidents: %', (SELECT COUNT(*) FROM public.incidents);
  RAISE NOTICE '  - Car Notes: %', (SELECT COUNT(*) FROM public.car_notes);
  RAISE NOTICE '  - Car Documents: %', (SELECT COUNT(*) FROM public.car_documents);
END $$;

