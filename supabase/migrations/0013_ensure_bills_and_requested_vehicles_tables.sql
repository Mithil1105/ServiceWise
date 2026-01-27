-- Migration: Ensure bills and booking_requested_vehicles tables exist
-- This migration ensures all required tables for billing functionality exist

-- Create sequence for bill numbers if it doesn't exist
CREATE SEQUENCE IF NOT EXISTS public.bill_number_seq START 1;

-- Create function to generate bill number
CREATE OR REPLACE FUNCTION public.generate_bill_number()
RETURNS TEXT AS $$
DECLARE
  year_part TEXT;
  seq_num INTEGER;
  bill_num TEXT;
BEGIN
  year_part := to_char(now(), 'YYYY');
  seq_num := nextval('public.bill_number_seq');
  bill_num := 'PT-BILL-' || year_part || '-' || lpad(seq_num::text, 6, '0');
  RETURN bill_num;
END;
$$ LANGUAGE plpgsql;

DO $$ 
BEGIN
  -- Create rate_type enum if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'rate_type') THEN
    CREATE TYPE public.rate_type AS ENUM ('total', 'per_day', 'per_km', 'hybrid');
  END IF;

  -- Create bill_status enum if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'bill_status') THEN
    CREATE TYPE public.bill_status AS ENUM ('draft', 'sent', 'paid');
  END IF;

  -- Create booking_requested_vehicles table if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'booking_requested_vehicles') THEN
    CREATE TABLE public.booking_requested_vehicles (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      booking_id UUID NOT NULL,
      brand TEXT NOT NULL,
      model TEXT NOT NULL,
      rate_type public.rate_type NOT NULL DEFAULT 'total',
      rate_total NUMERIC,
      rate_per_day NUMERIC,
      rate_per_km NUMERIC,
      estimated_km NUMERIC,
      advance_amount NUMERIC DEFAULT 0,
      advance_payment_method TEXT CHECK (advance_payment_method IN ('cash', 'online')),
      advance_collected_by TEXT,
      advance_account_type TEXT CHECK (advance_account_type IN ('company', 'personal')),
      advance_account_id UUID,
      created_by UUID REFERENCES auth.users(id),
      updated_by UUID REFERENCES auth.users(id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    -- Add foreign key constraint if bookings table exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'bookings') THEN
      ALTER TABLE public.booking_requested_vehicles
        ADD CONSTRAINT booking_requested_vehicles_booking_id_fkey
        FOREIGN KEY (booking_id) REFERENCES public.bookings(id) ON DELETE CASCADE;
    END IF;

    -- Add foreign key constraint if bank_accounts table exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'bank_accounts') THEN
      ALTER TABLE public.booking_requested_vehicles
        ADD CONSTRAINT booking_requested_vehicles_advance_account_id_fkey
        FOREIGN KEY (advance_account_id) REFERENCES public.bank_accounts(id);
    END IF;

    -- Create indexes
    CREATE INDEX IF NOT EXISTS idx_booking_requested_vehicles_booking_id ON public.booking_requested_vehicles(booking_id);
    CREATE INDEX IF NOT EXISTS idx_booking_requested_vehicles_created_at ON public.booking_requested_vehicles(created_at);
  END IF;

  -- Create bank_accounts table if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'bank_accounts') THEN
    CREATE TABLE public.bank_accounts (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      account_name TEXT NOT NULL,
      account_number TEXT NOT NULL,
      bank_name TEXT NOT NULL,
      ifsc_code TEXT,
      account_type TEXT NOT NULL CHECK (account_type IN ('company', 'personal')),
      is_active BOOLEAN DEFAULT true,
      notes TEXT,
      created_by UUID REFERENCES auth.users(id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE INDEX IF NOT EXISTS idx_bank_accounts_account_type ON public.bank_accounts(account_type);
    CREATE INDEX IF NOT EXISTS idx_bank_accounts_is_active ON public.bank_accounts(is_active);
  END IF;


  -- Create bills table if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'bills') THEN
    CREATE TABLE public.bills (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      booking_id UUID NOT NULL,
      bill_number TEXT NOT NULL DEFAULT public.generate_bill_number(),
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
      km_calculation_method TEXT NOT NULL CHECK (km_calculation_method IN ('odometer', 'manual')),
      start_odometer_reading NUMERIC,
      end_odometer_reading NUMERIC,
      total_km_driven NUMERIC NOT NULL,
      
      -- Vehicle details (JSONB array)
      vehicle_details JSONB NOT NULL DEFAULT '[]'::jsonb,
      
      -- Amounts
      total_amount NUMERIC NOT NULL DEFAULT 0,
      advance_amount NUMERIC NOT NULL DEFAULT 0,
      balance_amount NUMERIC NOT NULL DEFAULT 0,
      
      -- Threshold note
      threshold_note TEXT,
      
      -- PDF storage
      pdf_file_path TEXT,
      pdf_file_name TEXT,
      
      -- Payment reminder
      payment_reminder_sent_at TIMESTAMPTZ,
      
      -- Status timestamps
      sent_at TIMESTAMPTZ,
      paid_at TIMESTAMPTZ,
      
      -- Metadata
      created_by UUID REFERENCES auth.users(id),
      updated_by UUID REFERENCES auth.users(id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    -- Add foreign key constraint if bookings table exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'bookings') THEN
      ALTER TABLE public.bills
        ADD CONSTRAINT bills_booking_id_fkey
        FOREIGN KEY (booking_id) REFERENCES public.bookings(id) ON DELETE CASCADE;
    END IF;

    -- Create unique constraint on bill_number
    CREATE UNIQUE INDEX IF NOT EXISTS idx_bills_bill_number_unique ON public.bills(bill_number);
    
    -- Create indexes
    CREATE INDEX IF NOT EXISTS idx_bills_booking_id ON public.bills(booking_id);
    CREATE INDEX IF NOT EXISTS idx_bills_bill_number ON public.bills(bill_number);
    CREATE INDEX IF NOT EXISTS idx_bills_status ON public.bills(status);
    CREATE INDEX IF NOT EXISTS idx_bills_created_at ON public.bills(created_at);
    CREATE INDEX IF NOT EXISTS idx_bills_sent_at ON public.bills(sent_at);
  END IF;

  -- Add requested_vehicle_id column to booking_vehicles if it doesn't exist
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'booking_vehicles') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'booking_vehicles' 
      AND column_name = 'requested_vehicle_id'
    ) THEN
      ALTER TABLE public.booking_vehicles
        ADD COLUMN requested_vehicle_id UUID;

      -- Add foreign key constraint if booking_requested_vehicles table exists
      IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'booking_requested_vehicles') THEN
        ALTER TABLE public.booking_vehicles
          ADD CONSTRAINT booking_vehicles_requested_vehicle_id_fkey
          FOREIGN KEY (requested_vehicle_id) REFERENCES public.booking_requested_vehicles(id) ON DELETE SET NULL;
      END IF;
    END IF;

    -- Add final_km column if it doesn't exist
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'booking_vehicles' 
      AND column_name = 'final_km'
    ) THEN
      ALTER TABLE public.booking_vehicles
        ADD COLUMN final_km NUMERIC;
    END IF;
  END IF;

  -- Add odometer reading columns to bookings if they don't exist
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'bookings') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'bookings' 
      AND column_name = 'start_odometer_reading'
    ) THEN
      ALTER TABLE public.bookings
        ADD COLUMN start_odometer_reading NUMERIC;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'bookings' 
      AND column_name = 'end_odometer_reading'
    ) THEN
      ALTER TABLE public.bookings
        ADD COLUMN end_odometer_reading NUMERIC;
    END IF;
  END IF;

