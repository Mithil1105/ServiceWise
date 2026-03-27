-- Add OCR plan tier to organization settings.
-- Tiers:
--   basic = no OCR
--   plus  = limited OCR
--   pro   = full OCR
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'organization_settings'
      AND column_name = 'ocr_tier'
  ) THEN
    ALTER TABLE public.organization_settings
      ADD COLUMN ocr_tier TEXT NOT NULL DEFAULT 'basic'
      CHECK (ocr_tier IN ('basic', 'plus', 'pro'));

    COMMENT ON COLUMN public.organization_settings.ocr_tier IS
      'OCR capability tier per organization: basic (no OCR), plus (limited OCR), pro (full OCR).';
  END IF;
END $$;
