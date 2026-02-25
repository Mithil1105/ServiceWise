-- Billing layout config and per-bill custom attributes.
-- 1) organization_settings.billing_layout_config (JSONB)
-- 2) bills.custom_attributes (JSONB) for per-bill custom field values
-- 3) company_bills.custom_attributes (JSONB) for per-bill custom field values on company bills

-- 1) Add billing_layout_config to organization_settings
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'organization_settings' AND column_name = 'billing_layout_config'
  ) THEN
    ALTER TABLE public.organization_settings ADD COLUMN billing_layout_config JSONB NULL;
    COMMENT ON COLUMN public.organization_settings.billing_layout_config IS 'Bill layout: show/hide sections, labels, custom blocks (position, type, org vs per-bill). use_same_layout_for_company_bills applies one config to both.';
  END IF;
END $$;

-- 2) Add custom_attributes to bills
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'bills' AND column_name = 'custom_attributes'
  ) THEN
    ALTER TABLE public.bills ADD COLUMN custom_attributes JSONB NULL DEFAULT '{}'::jsonb;
    COMMENT ON COLUMN public.bills.custom_attributes IS 'Per-bill custom field values (key -> value) for billing layout custom blocks with valueSource per_bill.';
  END IF;
END $$;

-- 3) Add custom_attributes to company_bills
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'company_bills' AND column_name = 'custom_attributes'
  ) THEN
    ALTER TABLE public.company_bills ADD COLUMN custom_attributes JSONB NULL DEFAULT '{}'::jsonb;
    COMMENT ON COLUMN public.company_bills.custom_attributes IS 'Per-bill custom field values for company bills (same keys as customer bill when using same layout).';
  END IF;
END $$;