END $$;

-- Enable RLS on all tables
DO $$ 
BEGIN
  -- RLS for booking_requested_vehicles
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'booking_requested_vehicles') THEN
    ALTER TABLE public.booking_requested_vehicles ENABLE ROW LEVEL SECURITY;

    -- Drop existing policies if they exist
    DROP POLICY IF EXISTS "Admin and Manager can insert requested vehicles" ON public.booking_requested_vehicles;
    DROP POLICY IF EXISTS "Admin and Manager can update requested vehicles" ON public.booking_requested_vehicles;
    DROP POLICY IF EXISTS "Admin and Manager can delete requested vehicles" ON public.booking_requested_vehicles;
    DROP POLICY IF EXISTS "Authenticated users can view requested vehicles" ON public.booking_requested_vehicles;

    -- Create policies
    CREATE POLICY "Admin and Manager can insert requested vehicles" ON public.booking_requested_vehicles
      FOR INSERT TO authenticated
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.user_roles 
          WHERE user_id = auth.uid() 
          AND role::text IN ('admin', 'manager')
        )
      );

    CREATE POLICY "Admin and Manager can update requested vehicles" ON public.booking_requested_vehicles
      FOR UPDATE TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.user_roles 
          WHERE user_id = auth.uid() 
          AND role::text IN ('admin', 'manager')
        )
      );

    CREATE POLICY "Admin and Manager can delete requested vehicles" ON public.booking_requested_vehicles
      FOR DELETE TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.user_roles 
          WHERE user_id = auth.uid() 
          AND role::text IN ('admin', 'manager')
        )
      );

    CREATE POLICY "Authenticated users can view requested vehicles" ON public.booking_requested_vehicles
      FOR SELECT TO authenticated
      USING (true);
  END IF;

  -- RLS for bank_accounts
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'bank_accounts') THEN
    ALTER TABLE public.bank_accounts ENABLE ROW LEVEL SECURITY;

    -- Drop existing policies if they exist
    DROP POLICY IF EXISTS "Admin and Manager can insert bank accounts" ON public.bank_accounts;
    DROP POLICY IF EXISTS "Admin and Manager can update bank accounts" ON public.bank_accounts;
    DROP POLICY IF EXISTS "Admin can delete bank accounts" ON public.bank_accounts;
    DROP POLICY IF EXISTS "Authenticated users can view bank accounts" ON public.bank_accounts;

    -- Create policies
    CREATE POLICY "Admin and Manager can insert bank accounts" ON public.bank_accounts
      FOR INSERT TO authenticated
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.user_roles 
          WHERE user_id = auth.uid() 
          AND role::text IN ('admin', 'manager')
        )
      );

    CREATE POLICY "Admin and Manager can update bank accounts" ON public.bank_accounts
      FOR UPDATE TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.user_roles 
          WHERE user_id = auth.uid() 
          AND role::text IN ('admin', 'manager')
        )
      );

    CREATE POLICY "Admin can delete bank accounts" ON public.bank_accounts
      FOR DELETE TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.user_roles 
          WHERE user_id = auth.uid() 
          AND role::text = 'admin'
        )
      );

    CREATE POLICY "Authenticated users can view bank accounts" ON public.bank_accounts
      FOR SELECT TO authenticated
      USING (true);
  END IF;

  -- RLS for bills
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'bills') THEN
    ALTER TABLE public.bills ENABLE ROW LEVEL SECURITY;

    -- Drop existing policies if they exist
    DROP POLICY IF EXISTS "Admin and Manager can insert bills" ON public.bills;
    DROP POLICY IF EXISTS "Admin and Manager can update bills" ON public.bills;
    DROP POLICY IF EXISTS "Admin can delete bills" ON public.bills;
    DROP POLICY IF EXISTS "Authenticated users can view bills" ON public.bills;

    -- Create policies
    CREATE POLICY "Admin and Manager can insert bills" ON public.bills
      FOR INSERT TO authenticated
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.user_roles 
          WHERE user_id = auth.uid() 
          AND role::text IN ('admin', 'manager')
        )
      );

    CREATE POLICY "Admin and Manager can update bills" ON public.bills
      FOR UPDATE TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.user_roles 
          WHERE user_id = auth.uid() 
          AND role::text IN ('admin', 'manager')
        )
      );

    CREATE POLICY "Admin can delete bills" ON public.bills
      FOR DELETE TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.user_roles 
          WHERE user_id = auth.uid() 
          AND role::text = 'admin'
        )
      );

    CREATE POLICY "Authenticated users can view bills" ON public.bills
      FOR SELECT TO authenticated
      USING (true);
  END IF;

