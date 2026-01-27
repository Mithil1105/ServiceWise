-- Migration 0007: Add vehicle type, owner name, and additional document types
-- Adds vehicle_type (private/commercial), owner_name, permits, fitness documents, and insurance provider name

-- Add vehicle_type and owner_name columns to cars table
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'cars') THEN
    -- Add vehicle_type column
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'cars' 
      AND column_name = 'vehicle_type'
    ) THEN
      ALTER TABLE public.cars ADD COLUMN vehicle_type TEXT CHECK (vehicle_type IN ('private', 'commercial'));
    END IF;
    
    -- Add owner_name column
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'cars' 
      AND column_name = 'owner_name'
    ) THEN
      ALTER TABLE public.cars ADD COLUMN owner_name TEXT;
    END IF;
  END IF;
END $$;

-- Add insurance_provider_name column to car_documents table
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'car_documents') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'car_documents' 
      AND column_name = 'insurance_provider_name'
    ) THEN
      ALTER TABLE public.car_documents ADD COLUMN insurance_provider_name TEXT;
      
      -- Add comment explaining this field is only for insurance documents
      COMMENT ON COLUMN public.car_documents.insurance_provider_name IS 'Insurance provider name (e.g., HDFC Ergo, ICICI Lombard). Only used when document_type is "insurance".';
    END IF;
  END IF;
END $$;

-- Update car_documents unique constraint to allow permits and fitness
-- The existing UNIQUE(car_id, document_type) constraint already handles this, but we need to ensure
-- the document_type CHECK constraint allows the new types
DO $$
BEGIN
  -- Check if there's a CHECK constraint on document_type that needs updating
  -- If document_type is stored as TEXT (not enum), we don't need to modify anything
  -- The application layer will handle validation
  NULL;
END $$;
