-- Migration 0019: Add dummy billing data for testing
-- Creates ~50 bills, transfers, and company bills for the next month

DO $$
DECLARE
  admin_user_id UUID;
  manager_user_id UUID;
  booking_ids UUID[];
  bill_ids UUID[];
  company_bill_ids UUID[];
  transfer_ids UUID[];
  has_advance_amount BOOLEAN;
  has_advance_payment_method BOOLEAN;
  has_advance_collected_by BOOLEAN;
  has_advance_account_type BOOLEAN;
  has_advance_account_id BOOLEAN;
  customer_names TEXT[] := ARRAY[
    'Rajesh Kumar', 'Priya Sharma', 'Amit Patel', 'Sneha Desai', 'Vikram Singh',
    'Anjali Mehta', 'Rohit Gupta', 'Kavita Joshi', 'Suresh Reddy', 'Meera Nair',
    'Arjun Kapoor', 'Divya Iyer', 'Karan Malhotra', 'Pooja Agarwal', 'Nikhil Verma',
    'Shruti Chawla', 'Rahul Jain', 'Neha Shah', 'Manoj Tiwari', 'Swati Rao',
    'Deepak Mishra', 'Riya Agarwal', 'Siddharth Bansal', 'Tanvi Khanna', 'Aditya Chopra',
    'Isha Malhotra', 'Varun Sethi', 'Ananya Reddy', 'Kunal Mehta', 'Ritika Joshi',
    'Harsh Gupta', 'Sakshi Patel', 'Yash Singh', 'Aisha Khan', 'Rohan Desai',
    'Zara Sharma', 'Kabir Nair', 'Ira Kapoor', 'Dev Malhotra', 'Maya Iyer',
    'Aryan Verma', 'Kiara Chawla', 'Reyansh Jain', 'Avni Shah', 'Vihaan Tiwari',
    'Aarav Rao', 'Anika Mishra', 'Advik Agarwal', 'Diya Bansal', 'Arnav Khanna'
  ];
  customer_phones TEXT[] := ARRAY[
    '9876543210', '9876543211', '9876543212', '9876543213', '9876543214',
    '9876543215', '9876543216', '9876543217', '9876543218', '9876543219',
    '9876543220', '9876543221', '9876543222', '9876543223', '9876543224',
    '9876543225', '9876543226', '9876543227', '9876543228', '9876543229',
    '9876543230', '9876543231', '9876543232', '9876543233', '9876543234',
    '9876543235', '9876543236', '9876543237', '9876543238', '9876543239',
    '9876543240', '9876543241', '9876543242', '9876543243', '9876543244',
    '9876543245', '9876543246', '9876543247', '9876543248', '9876543249',
    '9876543250', '9876543251', '9876543252', '9876543253', '9876543254',
    '9876543255', '9876543256', '9876543257', '9876543258', '9876543259'
  ];
  payment_methods TEXT[] := ARRAY['cash', 'online'];
  account_types TEXT[] := ARRAY['company', 'personal'];
  bill_statuses TEXT[] := ARRAY['draft', 'sent', 'paid'];
  transfer_statuses TEXT[] := ARRAY['pending', 'completed'];
  rate_types TEXT[] := ARRAY['total', 'per_day', 'per_km'];
  i INTEGER;
  bill_date TIMESTAMPTZ;
  start_date TIMESTAMPTZ;
  end_date TIMESTAMPTZ;
  days_diff INTEGER;
  total_amount NUMERIC;
  advance_amount NUMERIC;
  km_driven NUMERIC;
  bill_number TEXT;
  company_bill_number TEXT;
  vehicle_details JSONB;
  transfer_requirements JSONB;
  collected_by_names TEXT[] := ARRAY['Manager A', 'Manager B', 'Admin User', 'Manager C', 'Manager D'];
  cashier_names TEXT[] := ARRAY['Cashier 1', 'Cashier 2', 'Cashier 3'];
  pickup_locations TEXT[] := ARRAY['Airport', 'Railway Station', 'Hotel', 'Office', 'Residence'];
  dropoff_locations TEXT[] := ARRAY['Airport', 'Railway Station', 'Hotel', 'Office', 'Residence'];
  vehicle_numbers TEXT[] := ARRAY['MH-12-AB-1234', 'MH-12-CD-5678', 'MH-12-EF-9012', 'MH-12-GH-3456', 'MH-12-IJ-7890'];
  driver_names TEXT[] := ARRAY['Driver A', 'Driver B', 'Driver C', 'Driver D', 'Driver E'];
  driver_phones TEXT[] := ARRAY['9123456780', '9123456781', '9123456782', '9123456783', '9123456784'];
