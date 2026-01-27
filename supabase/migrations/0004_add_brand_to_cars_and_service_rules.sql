-- Migration 0004: Add brand column to cars and service_rules tables
-- This enables brand-specific service rules

-- Add brand column to cars table
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'cars') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'cars' 
      AND column_name = 'brand'
    ) THEN
      ALTER TABLE public.cars ADD COLUMN brand TEXT;
    END IF;
  END IF;
END $$;

-- Add brand column to service_rules table
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'service_rules') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'service_rules' 
      AND column_name = 'brand'
    ) THEN
      ALTER TABLE public.service_rules ADD COLUMN brand TEXT;
      
      -- Add comment explaining that brand is required for new rules
      COMMENT ON COLUMN public.service_rules.brand IS 'Brand name (e.g., Toyota, Maruti). Required for brand-specific service rules. NULL for legacy global rules (kept as template).';
    END IF;
  END IF;
END $$;

-- Create index on brand column in cars table for faster lookups
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'cars') THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'cars' AND column_name = 'brand') THEN
      IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE schemaname = 'public' 
        AND tablename = 'cars' 
        AND indexname = 'idx_cars_brand'
      ) THEN
        CREATE INDEX idx_cars_brand ON public.cars(brand);
      END IF;
    END IF;
  END IF;
END $$;

-- Create index on brand column in service_rules table
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'service_rules') THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'service_rules' AND column_name = 'brand') THEN
      IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE schemaname = 'public' 
        AND tablename = 'service_rules' 
        AND indexname = 'idx_service_rules_brand'
      ) THEN
        CREATE INDEX idx_service_rules_brand ON public.service_rules(brand);
      END IF;
    END IF;
  END IF;
END $$;
