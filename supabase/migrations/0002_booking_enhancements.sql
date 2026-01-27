-- Migration 0002: Add minimum KM thresholds and advance payment details
-- This adds minimum charge thresholds for per_km and hybrid rates,
-- and detailed advance payment tracking

-- Ensure app_role enum exists (it should be created in an earlier migration)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON t.typnamespace = n.oid
    WHERE n.nspname = 'public' AND t.typname = 'app_role'
  ) THEN
    CREATE TYPE public.app_role AS ENUM ('admin', 'manager', 'supervisor');
  END IF;
END $$;

-- Add minimum_km to booking_requested_vehicles for per_km and hybrid rates
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'booking_requested_vehicles') THEN
    -- Add minimum_km column if it doesn't exist
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'booking_requested_vehicles' 
      AND column_name = 'minimum_km'
    ) THEN
      ALTER TABLE public.booking_requested_vehicles
      ADD COLUMN minimum_km NUMERIC DEFAULT NULL;
    END IF;
  END IF;
END $$;

-- Create bank_accounts table for storing company and personal accounts
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

    -- Enable RLS
    ALTER TABLE public.bank_accounts ENABLE ROW LEVEL SECURITY;

    -- Policies
    CREATE POLICY "Authenticated users can view bank accounts" ON public.bank_accounts
      FOR SELECT TO authenticated USING (true);

    -- Policies using role::text to avoid enum casting issues
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
  END IF;
END $$;

-- Add advance payment details to booking_requested_vehicles
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'booking_requested_vehicles') THEN
    -- Add payment_method column
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'booking_requested_vehicles' 
      AND column_name = 'advance_payment_method'
    ) THEN
      ALTER TABLE public.booking_requested_vehicles
      ADD COLUMN advance_payment_method TEXT CHECK (advance_payment_method IN ('cash', 'online'));
    END IF;

    -- Add collected_by column (for cash payments)
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'booking_requested_vehicles' 
      AND column_name = 'advance_collected_by'
    ) THEN
      ALTER TABLE public.booking_requested_vehicles
      ADD COLUMN advance_collected_by TEXT;
    END IF;

    -- Add account_type column (for online payments)
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'booking_requested_vehicles' 
      AND column_name = 'advance_account_type'
    ) THEN
      ALTER TABLE public.booking_requested_vehicles
      ADD COLUMN advance_account_type TEXT CHECK (advance_account_type IN ('company', 'personal'));
    END IF;

    -- Add account_id column (for online payments)
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'booking_requested_vehicles' 
      AND column_name = 'advance_account_id'
    ) THEN
      ALTER TABLE public.booking_requested_vehicles
      ADD COLUMN advance_account_id UUID REFERENCES public.bank_accounts(id);
    END IF;
  END IF;
END $$;

-- Add comments for documentation
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'booking_requested_vehicles') THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'booking_requested_vehicles' 
      AND column_name = 'minimum_km'
    ) THEN
      COMMENT ON COLUMN public.booking_requested_vehicles.minimum_km IS 'Minimum KM to charge for per_km and hybrid rates. For hybrid: minimum_km × number of days';
    END IF;
  END IF;
END $$;
