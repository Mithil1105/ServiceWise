-- Organization branding: logo, company name, terms & conditions, bill number prefix.

-- 1) Organizations: add logo_url and company_name
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'organizations' AND column_name = 'logo_url'
  ) THEN
    ALTER TABLE public.organizations ADD COLUMN logo_url TEXT NULL;
    COMMENT ON COLUMN public.organizations.logo_url IS 'Public URL of org logo (e.g. from organization-logos bucket)';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'organizations' AND column_name = 'company_name'
  ) THEN
    ALTER TABLE public.organizations ADD COLUMN company_name TEXT NULL;
    COMMENT ON COLUMN public.organizations.company_name IS 'Legal company name for bills, invoices, and footers';
  END IF;
END $$;

-- 2) Organization_settings: add terms_and_conditions and bill_number_prefix
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'organization_settings' AND column_name = 'terms_and_conditions'
  ) THEN
    ALTER TABLE public.organization_settings ADD COLUMN terms_and_conditions TEXT NULL;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'organization_settings' AND column_name = 'bill_number_prefix'
  ) THEN
    ALTER TABLE public.organization_settings ADD COLUMN bill_number_prefix VARCHAR(20) NOT NULL DEFAULT 'PT';
    COMMENT ON COLUMN public.organization_settings.bill_number_prefix IS 'Prefix for bill numbers (e.g. PT -> PT-BILL-2025-000001)';
  END IF;
END $$;

-- 3) Storage bucket for organization logos (public so logo_url works in img src)
INSERT INTO storage.buckets (id, name, public)
VALUES ('organization-logos', 'organization-logos', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 4) Storage policies: user can upload/update/delete only in their org folder (path: org_id/filename)
DO $$
BEGIN
  DROP POLICY IF EXISTS "Org logos: authenticated read" ON storage.objects;
  DROP POLICY IF EXISTS "Org logos: admin manager upload" ON storage.objects;
  DROP POLICY IF EXISTS "Org logos: admin manager update" ON storage.objects;
  DROP POLICY IF EXISTS "Org logos: admin manager delete" ON storage.objects;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

CREATE POLICY "Org logos: authenticated read"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'organization-logos');

CREATE POLICY "Org logos: admin manager upload"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'organization-logos'
    AND EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.user_id = auth.uid()
        AND om.organization_id::text = (storage.foldername(name))[1]
        AND om.status = 'active'
        AND om.role IN ('admin', 'manager')
    )
  );

CREATE POLICY "Org logos: admin manager update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'organization-logos'
    AND EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.user_id = auth.uid()
        AND om.organization_id::text = (storage.foldername(name))[1]
        AND om.status = 'active'
        AND om.role IN ('admin', 'manager')
    )
  );

CREATE POLICY "Org logos: admin manager delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'organization-logos'
    AND EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.user_id = auth.uid()
        AND om.organization_id::text = (storage.foldername(name))[1]
        AND om.status = 'active'
        AND om.role IN ('admin', 'manager')
    )
  );