BEGIN
  -- Get admin and manager user IDs
  SELECT id INTO admin_user_id FROM auth.users LIMIT 1;
  SELECT id INTO manager_user_id FROM auth.users OFFSET 1 LIMIT 1;
  
  IF admin_user_id IS NULL THEN
    -- Create a dummy user ID if none exists (for testing)
    admin_user_id := gen_random_uuid();
    manager_user_id := gen_random_uuid();
  END IF;
  
  IF manager_user_id IS NULL THEN
    manager_user_id := admin_user_id;
  END IF;
  
  -- Create dummy bookings first (if bookings table exists)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'bookings') THEN
    -- Check if advance payment columns exist in bookings table
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'bookings' 
      AND column_name = 'advance_amount'
    ) INTO has_advance_amount;
    
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'bookings' 
      AND column_name = 'advance_payment_method'
    ) INTO has_advance_payment_method;
    
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'bookings' 
      AND column_name = 'advance_collected_by'
    ) INTO has_advance_collected_by;
    
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'bookings' 
      AND column_name = 'advance_account_type'
    ) INTO has_advance_account_type;
    
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'bookings' 
      AND column_name = 'advance_account_id'
    ) INTO has_advance_account_id;
    
    FOR i IN 1..50 LOOP
        bill_date := NOW() - (random() * 30 || ' days')::INTERVAL;
        days_diff := 1 + floor(random() * 7)::INTEGER; -- 1-7 days
        start_date := bill_date;
        end_date := start_date + (days_diff || ' days')::INTERVAL;
        
        -- Build dynamic INSERT statement based on which columns exist
        IF has_advance_amount AND has_advance_payment_method AND has_advance_collected_by AND has_advance_account_type THEN
          INSERT INTO public.bookings (
            booking_ref,
            status,
            customer_name,
            customer_phone,
            trip_type,
            start_at,
            end_at,
            pickup,
            dropoff,
            advance_amount,
            advance_payment_method,
            advance_collected_by,
            advance_account_type,
            advance_account_id,
            created_by,
            updated_by
          ) VALUES (
            'PT-BK-2026-' || lpad(i::TEXT, 6, '0'),
            (CASE 
              WHEN random() < 0.3 THEN 'completed'
              WHEN random() < 0.6 THEN 'ongoing'
              ELSE 'confirmed'
            END)::public.booking_status,
            customer_names[1 + (i - 1) % array_length(customer_names, 1)],
            customer_phones[1 + (i - 1) % array_length(customer_phones, 1)],
            (CASE floor(random() * 4)::INTEGER
              WHEN 0 THEN 'local'
              WHEN 1 THEN 'outstation'
              WHEN 2 THEN 'airport'
              ELSE 'oneway_pickup_drop'
            END)::public.trip_type,
            start_date,
            end_date,
            pickup_locations[1 + floor(random() * array_length(pickup_locations, 1))::INTEGER],
            dropoff_locations[1 + floor(random() * array_length(dropoff_locations, 1))::INTEGER],
            CASE WHEN random() < 0.7 THEN floor(random() * 5000 + 1000)::NUMERIC ELSE 0 END,
            CASE WHEN random() < 0.7 THEN payment_methods[1 + floor(random() * 2)::INTEGER] ELSE NULL END,
            CASE WHEN random() < 0.7 THEN collected_by_names[1 + floor(random() * array_length(collected_by_names, 1))::INTEGER] ELSE NULL END,
            CASE WHEN random() < 0.5 THEN account_types[1 + floor(random() * 2)::INTEGER] ELSE NULL END,
            NULL, -- advance_account_id (we don't have bank account IDs in dummy data)
            admin_user_id,
            admin_user_id
          ) RETURNING id INTO booking_ids[i];
        ELSE
          -- Fallback: Insert without advance payment columns
          INSERT INTO public.bookings (
            booking_ref,
            status,
            customer_name,
            customer_phone,
            trip_type,
            start_at,
            end_at,
            pickup,
            dropoff,
            created_by,
            updated_by
          ) VALUES (
            'PT-BK-2026-' || lpad(i::TEXT, 6, '0'),
            (CASE 
              WHEN random() < 0.3 THEN 'completed'
              WHEN random() < 0.6 THEN 'ongoing'
              ELSE 'confirmed'
            END)::public.booking_status,
            customer_names[1 + (i - 1) % array_length(customer_names, 1)],
            customer_phones[1 + (i - 1) % array_length(customer_phones, 1)],
            (CASE floor(random() * 4)::INTEGER
              WHEN 0 THEN 'local'
              WHEN 1 THEN 'outstation'
              WHEN 2 THEN 'airport'
              ELSE 'oneway_pickup_drop'
            END)::public.trip_type,
            start_date,
            end_date,
            pickup_locations[1 + floor(random() * array_length(pickup_locations, 1))::INTEGER],
            dropoff_locations[1 + floor(random() * array_length(dropoff_locations, 1))::INTEGER],
            admin_user_id,
            admin_user_id
          ) RETURNING id INTO booking_ids[i];
        END IF;
    END LOOP;
  END IF;
  
  -- Create dummy bills
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'bills') THEN
    FOR i IN 1..50 LOOP
      bill_date := NOW() - (random() * 30 || ' days')::INTERVAL;
      days_diff := 1 + floor(random() * 7)::INTEGER;
      start_date := bill_date;
      end_date := start_date + (days_diff || ' days')::INTERVAL;
      km_driven := floor(random() * 500 + 100)::NUMERIC;
      total_amount := floor(random() * 15000 + 3000)::NUMERIC;
      advance_amount := CASE WHEN random() < 0.7 THEN floor(random() * (total_amount * 0.5) + 1000)::NUMERIC ELSE 0 END;
      
      -- Create vehicle details
      vehicle_details := jsonb_build_array(
        jsonb_build_object(
          'vehicle_number', vehicle_numbers[1 + floor(random() * array_length(vehicle_numbers, 1))::INTEGER],
          'driver_name', driver_names[1 + floor(random() * array_length(driver_names, 1))::INTEGER],
          'driver_phone', driver_phones[1 + floor(random() * array_length(driver_phones, 1))::INTEGER],
          'rate_type', rate_types[1 + floor(random() * array_length(rate_types, 1))::INTEGER],
          'rate_breakdown', jsonb_build_object(
            'final_amount', total_amount
          ),
          'final_amount', total_amount
        )
      );
      
      bill_number := 'PT-BILL-2026-' || lpad(i::TEXT, 6, '0');
      
      INSERT INTO public.bills (
        booking_id,
        bill_number,
        status,
        customer_name,
        customer_phone,
        start_at,
        end_at,
        pickup,
        dropoff,
        start_odometer_reading,
        end_odometer_reading,
        total_km_driven,
        km_calculation_method,
        vehicle_details,
        total_amount,
        total_driver_allowance,
        advance_amount,
        balance_amount,
        threshold_note,
        created_by,
        sent_at,
        paid_at
      ) VALUES (
        CASE WHEN array_length(booking_ids, 1) >= i THEN booking_ids[i] ELSE NULL END,
        bill_number,
        (bill_statuses[1 + floor(random() * array_length(bill_statuses, 1))::INTEGER])::public.bill_status,
        customer_names[1 + (i - 1) % array_length(customer_names, 1)],
        customer_phones[1 + (i - 1) % array_length(customer_phones, 1)],
        start_date,
        end_date,
        pickup_locations[1 + floor(random() * array_length(pickup_locations, 1))::INTEGER],
        dropoff_locations[1 + floor(random() * array_length(dropoff_locations, 1))::INTEGER],
        floor(random() * 50000 + 10000)::NUMERIC,
        floor(random() * 50000 + 10000)::NUMERIC + km_driven,
        km_driven,
        CASE WHEN random() < 0.5 THEN 'odometer' ELSE 'manual' END,
        vehicle_details,
        total_amount,
        CASE WHEN random() < 0.5 THEN floor(random() * 2000 + 500)::NUMERIC ELSE 0 END,
        advance_amount,
        total_amount - advance_amount,
        CASE WHEN random() < 0.3 THEN 'Minimum threshold applied as per company policy' ELSE NULL END,
        admin_user_id,
        CASE WHEN random() < 0.7 THEN bill_date + interval '1 hour' ELSE NULL END,
        CASE WHEN random() < 0.4 THEN bill_date + interval '2 days' ELSE NULL END
      ) RETURNING id INTO bill_ids[i];
      
      -- Initialize array if needed
      IF bill_ids[i] IS NULL THEN
        bill_ids := array_append(bill_ids, NULL);
      END IF;
    END LOOP;
  END IF;
  
  -- Create dummy transfers (for bills with personal/cash advance)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'transfers') THEN
    FOR i IN 1..50 LOOP
      IF bill_ids[i] IS NOT NULL THEN
        DECLARE
          bill_advance NUMERIC;
          bill_payment_method TEXT;
          bill_account_type TEXT;
          bill_collected_by TEXT;
        BEGIN
          -- Check if bill has advance payment that needs transfer
          SELECT advance_amount, advance_payment_method, advance_account_type, advance_collected_by
          INTO bill_advance, bill_payment_method, bill_account_type, bill_collected_by
          FROM public.bills
          WHERE id = bill_ids[i];
          
          IF bill_advance > 0 AND (bill_payment_method = 'cash' OR bill_account_type = 'personal') THEN
          INSERT INTO public.transfers (
            booking_id,
            bill_id,
            amount,
            from_account_type,
            collected_by_user_id,
            collected_by_name,
            status,
            transfer_date,
            completed_by_user_id,
            completed_at,
            cash_given_to_cashier,
            cashier_name,
            reminder_sent_at,
            notes
          ) VALUES (
            booking_ids[i],
            bill_ids[i],
            bill_advance,
            CASE WHEN bill_payment_method = 'cash' THEN 'cash' ELSE 'personal' END,
            CASE WHEN random() < 0.5 THEN admin_user_id ELSE manager_user_id END,
            COALESCE(bill_collected_by, collected_by_names[1 + floor(random() * array_length(collected_by_names, 1))::INTEGER]) || ' (Test)',
            transfer_statuses[1 + floor(random() * array_length(transfer_statuses, 1))::INTEGER],
            CASE WHEN random() < 0.5 THEN bill_date + interval '1 day' ELSE NULL END,
            CASE WHEN random() < 0.5 THEN admin_user_id ELSE NULL END,
            CASE WHEN random() < 0.5 THEN bill_date + interval '1 day' ELSE NULL END,
            CASE WHEN bill_payment_method = 'cash' AND random() < 0.7 THEN true ELSE false END,
            CASE WHEN bill_payment_method = 'cash' AND random() < 0.7 THEN cashier_names[1 + floor(random() * array_length(cashier_names, 1))::INTEGER] ELSE NULL END,
            CASE WHEN random() < 0.3 THEN bill_date + interval '6 days' ELSE NULL END,
            CASE WHEN random() < 0.2 THEN 'Test transfer note' ELSE NULL END
          ) RETURNING id INTO transfer_ids[i];
          
          -- Initialize array if needed
          IF transfer_ids[i] IS NULL THEN
            transfer_ids := array_append(transfer_ids, NULL);
          END IF;
          END IF;
        END;
      END IF;
    END LOOP;
  END IF;
  
  -- Create dummy company bills
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'company_bills') THEN
    FOR i IN 1..50 LOOP
      IF bill_ids[i] IS NOT NULL THEN
        DECLARE
          bill_total NUMERIC;
          bill_advance NUMERIC;
          bill_vehicle_details JSONB;
          bill_driver_allowance NUMERIC;
          bill_threshold TEXT;
          bill_start TIMESTAMPTZ;
          bill_end TIMESTAMPTZ;
          bill_pickup TEXT;
          bill_dropoff TEXT;
          bill_start_odo NUMERIC;
          bill_end_odo NUMERIC;
          bill_km NUMERIC;
          bill_km_method TEXT;
          bill_customer_name TEXT;
          bill_customer_phone TEXT;
          bill_payment_method TEXT;
          bill_account_type TEXT;
          bill_collected_by TEXT;
        BEGIN
          SELECT total_amount, advance_amount, vehicle_details, total_driver_allowance, threshold_note,
                 start_at, end_at, pickup, dropoff, start_odometer_reading, end_odometer_reading,
                 total_km_driven, km_calculation_method, customer_name, customer_phone,
                 advance_payment_method, advance_account_type, advance_collected_by
          INTO bill_total, bill_advance, bill_vehicle_details, bill_driver_allowance, bill_threshold,
               bill_start, bill_end, bill_pickup, bill_dropoff, bill_start_odo, bill_end_odo,
               bill_km, bill_km_method, bill_customer_name, bill_customer_phone,
               bill_payment_method, bill_account_type, bill_collected_by
          FROM public.bills
          WHERE id = bill_ids[i];
          
          -- Build transfer requirements
          transfer_requirements := '[]'::jsonb;
          IF transfer_ids[i] IS NOT NULL THEN
            SELECT jsonb_build_array(
              jsonb_build_object(
                'transfer_id', transfer_ids[i]::TEXT,
                'amount', bill_advance,
                'from_account_type', CASE WHEN bill_payment_method = 'cash' THEN 'cash' ELSE 'personal' END,
                'collected_by_name', COALESCE(bill_collected_by, collected_by_names[1 + floor(random() * array_length(collected_by_names, 1))::INTEGER]) || ' (Test)',
                'status', transfer_statuses[1 + floor(random() * array_length(transfer_statuses, 1))::INTEGER]
              )
            ) INTO transfer_requirements;
          END IF;
        
        company_bill_number := 'PT-CB-2026-' || lpad(i::TEXT, 6, '0');
        
          INSERT INTO public.company_bills (
            booking_id,
            customer_bill_id,
            bill_number,
            customer_name,
            customer_phone,
            start_at,
            end_at,
            pickup,
            dropoff,
            start_odometer_reading,
            end_odometer_reading,
            total_km_driven,
            km_calculation_method,
            vehicle_details,
            total_amount,
            total_driver_allowance,
            advance_amount,
            advance_payment_method,
            advance_account_type,
            advance_collected_by,
            transfer_requirements,
            internal_notes,
            threshold_note,
            created_by
          ) VALUES (
            booking_ids[i],
            bill_ids[i],
            company_bill_number,
            bill_customer_name,
            bill_customer_phone,
            bill_start,
            bill_end,
            bill_pickup,
            bill_dropoff,
            bill_start_odo,
            bill_end_odo,
            bill_km,
            bill_km_method,
            bill_vehicle_details,
            bill_total,
            bill_driver_allowance,
            bill_advance,
            bill_payment_method,
            bill_account_type,
            bill_collected_by,
            transfer_requirements,
            CASE WHEN random() < 0.2 THEN 'Test internal note' ELSE NULL END,
            bill_threshold,
            admin_user_id
          ) RETURNING id INTO company_bill_ids[i];
          
          -- Initialize array if needed
          IF company_bill_ids[i] IS NULL THEN
            company_bill_ids := array_append(company_bill_ids, NULL);
          END IF;
        END;
      END IF;
    END LOOP;
  END IF;
  
  RAISE NOTICE 'Created 50 dummy billing records';
END $$;

-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';
