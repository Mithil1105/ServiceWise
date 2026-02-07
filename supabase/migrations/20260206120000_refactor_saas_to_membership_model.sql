-- Refactor SaaS to ScoreWise-style membership model.
-- Idempotent; safe to run. Keeps organization_id, organization_members, user_roles (names unchanged).
-- Removes: platform_admins, plans, subscriptions, trials, entitlements, can_write, org_code (numeric).
-- Master admin = user_roles.role='admin' AND organization_id IS NULL.

-- =============================================================================
-- 1) Migrate platform_admins to user_roles (master admin = role 'admin', org NULL)
-- =============================================================================
-- Allow organization_id NULL in user_roles for platform-level admin row
ALTER TABLE public.user_roles
  ALTER COLUMN organization_id DROP NOT NULL;

-- Copy active platform admins into user_roles as master admin (only if not already present)
INSERT INTO public.user_roles (user_id, organization_id, role, created_at)
SELECT pa.user_id, NULL, 'admin', now()
FROM public.platform_admins pa
WHERE pa.is_active = true
  AND NOT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = pa.user_id AND ur.organization_id IS NULL AND ur.role = 'admin'
  )
ON CONFLICT (user_id, organization_id) DO NOTHING;

-- (ON CONFLICT: unique is (user_id, organization_id); NULL = NULL in unique, so one row per user with org NULL)

-- =============================================================================
-- 2) Data migration: ensure every user with profile.organization_id has active membership
-- =============================================================================
INSERT INTO public.organization_members (organization_id, user_id, role, status, created_at)
SELECT p.organization_id, p.id, COALESCE(
  (SELECT ur.role FROM public.user_roles ur WHERE ur.user_id = p.id AND ur.organization_id = p.organization_id LIMIT 1),
  'supervisor'
), 'active', now()
FROM public.profiles p
WHERE p.organization_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.user_id = p.id AND om.organization_id = p.organization_id
  )
ON CONFLICT (organization_id, user_id) DO UPDATE SET status = 'active';

-- =============================================================================
-- 3) Drop old triggers and functions (order matters for dependencies)
-- =============================================================================
DROP TRIGGER IF EXISTS profiles_block_org_id_change_trigger ON public.profiles;
DROP FUNCTION IF EXISTS public.profiles_block_org_id_change() CASCADE;

DROP TRIGGER IF EXISTS cars_check_vehicle_limit ON public.cars;
DROP FUNCTION IF EXISTS public.check_vehicle_limit() CASCADE;

DROP FUNCTION IF EXISTS public.get_org_entitlements(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.get_org_entitlements_internal(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.is_platform_admin() CASCADE;

-- =============================================================================
-- 4) Drop old SaaS tables
-- =============================================================================
DROP TABLE IF EXISTS public.platform_admins CASCADE;
DROP TABLE IF EXISTS public.org_plan_overrides CASCADE;
DROP TABLE IF EXISTS public.org_subscriptions CASCADE;
DROP TABLE IF EXISTS public.plans CASCADE;
DROP TABLE IF EXISTS public.platform_announcements CASCADE;
DROP TABLE IF EXISTS public.platform_audit_log CASCADE;
DROP TABLE IF EXISTS public.onboarding_requests CASCADE;

-- Remove numeric org_code from organizations (keep join_code only)
ALTER TABLE public.organizations DROP COLUMN IF EXISTS org_code CASCADE;
ALTER TABLE public.organizations DROP CONSTRAINT IF EXISTS organizations_org_code_format;
-- Drop default if it referenced generate_org_code for org_code (no-op if already dropped)
-- Keep organizations.plan as optional label if it exists (spec: "Prefer KEEP as a simple label")

-- =============================================================================
-- 5) New helper functions (membership-based)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.is_master_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin' AND organization_id IS NULL
  );
$$;

