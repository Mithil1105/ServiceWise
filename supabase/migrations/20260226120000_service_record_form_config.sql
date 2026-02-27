-- Per-org form config for Add Service Record form.
-- Custom field values: service_records.custom_attributes.

-- 1) organization_settings: add service_record_form_config
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'organization_settings' AND column_name = 'service_record_form_config'
  ) THEN
    ALTER TABLE public.organization_settings ADD COLUMN service_record_form_config JSONB NULL;
    COMMENT ON COLUMN public.organization_settings.service_record_form_config IS 'Config for Add Service Record form: fieldOverrides, warrantySection, billsSection, customFields';
  END IF;
END $$;

-- 2) service_records: add custom_attributes for org-defined custom field values
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'service_records' AND column_name = 'custom_attributes'
  ) THEN
    ALTER TABLE public.service_records ADD COLUMN custom_attributes JSONB NULL;
    COMMENT ON COLUMN public.service_records.custom_attributes IS 'Org-defined custom field values (from service_record_form_config.customFields)';
  END IF;
END $$;
