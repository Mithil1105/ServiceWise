-- Per-org configuration for Fleet → New car form: field overrides, custom fields, document types.
-- Custom field values are stored on cars.custom_attributes (JSONB).

-- 1) organization_settings: add fleet_new_car_form_config (JSONB)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'organization_settings' AND column_name = 'fleet_new_car_form_config'
  ) THEN
    ALTER TABLE public.organization_settings ADD COLUMN fleet_new_car_form_config JSONB NULL;
    COMMENT ON COLUMN public.organization_settings.fleet_new_car_form_config IS 'Config for Add Vehicle form: fieldOverrides, customFields, documentTypes';
  END IF;
END $$;

-- 2) cars: add custom_attributes for org-defined custom field values
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'cars' AND column_name = 'custom_attributes'
  ) THEN
    ALTER TABLE public.cars ADD COLUMN custom_attributes JSONB NULL;
    COMMENT ON COLUMN public.cars.custom_attributes IS 'Org-defined custom field values (key-value from fleet_new_car_form_config.customFields)';
  END IF;
END $$;