CREATE OR REPLACE FUNCTION public.is_active_member(p_org_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_id = p_org_id AND user_id = auth.uid() AND status = 'active'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_org_admin_member(p_org_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_id = p_org_id AND user_id = auth.uid() AND status = 'active'
      AND role IN ('admin', 'manager')
  );
$$;

-- get_my_org_id: keep for convenience (returns profile's active org; may be null)
CREATE OR REPLACE FUNCTION public.get_my_org_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT organization_id FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$$;

-- is_org_admin: now based on organization_members for current org
CREATE OR REPLACE FUNCTION public.is_org_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_org_admin_member(public.get_my_org_id());
$$;

-- =============================================================================
-- 6) Update organization_members_on_approve: set profile.organization_id; keep user_roles sync for compatibility
-- =============================================================================
CREATE OR REPLACE FUNCTION public.organization_members_on_approve()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'active' AND (OLD.status IS NULL OR OLD.status != 'active') THEN
    PERFORM set_config('app.approving_member', 'true', true);
    UPDATE public.profiles
    SET organization_id = NEW.organization_id, updated_at = now()
    WHERE id = NEW.user_id AND organization_id IS NULL;
    INSERT INTO public.user_roles (user_id, organization_id, role, created_at)
    VALUES (NEW.user_id, NEW.organization_id, NEW.role, now())
    ON CONFLICT (user_id, organization_id) DO UPDATE SET role = NEW.role;
  END IF;
  IF NEW.status = 'blocked' AND OLD.status = 'active' THEN
    UPDATE public.profiles
    SET organization_id = (
      SELECT om.organization_id FROM public.organization_members om
      WHERE om.user_id = NEW.user_id AND om.status = 'active' AND om.organization_id != NEW.organization_id
      LIMIT 1
    ), updated_at = now()
    WHERE id = NEW.user_id AND organization_id = NEW.organization_id;
  END IF;
  RETURN NEW;
END;
$$;

-- =============================================================================
-- 7) Drop ALL existing RLS policies on affected tables, then recreate
-- =============================================================================
DO $$
DECLARE
  t TEXT;
  r RECORD;
  tables TEXT[] := ARRAY[
    'organizations', 'profiles', 'user_roles', 'organization_members',
    'cars', 'drivers', 'customers', 'bookings', 'booking_vehicles', 'booking_requested_vehicles',
    'booking_audit_log', 'bills', 'company_bills', 'transfers', 'bank_accounts',
    'service_rules', 'car_service_rules', 'service_records', 'odometer_entries',
    'incidents', 'downtime_logs', 'system_config', 'car_documents', 'car_notes',
    'car_assignments', 'supervisor_activity_log', 'user_snoozes', 'tentative_holds',
    'organization_settings', 'org_user_audit_log'
  ];
BEGIN
  FOREACH t IN ARRAY tables
  LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = t) THEN
      FOR r IN (SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = t)
      LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, t);
      END LOOP;
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    END IF;
  END LOOP;
END $$;

-- =============================================================================
-- 9) organizations: SELECT if active member or master admin; INSERT/UPDATE/DELETE master admin only
-- =============================================================================
CREATE POLICY "org_select_member_or_master"
  ON public.organizations FOR SELECT TO authenticated
  USING (
    public.is_master_admin()
    OR public.is_active_member(id)
  );

CREATE POLICY "org_insert_master"
  ON public.organizations FOR INSERT TO authenticated
  WITH CHECK (public.is_master_admin());

CREATE POLICY "org_update_master"
  ON public.organizations FOR UPDATE TO authenticated
  USING (public.is_master_admin())
  WITH CHECK (public.is_master_admin());

CREATE POLICY "org_delete_master"
  ON public.organizations FOR DELETE TO authenticated
  USING (public.is_master_admin());

-- =============================================================================
-- 10) profiles: select own, select same-org (via membership), insert own, update own
-- =============================================================================
CREATE POLICY "profile_select_own"
  ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid());

CREATE POLICY "profile_select_org_members"
  ON public.profiles FOR SELECT TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

CREATE POLICY "profile_insert_own"
  ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());

CREATE POLICY "profile_update_own"
  ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (
    id = auth.uid()
    AND (
      public.is_master_admin()
      OR (organization_id IS NULL)
      OR public.is_active_member(organization_id)
    )
  );

-- =============================================================================
-- 11) user_roles: select own org rows or master admin; insert/update/delete org admin or master
-- =============================================================================
CREATE POLICY "user_roles_select"
  ON public.user_roles FOR SELECT TO authenticated
  USING (
    public.is_master_admin()
    OR organization_id = public.get_my_org_id()
    OR (organization_id IS NULL AND user_id = auth.uid())
  );

