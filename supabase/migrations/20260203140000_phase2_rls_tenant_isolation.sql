-- Phase 2: RLS tenant isolation – authenticated users see only their organization's data.
-- No Master Admin cross-org; one org per user. Replaces previous role-based policies with tenant-scoped ones.

-- A1) Ensure helper functions exist
-- get_my_org_id() – already created in Phase 1; ensure it exists and is correct
CREATE OR REPLACE FUNCTION public.get_my_org_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT organization_id FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$$;

-- is_org_admin() – true if current user has admin or manager role in their org
CREATE OR REPLACE FUNCTION public.is_org_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.organization_id = public.get_my_org_id()
      AND ur.role IN ('admin', 'manager')
  );
$$;

-- A2) Drop all existing policies on org-scoped tables (so we can replace with tenant policies)
-- Then enable RLS and create tenant policies. Use DO blocks and skip missing tables.

DO $$
DECLARE
  t TEXT;
  r RECORD;
  tables TEXT[] := ARRAY[
    'organizations', 'profiles', 'user_roles',
    'cars', 'drivers', 'customers', 'bookings', 'booking_vehicles', 'booking_requested_vehicles',
    'booking_audit_log', 'bills', 'company_bills', 'transfers', 'bank_accounts',
    'service_rules', 'car_service_rules', 'service_records', 'odometer_entries',
    'incidents', 'downtime_logs', 'system_config', 'car_documents', 'car_notes',
    'car_assignments', 'supervisor_activity_log', 'user_snoozes', 'tentative_holds'
  ];
BEGIN
  FOREACH t IN ARRAY tables
  LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = t) THEN
      -- Drop every existing policy on this table
      FOR r IN (SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = t)
      LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, t);
      END LOOP;
      -- Ensure RLS is enabled
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    END IF;
  END LOOP;
END $$;

-- B1) organizations – users can only SELECT their own org row (no insert/update/delete from client)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'organizations') THEN
    CREATE POLICY "org_select_own"
      ON public.organizations FOR SELECT TO authenticated
      USING (id = public.get_my_org_id());
  END IF;
END $$;

-- B2) profiles – user can read own; org members can read org profiles; user can update own only
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'profiles') THEN
    CREATE POLICY "profile_select_own"
      ON public.profiles FOR SELECT TO authenticated
      USING (id = auth.uid());
    CREATE POLICY "profile_select_org"
      ON public.profiles FOR SELECT TO authenticated
      USING (organization_id = public.get_my_org_id());
    CREATE POLICY "profile_update_own"
      ON public.profiles FOR UPDATE TO authenticated
      USING (id = auth.uid())
      WITH CHECK (id = auth.uid());
    -- Allow insert only for own profile (id = auth.uid()) so handle_new_user / signup can create profile when session is new user.
    CREATE POLICY "profile_insert_own"
      ON public.profiles FOR INSERT TO authenticated
      WITH CHECK (id = auth.uid());
  END IF;
END $$;

-- B3) user_roles – SELECT within org; INSERT/UPDATE/DELETE only if is_org_admin()
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_roles') THEN
    CREATE POLICY "tenant_select"
      ON public.user_roles FOR SELECT TO authenticated
      USING (organization_id = public.get_my_org_id());
    CREATE POLICY "tenant_insert_admin"
      ON public.user_roles FOR INSERT TO authenticated
      WITH CHECK (public.is_org_admin() AND organization_id = public.get_my_org_id());
    CREATE POLICY "tenant_update_admin"
      ON public.user_roles FOR UPDATE TO authenticated
      USING (public.is_org_admin() AND organization_id = public.get_my_org_id())
      WITH CHECK (public.is_org_admin() AND organization_id = public.get_my_org_id());
    CREATE POLICY "tenant_delete_admin"
      ON public.user_roles FOR DELETE TO authenticated
      USING (public.is_org_admin() AND organization_id = public.get_my_org_id());
  END IF;
END $$;

-- A3) Standard tenant policies for all other org-scoped tables (4 policies each)
DO $$
DECLARE
  t TEXT;
  tables TEXT[] := ARRAY[
    'cars', 'drivers', 'customers', 'bookings', 'booking_vehicles', 'booking_requested_vehicles',
    'booking_audit_log', 'bills', 'company_bills', 'transfers', 'bank_accounts',
    'service_rules', 'car_service_rules', 'service_records', 'odometer_entries',
    'incidents', 'downtime_logs', 'system_config', 'car_documents', 'car_notes',
    'car_assignments', 'supervisor_activity_log', 'user_snoozes', 'tentative_holds'
  ];
BEGIN
  FOREACH t IN ARRAY tables
  LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = t) THEN
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = t AND column_name = 'organization_id') THEN
        EXECUTE format(
          'CREATE POLICY "tenant_select" ON public.%I FOR SELECT TO authenticated USING (organization_id = public.get_my_org_id())',
          t
        );
        EXECUTE format(
          'CREATE POLICY "tenant_insert" ON public.%I FOR INSERT TO authenticated WITH CHECK (organization_id = public.get_my_org_id())',
          t
        );
        EXECUTE format(
          'CREATE POLICY "tenant_update" ON public.%I FOR UPDATE TO authenticated USING (organization_id = public.get_my_org_id()) WITH CHECK (organization_id = public.get_my_org_id())',
          t
        );
        EXECUTE format(
          'CREATE POLICY "tenant_delete" ON public.%I FOR DELETE TO authenticated USING (organization_id = public.get_my_org_id())',
          t
        );
      END IF;
    END IF;
  END LOOP;
END $$;
