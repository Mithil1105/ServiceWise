-- Migration 0010: Create missing tables - booking_requested_vehicles, bank_accounts, and bills
-- This migration creates the three tables that are missing from the database

-- ============================================================================
-- 1. Create booking_requested_vehicles table
-- ============================================================================
DO $$
BEGIN
  -- Only create if bookings table exists
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'bookings') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'booking_requested_vehicles') THEN
      -- Ensure rate_type enum exists
      IF NOT EXISTS (
        SELECT 1 FROM pg_type t
        JOIN pg_namespace n ON t.typnamespace = n.oid
        WHERE n.nspname = 'public' AND t.typname = 'rate_type'
      ) THEN
        CREATE TYPE public.rate_type AS ENUM ('total', 'per_day', 'per_km', 'hybrid');
      END IF;

      -- Create booking_requested_vehicles table
      CREATE TABLE public.booking_requested_vehicles (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
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

    -- Create indexes
    CREATE INDEX idx_booking_requested_vehicles_booking_id ON public.booking_requested_vehicles(booking_id);
    CREATE INDEX idx_booking_requested_vehicles_requested_vehicle_id ON public.booking_requested_vehicles(id);

    -- Enable RLS
    ALTER TABLE public.booking_requested_vehicles ENABLE ROW LEVEL SECURITY;

    -- RLS Policies
    CREATE POLICY "Authenticated users can view requested vehicles"
    ON public.booking_requested_vehicles FOR SELECT
    TO authenticated
    USING (true);

    CREATE POLICY "Admin and Manager can insert requested vehicles"
    ON public.booking_requested_vehicles FOR INSERT
    TO authenticated
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM public.user_roles 
        WHERE user_id = auth.uid() 
        AND role::text IN ('admin', 'manager')
      )
    );

    CREATE POLICY "Admin and Manager can update requested vehicles"
    ON public.booking_requested_vehicles FOR UPDATE
    TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM public.user_roles 
        WHERE user_id = auth.uid() 
        AND role::text IN ('admin', 'manager')
      )
    );

    CREATE POLICY "Admin and Manager can delete requested vehicles"
    ON public.booking_requested_vehicles FOR DELETE
    TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM public.user_roles 
        WHERE user_id = auth.uid() 
        AND role::text IN ('admin', 'manager')
      )
    );

    -- Add requested_vehicle_id column to booking_vehicles if it doesn't exist
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'booking_vehicles') THEN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'booking_vehicles' 
        AND column_name = 'requested_vehicle_id'
      ) THEN
        ALTER TABLE public.booking_vehicles
        ADD COLUMN requested_vehicle_id UUID REFERENCES public.booking_requested_vehicles(id) ON DELETE SET NULL;
        
        CREATE INDEX IF NOT EXISTS idx_booking_vehicles_requested_vehicle_id ON public.booking_vehicles(requested_vehicle_id);
      END IF;
    END IF;
    END IF; -- Close IF NOT EXISTS booking_requested_vehicles
  END IF; -- Close IF EXISTS bookings
END $$;

-- ============================================================================
-- 2. Create bank_accounts table
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'bank_accounts') THEN
    CREATE TABLE public.bank_accounts (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      account_name TEXT NOT NULL,
      account_number TEXT,
      bank_name TEXT,
      ifsc_code TEXT,
      account_type TEXT NOT NULL CHECK (account_type IN ('company', 'personal')),
      is_active BOOLEAN NOT NULL DEFAULT true,
      notes TEXT,
      created_by UUID REFERENCES auth.users(id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    -- Create indexes
    CREATE INDEX idx_bank_accounts_account_type ON public.bank_accounts(account_type);
    CREATE INDEX idx_bank_accounts_is_active ON public.bank_accounts(is_active);

    -- Enable RLS
    ALTER TABLE public.bank_accounts ENABLE ROW LEVEL SECURITY;

    -- RLS Policies
    CREATE POLICY "Authenticated users can view bank accounts"
    ON public.bank_accounts FOR SELECT
    TO authenticated
    USING (true);

    CREATE POLICY "Admin and Manager can insert bank accounts"
    ON public.bank_accounts FOR INSERT
    TO authenticated
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM public.user_roles 
        WHERE user_id = auth.uid() 
        AND role::text IN ('admin', 'manager')
      )
    );

    CREATE POLICY "Admin and Manager can update bank accounts"
    ON public.bank_accounts FOR UPDATE
    TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM public.user_roles 
        WHERE user_id = auth.uid() 
        AND role::text IN ('admin', 'manager')
      )
    );

    CREATE POLICY "Admin can delete bank accounts"
    ON public.bank_accounts FOR DELETE
    TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM public.user_roles 
        WHERE user_id = auth.uid() 
        AND role::text = 'admin'
      )
    );

    -- Add foreign key constraint for advance_account_id in booking_requested_vehicles
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'booking_requested_vehicles') THEN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'booking_requested_vehicles' 
        AND column_name = 'advance_account_id'
      ) THEN
        -- Drop existing constraint if any
        ALTER TABLE public.booking_requested_vehicles
        DROP CONSTRAINT IF EXISTS booking_requested_vehicles_advance_account_id_fkey;
        
        -- Add foreign key constraint
        ALTER TABLE public.booking_requested_vehicles
        ADD CONSTRAINT booking_requested_vehicles_advance_account_id_fkey
        FOREIGN KEY (advance_account_id) REFERENCES public.bank_accounts(id);
      END IF;
    END IF;
  END IF;
END $$;

-- ============================================================================
-- 3. Create bills table
-- ============================================================================
DO $$
BEGIN
  -- Only create if bookings table exists
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'bookings') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'bills') THEN
    -- Ensure bill_status enum exists
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'bill_status') THEN
      CREATE TYPE public.bill_status AS ENUM ('draft', 'sent', 'paid');
    END IF;

    -- Ensure booking_ref_seq exists (needed for bill_number generation)
    CREATE SEQUENCE IF NOT EXISTS public.booking_ref_seq START 1;

    -- Create bills table
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
      payment_reminder_sent_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    
    -- Create indexes
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

    -- Trigger for updated_at (only if function exists)
    IF EXISTS (
      SELECT 1 FROM pg_proc p
      JOIN pg_namespace n ON p.pronamespace = n.oid
      WHERE n.nspname = 'public' AND p.proname = 'update_updated_at_column'
    ) THEN
      CREATE TRIGGER update_bills_updated_at
      BEFORE UPDATE ON public.bills
      FOR EACH ROW
      EXECUTE FUNCTION public.update_updated_at_column();
    END IF;
    END IF; -- Close IF NOT EXISTS bills
  END IF; -- Close IF EXISTS bookings
END $$;

-- ============================================================================
-- 4. Add final_km column to booking_vehicles if it doesn't exist
-- ============================================================================
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

-- ============================================================================
-- 5. Add odometer reading columns to bookings if they don't exist
-- ============================================================================
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
