-- Add organization_id to service_bill_files for multi-tenant isolation.
-- This table was missing organization_id; RLS was using role-based policies that don't scope by org.

-- 1) Add organization_id column (nullable first for backfill)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'service_bill_files' AND column_name = 'organization_id'
  ) THEN
    ALTER TABLE public.service_bill_files
      ADD COLUMN organization_id UUID NULL REFERENCES public.organizations(id) ON DELETE CASCADE;
    COMMENT ON COLUMN public.service_bill_files.organization_id IS 'Tenant: organization that owns this file (via service_record)';
  END IF;
END $$;

-- 2) Backfill from service_records
UPDATE public.service_bill_files sbf
SET organization_id = sr.organization_id
FROM public.service_records sr
WHERE sbf.service_record_id = sr.id
  AND sbf.organization_id IS NULL;

-- 2b) Delete orphaned rows (service_record no longer exists) - cannot backfill
DELETE FROM public.service_bill_files
WHERE organization_id IS NULL;

-- 3) Set NOT NULL and add index
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'service_bill_files' AND column_name = 'organization_id') THEN
    ALTER TABLE public.service_bill_files ALTER COLUMN organization_id SET NOT NULL;
    CREATE INDEX IF NOT EXISTS idx_service_bill_files_organization_id ON public.service_bill_files(organization_id);
  END IF;
END $$;

-- 4) Trigger: auto-set organization_id on INSERT from service_record
CREATE OR REPLACE FUNCTION public.service_bill_files_set_organization_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_org_id UUID;
BEGIN
  IF NEW.organization_id IS NULL AND NEW.service_record_id IS NOT NULL THEN
    SELECT organization_id INTO v_org_id
    FROM public.service_records
    WHERE id = NEW.service_record_id;
    IF v_org_id IS NOT NULL THEN
      NEW.organization_id := v_org_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_service_bill_files_set_organization_id ON public.service_bill_files;
CREATE TRIGGER trg_service_bill_files_set_organization_id
  BEFORE INSERT ON public.service_bill_files
  FOR EACH ROW
  EXECUTE FUNCTION public.service_bill_files_set_organization_id();

-- 5) Drop old RLS policies (role-based, not org-scoped)
DROP POLICY IF EXISTS "Authenticated users can view service bill files" ON public.service_bill_files;
DROP POLICY IF EXISTS "Admin and Manager can insert service bill files" ON public.service_bill_files;
DROP POLICY IF EXISTS "Admin and Manager can delete service bill files" ON public.service_bill_files;

-- 6) Create tenant-scoped RLS policies
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'service_bill_files')
     AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'service_bill_files' AND column_name = 'organization_id')
  THEN
    CREATE POLICY "tenant_select" ON public.service_bill_files FOR SELECT TO authenticated
      USING (public.is_master_admin() OR public.is_active_member(organization_id));
    CREATE POLICY "tenant_insert" ON public.service_bill_files FOR INSERT TO authenticated
      WITH CHECK (public.is_master_admin() OR (organization_id IS NOT NULL AND public.is_active_member(organization_id)));
    CREATE POLICY "tenant_update" ON public.service_bill_files FOR UPDATE TO authenticated
      USING (public.is_master_admin() OR public.is_active_member(organization_id))
      WITH CHECK (public.is_master_admin() OR public.is_active_member(organization_id));
    CREATE POLICY "tenant_delete" ON public.service_bill_files FOR DELETE TO authenticated
      USING (public.is_master_admin() OR public.is_active_member(organization_id));
  END IF;
END $$;
