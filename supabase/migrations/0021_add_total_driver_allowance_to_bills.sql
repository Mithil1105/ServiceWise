-- Migration 0021: Add total_driver_allowance column to bills table
-- This column stores the total driver allowance amount for the entire bill

DO $$
BEGIN
  -- Add total_driver_allowance column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'bills'
    AND column_name = 'total_driver_allowance'
  ) THEN
    ALTER TABLE public.bills
    ADD COLUMN total_driver_allowance NUMERIC NOT NULL DEFAULT 0;
    
    COMMENT ON COLUMN public.bills.total_driver_allowance IS 'Total driver allowance amount for all vehicles in this bill';
  END IF;
END $$;

-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';
