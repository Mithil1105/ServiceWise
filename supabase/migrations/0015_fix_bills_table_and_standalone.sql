-- Migration 0015: Fix bills table to allow standalone bills (no booking required)
-- This also ensures all tables exist and booking_id is nullable

-- Ensure enums exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'rate_type') THEN
    CREATE TYPE public.rate_type AS ENUM ('total', 'per_day', 'per_km', 'hybrid');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'bill_status') THEN
    CREATE TYPE public.bill_status AS ENUM ('draft', 'sent', 'paid');
  END IF;
END $$;

-- Create sequence for bill numbers
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

-- Drop and recreate bills table with nullable booking_id
DO $$
BEGIN
  -- Drop existing bills table if it exists (will cascade to dependent objects)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'bills') THEN
    DROP TABLE public.bills CASCADE;
  END IF;

  -- Create bills table with nullable booking_id for standalone bills
  CREATE TABLE public.bills (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id UUID, -- NULLABLE for standalone bills
    bill_number TEXT UNIQUE NOT NULL DEFAULT public.generate_bill_number(),
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
    total_km_driven NUMERIC NOT NULL DEFAULT 0,
    km_calculation_method TEXT NOT NULL DEFAULT 'manual' CHECK (km_calculation_method IN ('odometer', 'manual')),
    
    -- Vehicle and driver details (stored as JSONB for multiple vehicles)
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
    
    -- Timestamps
    created_by UUID REFERENCES auth.users(id),
    sent_at TIMESTAMPTZ,
    paid_at TIMESTAMPTZ,
    payment_reminder_sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );

  -- Add foreign key constraint only if booking_id is not null and bookings table exists
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'bookings') THEN
    ALTER TABLE public.bills
      ADD CONSTRAINT bills_booking_id_fkey
      FOREIGN KEY (booking_id) REFERENCES public.bookings(id) ON DELETE SET NULL;
  END IF;

  -- Create indexes
  CREATE INDEX IF NOT EXISTS idx_bills_booking_id ON public.bills(booking_id);
  CREATE INDEX IF NOT EXISTS idx_bills_status ON public.bills(status);
  CREATE INDEX IF NOT EXISTS idx_bills_bill_number ON public.bills(bill_number);
  CREATE INDEX IF NOT EXISTS idx_bills_created_at ON public.bills(created_at);
  CREATE INDEX IF NOT EXISTS idx_bills_customer_phone ON public.bills(customer_phone);
END $$;

-- Ensure booking_requested_vehicles table exists
DO $$
BEGIN
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

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'bookings') THEN
      ALTER TABLE public.booking_requested_vehicles
        ADD CONSTRAINT booking_requested_vehicles_booking_id_fkey
        FOREIGN KEY (booking_id) REFERENCES public.bookings(id) ON DELETE CASCADE;
    END IF;

    CREATE INDEX IF NOT EXISTS idx_booking_requested_vehicles_booking_id ON public.booking_requested_vehicles(booking_id);
    CREATE INDEX IF NOT EXISTS idx_booking_requested_vehicles_created_at ON public.booking_requested_vehicles(created_at);
  END IF;
END $$;

-- Ensure bank_accounts table exists
DO $$
BEGIN
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
END $$;

-- RLS Policies for bills
DO $$
BEGIN
  -- Drop existing policies if they exist
  DROP POLICY IF EXISTS "Admin and Manager can create bills" ON public.bills;
  DROP POLICY IF EXISTS "Admin and Manager can update bills" ON public.bills;
  DROP POLICY IF EXISTS "Admin and Manager can delete bills" ON public.bills;
  DROP POLICY IF EXISTS "Authenticated users can view bills" ON public.bills;

  -- Create policies
  CREATE POLICY "Admin and Manager can create bills" ON public.bills
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

  CREATE POLICY "Admin and Manager can delete bills" ON public.bills
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
END $$;

-- Force PostgREST to refresh schema cache
DO $$
BEGIN
  DROP VIEW IF EXISTS public._postgrest_refresh_schema CASCADE;
  CREATE VIEW public._postgrest_refresh_schema AS 
  SELECT 1 as dummy;
  DROP VIEW IF EXISTS public._postgrest_refresh_schema CASCADE;
END $$;
