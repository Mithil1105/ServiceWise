-- Per-org form config for Drivers (Add/Edit Driver) and Bookings (New Booking).
-- Custom field values: drivers.custom_attributes, bookings.custom_attributes.

-- 1) organization_settings: add drivers_form_config and booking_form_config
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'organization_settings' AND column_name = 'drivers_form_config'
  ) THEN
    ALTER TABLE public.organization_settings ADD COLUMN drivers_form_config JSONB NULL;
    COMMENT ON COLUMN public.organization_settings.drivers_form_config IS 'Config for Add/Edit Driver form: fieldOverrides, customFields';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'organization_settings' AND column_name = 'booking_form_config'
  ) THEN
    ALTER TABLE public.organization_settings ADD COLUMN booking_form_config JSONB NULL;
    COMMENT ON COLUMN public.organization_settings.booking_form_config IS 'Config for New Booking form: fieldOverrides, customFields';
  END IF;
END $$;

-- 2) drivers: add custom_attributes for org-defined custom field values
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'drivers' AND column_name = 'custom_attributes'
  ) THEN
    ALTER TABLE public.drivers ADD COLUMN custom_attributes JSONB NULL;
    COMMENT ON COLUMN public.drivers.custom_attributes IS 'Org-defined custom field values (from drivers_form_config.customFields)';
  END IF;
END $$;

-- 3) bookings: add custom_attributes for org-defined custom field values
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'bookings' AND column_name = 'custom_attributes'
  ) THEN
    ALTER TABLE public.bookings ADD COLUMN custom_attributes JSONB NULL;
    COMMENT ON COLUMN public.bookings.custom_attributes IS 'Org-defined custom field values (from booking_form_config.customFields)';
  END IF;
END $$;
