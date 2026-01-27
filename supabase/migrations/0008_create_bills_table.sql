-- Migration 0008: Create bills table for customer/final bills
-- Bills are generated after trip completion with final KM calculations

-- Create bill status enum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'bill_status') THEN
    CREATE TYPE public.bill_status AS ENUM ('draft', 'sent', 'paid');
  END IF;
END $$;

-- Create bills table
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'bookings') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'bills') THEN
      CREATE TABLE public.bills (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
        bill_number TEXT UNIQUE NOT NULL DEFAULT ('PT-BILL-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.booking_ref_seq')::text, 6, '0')),
        status public.bill_status NOT NULL DEFAULT 'draft',
        
        -- Customer details
        customer_name TEXT NOT NULL,
        customer_phone TEXT NOT NULL,
        
        -- Trip details
        start_at TIMESTAMPTZ NOT NULL,
        end_at TIMESTAMPTZ NOT NULL,
        pickup TEXT,
        dropoff TEXT,
        
        -- KM details
        start_odometer_reading NUMERIC,
        end_odometer_reading NUMERIC,
        total_km_driven NUMERIC NOT NULL,
        km_calculation_method TEXT NOT NULL CHECK (km_calculation_method IN ('odometer', 'manual')),
        
        -- Vehicle and driver details (stored as JSONB for multiple vehicles)
        vehicle_details JSONB NOT NULL DEFAULT '[]'::jsonb,
        -- Format: [{"vehicle_number": "...", "driver_name": "...", "driver_phone": "...", "rate_type": "...", "rate_breakdown": {...}, "final_amount": 0}]
        
        -- Amounts
        total_amount NUMERIC NOT NULL DEFAULT 0,
        advance_amount NUMERIC NOT NULL DEFAULT 0,
        balance_amount NUMERIC NOT NULL DEFAULT 0,
        
        -- Threshold note (if minimum KM threshold was applied)
        threshold_note TEXT,
        
        -- PDF file path
        pdf_file_path TEXT,
        pdf_file_name TEXT,
        
        -- Metadata
        created_by UUID REFERENCES auth.users(id),
        sent_at TIMESTAMPTZ,
        paid_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      
      -- Create index on booking_id for faster lookups
      CREATE INDEX idx_bills_booking_id ON public.bills(booking_id);
      CREATE INDEX idx_bills_status ON public.bills(status);
      CREATE INDEX idx_bills_bill_number ON public.bills(bill_number);
      
      -- Enable RLS
      ALTER TABLE public.bills ENABLE ROW LEVEL SECURITY;
      
      -- RLS policies
      CREATE POLICY "Authenticated users can view bills"
      ON public.bills FOR SELECT
      TO authenticated
      USING (true);
      
      CREATE POLICY "Admin and Manager can insert bills"
      ON public.bills FOR INSERT
      TO authenticated
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.user_roles 
          WHERE user_id = auth.uid() 
          AND role::text IN ('admin', 'manager')
        )
      );
      
      CREATE POLICY "Admin and Manager can update bills"
      ON public.bills FOR UPDATE
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.user_roles 
          WHERE user_id = auth.uid() 
          AND role::text IN ('admin', 'manager')
        )
      );
      
      -- Trigger for updated_at
      CREATE TRIGGER update_bills_updated_at
      BEFORE UPDATE ON public.bills
      FOR EACH ROW
      EXECUTE FUNCTION public.update_updated_at_column();
    END IF;
  END IF;
END $$;

-- Add final_km column to booking_vehicles if it doesn't exist
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'booking_vehicles') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'booking_vehicles' 
      AND column_name = 'final_km'
    ) THEN
      ALTER TABLE public.booking_vehicles ADD COLUMN final_km NUMERIC;
    END IF;
  END IF;
END $$;

-- Add start_odometer_reading and end_odometer_reading to bookings table
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'bookings') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'bookings' 
      AND column_name = 'start_odometer_reading'
    ) THEN
      ALTER TABLE public.bookings ADD COLUMN start_odometer_reading NUMERIC;
    END IF;
    
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'bookings' 
      AND column_name = 'end_odometer_reading'
    ) THEN
      ALTER TABLE public.bookings ADD COLUMN end_odometer_reading NUMERIC;
    END IF;
  END IF;
END $$;
