-- Add 'oneway' to rate_type enum
-- This migration adds the new 'oneway' rate type to the existing enum

DO $$ 
BEGIN
  -- Check if 'oneway' already exists in the enum
  IF NOT EXISTS (
    SELECT 1 
    FROM pg_enum 
    WHERE enumlabel = 'oneway' 
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'rate_type')
  ) THEN
    -- Add 'oneway' to the rate_type enum
    ALTER TYPE public.rate_type ADD VALUE 'oneway';
  END IF;
END $$;

-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';