CREATE POLICY "user_roles_insert"
  ON public.user_roles FOR INSERT TO authenticated
  WITH CHECK (
    public.is_master_admin()
    OR (public.is_org_admin_member(organization_id) AND organization_id IS NOT NULL)
  );

CREATE POLICY "user_roles_update"
  ON public.user_roles FOR UPDATE TO authenticated
  USING (
    public.is_master_admin()
    OR (organization_id IS NOT NULL AND public.is_org_admin_member(organization_id))
  )
  WITH CHECK (true);

CREATE POLICY "user_roles_delete"
  ON public.user_roles FOR DELETE TO authenticated
  USING (
    public.is_master_admin()
    OR (organization_id IS NOT NULL AND public.is_org_admin_member(organization_id))
  );

-- =============================================================================
-- 12) organization_members: select own; org admin select org; insert pending (own); update org admin; delete org admin
-- =============================================================================
CREATE POLICY "organization_members_select_own"
  ON public.organization_members FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "organization_members_select_org_admin"
  ON public.organization_members FOR SELECT TO authenticated
  USING (
    public.is_master_admin()
    OR public.is_org_admin_member(organization_id)
  );

CREATE POLICY "organization_members_insert_pending"
  ON public.organization_members FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND status = 'pending');

CREATE POLICY "organization_members_update_org_admin"
  ON public.organization_members FOR UPDATE TO authenticated
  USING (
    public.is_master_admin()
    OR public.is_org_admin_member(organization_id)
  )
  WITH CHECK (true);

CREATE POLICY "organization_members_delete_org_admin"
  ON public.organization_members FOR DELETE TO authenticated
  USING (
    public.is_master_admin()
    OR public.is_org_admin_member(organization_id)
  );

-- =============================================================================
-- 13) Tenant business tables: access by active membership only (no can_write)
-- =============================================================================
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
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = t)
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = t AND column_name = 'organization_id')
    THEN
      EXECUTE format(
        'CREATE POLICY "tenant_select" ON public.%I FOR SELECT TO authenticated USING (public.is_master_admin() OR public.is_active_member(organization_id))',
        t
      );
      EXECUTE format(
        'CREATE POLICY "tenant_insert" ON public.%I FOR INSERT TO authenticated WITH CHECK (public.is_master_admin() OR (organization_id IS NOT NULL AND public.is_active_member(organization_id)))',
        t
      );
      EXECUTE format(
        'CREATE POLICY "tenant_update" ON public.%I FOR UPDATE TO authenticated USING (public.is_master_admin() OR public.is_active_member(organization_id)) WITH CHECK (public.is_master_admin() OR public.is_active_member(organization_id))',
        t
      );
      EXECUTE format(
        'CREATE POLICY "tenant_delete" ON public.%I FOR DELETE TO authenticated USING (public.is_master_admin() OR public.is_active_member(organization_id))',
        t
      );
    END IF;
  END LOOP;
END $$;

-- =============================================================================
-- 14) organization_settings: keep table; RLS by active membership
-- =============================================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'organization_settings') THEN
    CREATE POLICY "org_settings_select"
      ON public.organization_settings FOR SELECT TO authenticated
      USING (public.is_master_admin() OR public.is_active_member(organization_id));
    CREATE POLICY "org_settings_insert"
      ON public.organization_settings FOR INSERT TO authenticated
      WITH CHECK (public.is_master_admin() OR public.is_org_admin_member(organization_id));
    CREATE POLICY "org_settings_update"
      ON public.organization_settings FOR UPDATE TO authenticated
      USING (public.is_master_admin() OR public.is_org_admin_member(organization_id))
      WITH CHECK (true);
    CREATE POLICY "org_settings_delete"
      ON public.organization_settings FOR DELETE TO authenticated
      USING (public.is_master_admin());
  END IF;
END $$;

-- =============================================================================
-- 15) org_user_audit_log: org members select; org admin insert; master select all
-- =============================================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'org_user_audit_log') THEN
    CREATE POLICY "org_user_audit_select"
      ON public.org_user_audit_log FOR SELECT TO authenticated
      USING (public.is_master_admin() OR public.is_active_member(organization_id));
    CREATE POLICY "org_user_audit_insert"
      ON public.org_user_audit_log FOR INSERT TO authenticated
      WITH CHECK (public.is_master_admin() OR public.is_org_admin_member(organization_id));
  END IF;
END $$;
