-- Fuel bill upload support:
-- - Creates `public.fuel_entry_bills` linked to `public.fuel_entries`
-- - Adds tenant-scoped RLS policies
-- - Allows INSERT for fuel_filler + admin/manager/supervisor
-- - Restricts UPDATE/DELETE to admin/manager (master admin always allowed)

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'fuel_entry_bills'
  ) THEN
    CREATE TABLE public.fuel_entry_bills (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
      fuel_entry_id UUID NOT NULL REFERENCES public.fuel_entries(id) ON DELETE CASCADE,

      -- R2 object key (full key including prefix), e.g. `fuel-bills/<fuelEntryId>/<...>`
      file_path TEXT NOT NULL,
      file_name TEXT NOT NULL,
      file_size INTEGER NOT NULL,
      file_type TEXT NOT NULL,

      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE INDEX IF NOT EXISTS idx_fuel_entry_bills_org ON public.fuel_entry_bills(organization_id);
    CREATE INDEX IF NOT EXISTS idx_fuel_entry_bills_entry_id ON public.fuel_entry_bills(fuel_entry_id);
  END IF;
END $$;

ALTER TABLE public.fuel_entry_bills ENABLE ROW LEVEL SECURITY;

-- Keep `organization_id` consistent with the referenced fuel entry.
CREATE OR REPLACE FUNCTION public.fuel_entry_bills_set_organization_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_org_id UUID;
BEGIN
  SELECT fe.organization_id
    INTO v_org_id
    FROM public.fuel_entries fe
   WHERE fe.id = NEW.fuel_entry_id
   LIMIT 1;

  IF v_org_id IS NOT NULL THEN
    NEW.organization_id := v_org_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_fuel_entry_bills_set_org ON public.fuel_entry_bills;
CREATE TRIGGER trg_fuel_entry_bills_set_org
  BEFORE INSERT ON public.fuel_entry_bills
  FOR EACH ROW
  EXECUTE FUNCTION public.fuel_entry_bills_set_organization_id();

-- Drop existing RLS policies on this table (idempotent re-run safety)
DO $$
DECLARE
  p RECORD;
BEGIN
  FOR p IN (
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'fuel_entry_bills'
  ) LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.fuel_entry_bills', p.policyname);
  END LOOP;
END $$;

-- SELECT: tenant members can read; master admin can read all.
CREATE POLICY "fuel_entry_bills_select_member_or_master"
  ON public.fuel_entry_bills FOR SELECT TO authenticated
  USING (
    public.is_master_admin()
    OR public.is_active_member(organization_id)
  );

-- INSERT: fuel_filler + admin/manager/supervisor can add bills within their org.
CREATE POLICY "fuel_entry_bills_insert_fuel_roles"
  ON public.fuel_entry_bills FOR INSERT TO authenticated
  WITH CHECK (
    public.is_master_admin()
    OR (
      organization_id = public.get_my_org_id()
      AND EXISTS (
        SELECT 1
        FROM public.organization_members om
        WHERE om.organization_id = organization_id
          AND om.user_id = auth.uid()
          AND om.status = 'active'
          AND om.role IN ('admin', 'manager', 'supervisor', 'fuel_filler')
      )
    )
  );

-- UPDATE: admin/manager only (master admin always allowed)
CREATE POLICY "fuel_entry_bills_update_admin_manager"
  ON public.fuel_entry_bills FOR UPDATE TO authenticated
  USING (
    public.is_master_admin()
    OR EXISTS (
      SELECT 1
      FROM public.organization_members om
      WHERE om.organization_id = organization_id
        AND om.user_id = auth.uid()
        AND om.status = 'active'
        AND om.role IN ('admin', 'manager')
    )
  )
  WITH CHECK (
    public.is_master_admin()
    OR EXISTS (
      SELECT 1
      FROM public.organization_members om
      WHERE om.organization_id = organization_id
        AND om.user_id = auth.uid()
        AND om.status = 'active'
        AND om.role IN ('admin', 'manager')
    )
  );

-- DELETE: admin/manager only (master admin always allowed)
CREATE POLICY "fuel_entry_bills_delete_admin_manager"
  ON public.fuel_entry_bills FOR DELETE TO authenticated
  USING (
    public.is_master_admin()
    OR EXISTS (
      SELECT 1
      FROM public.organization_members om
      WHERE om.organization_id = organization_id
        AND om.user_id = auth.uid()
        AND om.status = 'active'
        AND om.role IN ('admin', 'manager')
    )
  );