END $$;

-- Create storage bucket for bills if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM storage.buckets WHERE id = 'bills'
  ) THEN
    INSERT INTO storage.buckets (id, name, public)
    VALUES ('bills', 'bills', false)
    ON CONFLICT (id) DO NOTHING;
  END IF;
END $$;

-- Create storage policies for bills bucket
DO $$
BEGIN
  -- Drop existing policies if they exist
  DROP POLICY IF EXISTS "Authenticated users can upload bills" ON storage.objects;
  DROP POLICY IF EXISTS "Authenticated users can view bills" ON storage.objects;
  DROP POLICY IF EXISTS "Admin and Manager can delete bills" ON storage.objects;

  -- Create policies
  CREATE POLICY "Authenticated users can upload bills" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (
      bucket_id = 'bills' AND
      EXISTS (
        SELECT 1 FROM public.user_roles 
        WHERE user_id = auth.uid() 
        AND role::text IN ('admin', 'manager')
      )
    );

  CREATE POLICY "Authenticated users can view bills" ON storage.objects
    FOR SELECT TO authenticated
    USING (bucket_id = 'bills');

    CREATE POLICY "Admin and Manager can delete bills" ON storage.objects
    FOR DELETE TO authenticated
    USING (
      bucket_id = 'bills' AND
      EXISTS (
        SELECT 1 FROM public.user_roles 
        WHERE user_id = auth.uid() 
        AND role::text IN ('admin', 'manager')
      )
    );
END $$;

-- Force PostgREST to refresh schema cache
-- This is critical for Supabase to recognize the new tables immediately
DO $$
BEGIN
  -- Create and drop a dummy view to force schema refresh
  DROP VIEW IF EXISTS public._postgrest_refresh_schema CASCADE;
  CREATE VIEW public._postgrest_refresh_schema AS 
  SELECT 1 as dummy;
  DROP VIEW IF EXISTS public._postgrest_refresh_schema CASCADE;
END $$;
