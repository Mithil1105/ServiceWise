-- Migration 0020: Add advance payment fields to bookings table
-- These fields were moved from booking_requested_vehicles to bookings (booking-level advance payment)

DO $$
BEGIN
  -- Add advance_amount column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'bookings' 
    AND column_name = 'advance_amount'
  ) THEN
    ALTER TABLE public.bookings
    ADD COLUMN advance_amount NUMERIC DEFAULT 0;
  END IF;

  -- Add advance_payment_method column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'bookings' 
    AND column_name = 'advance_payment_method'
  ) THEN
    ALTER TABLE public.bookings
    ADD COLUMN advance_payment_method TEXT CHECK (advance_payment_method IN ('cash', 'online'));
  END IF;

  -- Add advance_collected_by column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'bookings' 
    AND column_name = 'advance_collected_by'
  ) THEN
    ALTER TABLE public.bookings
    ADD COLUMN advance_collected_by TEXT;
  END IF;

  -- Add advance_account_type column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'bookings' 
    AND column_name = 'advance_account_type'
  ) THEN
    ALTER TABLE public.bookings
    ADD COLUMN advance_account_type TEXT CHECK (advance_account_type IN ('company', 'personal'));
  END IF;

  -- Add advance_account_id column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'bookings' 
    AND column_name = 'advance_account_id'
  ) THEN
    ALTER TABLE public.bookings
    ADD COLUMN advance_account_id UUID;
    
    -- Add foreign key constraint if bank_accounts table exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'bank_accounts') THEN
      ALTER TABLE public.bookings
      ADD CONSTRAINT bookings_advance_account_id_fkey
      FOREIGN KEY (advance_account_id) REFERENCES public.bank_accounts(id);
    END IF;
  END IF;
END $$;

-- Add comments for documentation
COMMENT ON COLUMN public.bookings.advance_amount IS 'Advance payment amount for the entire booking (not per vehicle)';
COMMENT ON COLUMN public.bookings.advance_payment_method IS 'Payment method: cash or online';
COMMENT ON COLUMN public.bookings.advance_collected_by IS 'Name of the person who collected the advance payment';
COMMENT ON COLUMN public.bookings.advance_account_type IS 'Account type: company or personal (only for online payments)';
COMMENT ON COLUMN public.bookings.advance_account_id IS 'Bank account ID where advance was received (only for online payments)';

-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';
