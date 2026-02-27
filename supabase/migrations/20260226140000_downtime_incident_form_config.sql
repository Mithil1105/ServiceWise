-- Per-org form config for Add Downtime and Log Incident forms.
-- Custom field values: downtime_logs.custom_attributes, incidents.custom_attributes.

-- 1) organization_settings: add downtime_form_config and incident_form_config
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'organization_settings' AND column_name = 'downtime_form_config'
  ) THEN
    ALTER TABLE public.organization_settings ADD COLUMN downtime_form_config JSONB NULL;
    COMMENT ON COLUMN public.organization_settings.downtime_form_config IS 'Config for Add Downtime form: fieldOverrides, customFields';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'organization_settings' AND column_name = 'incident_form_config'
  ) THEN
    ALTER TABLE public.organization_settings ADD COLUMN incident_form_config JSONB NULL;
    COMMENT ON COLUMN public.organization_settings.incident_form_config IS 'Config for Log Incident form: fieldOverrides, customFields';
  END IF;
END $$;

-- 2) downtime_logs: add custom_attributes
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'downtime_logs' AND column_name = 'custom_attributes'
  ) THEN
    ALTER TABLE public.downtime_logs ADD COLUMN custom_attributes JSONB NULL;
    COMMENT ON COLUMN public.downtime_logs.custom_attributes IS 'Org-defined custom field values (from downtime_form_config.customFields)';
  END IF;
END $$;

-- 3) incidents: add custom_attributes
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'incidents' AND column_name = 'custom_attributes'
  ) THEN
    ALTER TABLE public.incidents ADD COLUMN custom_attributes JSONB NULL;
    COMMENT ON COLUMN public.incidents.custom_attributes IS 'Org-defined custom field values (from incident_form_config.customFields)';
  END IF;
END $$;
