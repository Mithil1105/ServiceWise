-- Per-org configuration for Log Fuel form (Fuel.tsx).
-- Stored in organization_settings.fuel_entry_form_config.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'organization_settings'
      AND column_name = 'fuel_entry_form_config'
  ) THEN
    ALTER TABLE public.organization_settings
      ADD COLUMN fuel_entry_form_config JSONB NULL;
    COMMENT ON COLUMN public.organization_settings.fuel_entry_form_config
      IS 'Config for Fuel entry form: field overrides (labels/required/hidden).';
  END IF;
END $$;

