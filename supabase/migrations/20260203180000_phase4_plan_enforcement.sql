-- Phase 4: Plan enforcement – effective entitlements, limits, suspension, overrides, audit.

-- 1.1 org_plan_overrides
CREATE TABLE IF NOT EXISTS public.org_plan_overrides (
  organization_id UUID PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  override_price_monthly INT NULL,
  override_max_users INT NULL,
  override_max_vehicles INT NULL,
  override_features JSONB NULL,
  override_trial_ends_at TIMESTAMPTZ NULL,
  notes TEXT NULL,
  updated_by UUID NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.org_plan_overrides ENABLE ROW LEVEL SECURITY;

-- Platform admin only; tenant users no access
DROP POLICY IF EXISTS "org_plan_overrides_platform_admin_all" ON public.org_plan_overrides;
CREATE POLICY "org_plan_overrides_platform_admin_all"
  ON public.org_plan_overrides FOR ALL TO authenticated
  USING (public.is_platform_admin())
  WITH CHECK (public.is_platform_admin());

-- 2.1 get_org_entitlements_internal(p_org_id) – computation only (for triggers and service-role)
CREATE OR REPLACE FUNCTION public.get_org_entitlements_internal(p_org_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id UUID := p_org_id;
  v_plan_name TEXT;
  v_effective_price INT;
  v_effective_max_users INT;
  v_effective_max_vehicles INT;
  v_effective_features JSONB;
  v_effective_trial_end TIMESTAMPTZ;
  v_users_count BIGINT;
  v_vehicles_count BIGINT;
  v_trial_expired BOOLEAN;
  v_can_write BOOLEAN;
  v_org_status TEXT;
  v_sub_status TEXT;
  v_overridden BOOLEAN := false;
  v_result JSONB;
BEGIN
  IF v_org_id IS NULL THEN
    RETURN jsonb_build_object(
      'plan', null, 'price', 0, 'max_users', null, 'max_vehicles', null,
      'users_count', 0, 'vehicles_count', 0, 'subscription_status', null,
      'trial_expired', true, 'org_status', null, 'can_write', false, 'overridden', false
    );
  END IF;

  SELECT
    p.name,
    COALESCE(ov.override_price_monthly, p.price_monthly_inr),
    COALESCE(ov.override_max_users, p.max_users),
    COALESCE(ov.override_max_vehicles, p.max_vehicles),
    COALESCE(p.features, '{}'::jsonb) || COALESCE(ov.override_features, '{}'::jsonb),
    COALESCE(ov.override_trial_ends_at, s.trial_ends_at),
    o.status,
    COALESCE(s.status, 'trial')
  INTO
    v_plan_name,
    v_effective_price,
    v_effective_max_users,
    v_effective_max_vehicles,
    v_effective_features,
    v_effective_trial_end,
    v_org_status,
    v_sub_status
  FROM public.organizations o
  LEFT JOIN public.org_subscriptions s ON s.organization_id = o.id
  LEFT JOIN public.plans p ON p.id = s.plan_id
  LEFT JOIN public.org_plan_overrides ov ON ov.organization_id = o.id
  WHERE o.id = v_org_id;

  v_overridden := EXISTS (
    SELECT 1 FROM public.org_plan_overrides ov2
    WHERE ov2.organization_id = v_org_id
      AND (ov2.override_price_monthly IS NOT NULL OR ov2.override_max_users IS NOT NULL
           OR ov2.override_max_vehicles IS NOT NULL OR ov2.override_features IS NOT NULL
           OR ov2.override_trial_ends_at IS NOT NULL)
  );

  SELECT count(*) INTO v_users_count FROM public.profiles WHERE organization_id = v_org_id;
  SELECT count(*) INTO v_vehicles_count FROM public.cars WHERE organization_id = v_org_id;

  v_trial_expired := (v_effective_trial_end IS NOT NULL AND v_effective_trial_end < now());

  v_can_write := (v_org_status IS NULL OR v_org_status != 'suspended')
    AND (v_sub_status IS NULL OR v_sub_status != 'canceled')
    AND NOT v_trial_expired;

  IF public.is_platform_admin() THEN
    v_can_write := true;
  END IF;

  v_result := jsonb_build_object(
    'plan', COALESCE(v_plan_name, '—'),
    'price', COALESCE(v_effective_price, 0),
    'max_users', v_effective_max_users,
    'max_vehicles', v_effective_max_vehicles,
    'users_count', v_users_count,
    'vehicles_count', v_vehicles_count,
    'subscription_status', COALESCE(v_sub_status, 'trial'),
    'trial_expired', v_trial_expired,
    'org_status', COALESCE(v_org_status, 'active'),
    'can_write', v_can_write,
    'overridden', v_overridden
  );
  RETURN v_result;
END;
$$;

-- Wrapper with access check: tenants only own org; platform admin any org
CREATE OR REPLACE FUNCTION public.get_org_entitlements(p_org_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id UUID := p_org_id;
BEGIN
  IF v_org_id IS NULL THEN
    v_org_id := public.get_my_org_id();
  END IF;
  IF v_org_id IS NULL THEN
    RETURN jsonb_build_object(
      'plan', null, 'price', 0, 'max_users', null, 'max_vehicles', null,
      'users_count', 0, 'vehicles_count', 0, 'subscription_status', null,
      'trial_expired', true, 'org_status', null, 'can_write', false, 'overridden', false
    );
  END IF;
  IF v_org_id != public.get_my_org_id() AND NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Access denied to org entitlements';
  END IF;
  RETURN public.get_org_entitlements_internal(v_org_id);
END;
$$;

-- 3.1 Vehicle limit: BEFORE INSERT trigger on cars
CREATE OR REPLACE FUNCTION public.check_vehicle_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ent JSONB;
  v_max INT;
  v_count BIGINT;
BEGIN
  IF public.is_platform_admin() THEN
    RETURN NEW;
  END IF;

  v_ent := public.get_org_entitlements(NEW.organization_id);
  v_max := (v_ent->>'max_vehicles')::INT;
  IF v_max IS NULL THEN
    RETURN NEW;
  END IF;
  v_count := (v_ent->>'vehicles_count')::BIGINT;
  IF v_count >= v_max THEN
    RAISE EXCEPTION 'Vehicle limit reached for your plan';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS cars_check_vehicle_limit ON public.cars;
CREATE TRIGGER cars_check_vehicle_limit
  BEFORE INSERT ON public.cars
  FOR EACH ROW EXECUTE FUNCTION public.check_vehicle_limit();

-- 3.2 Global write lock: add can_write to all write-enabled policies
-- Drop and recreate tenant INSERT/UPDATE/DELETE policies with can_write OR is_platform_admin

DO $$
DECLARE
  t TEXT;
  r RECORD;
  tables TEXT[] := ARRAY[
    'cars', 'drivers', 'customers', 'bookings', 'booking_vehicles', 'booking_requested_vehicles',
    'booking_audit_log', 'bills', 'company_bills', 'transfers', 'bank_accounts',
    'service_rules', 'car_service_rules', 'service_records', 'odometer_entries',
    'incidents', 'downtime_logs', 'system_config', 'car_documents', 'car_notes',
    'car_assignments', 'supervisor_activity_log', 'user_snoozes', 'tentative_holds'
  ];
  can_write_expr TEXT := '(public.get_org_entitlements(public.get_my_org_id())->>''can_write'' = ''true'') OR public.is_platform_admin()';
BEGIN
  FOREACH t IN ARRAY tables
  LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = t) THEN
      FOR r IN (SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = t AND policyname IN ('tenant_insert', 'tenant_update', 'tenant_delete'))
      LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, t);
      END LOOP;
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = t AND column_name = 'organization_id') THEN
        EXECUTE format(
          'CREATE POLICY "tenant_insert" ON public.%I FOR INSERT TO authenticated WITH CHECK (organization_id = public.get_my_org_id() AND (%s))',
          t, can_write_expr
        );
        EXECUTE format(
          'CREATE POLICY "tenant_update" ON public.%I FOR UPDATE TO authenticated USING (organization_id = public.get_my_org_id() AND (%s)) WITH CHECK (organization_id = public.get_my_org_id() AND (%s))',
          t, can_write_expr, can_write_expr
        );
        EXECUTE format(
          'CREATE POLICY "tenant_delete" ON public.%I FOR DELETE TO authenticated USING (organization_id = public.get_my_org_id() AND (%s))',
          t, can_write_expr
        );
      END IF;
    END IF;
  END LOOP;
END $$;

-- user_roles: tenant_insert_admin, tenant_update_admin, tenant_delete_admin
DROP POLICY IF EXISTS "tenant_insert_admin" ON public.user_roles;
DROP POLICY IF EXISTS "tenant_update_admin" ON public.user_roles;
DROP POLICY IF EXISTS "tenant_delete_admin" ON public.user_roles;
CREATE POLICY "tenant_insert_admin"
  ON public.user_roles FOR INSERT TO authenticated
  WITH CHECK (
    public.is_org_admin() AND organization_id = public.get_my_org_id()
    AND ((public.get_org_entitlements(public.get_my_org_id())->>'can_write') = 'true' OR public.is_platform_admin())
  );
CREATE POLICY "tenant_update_admin"
  ON public.user_roles FOR UPDATE TO authenticated
  USING (
    public.is_org_admin() AND organization_id = public.get_my_org_id()
    AND ((public.get_org_entitlements(public.get_my_org_id())->>'can_write') = 'true' OR public.is_platform_admin())
  )
  WITH CHECK (
    public.is_org_admin() AND organization_id = public.get_my_org_id()
    AND ((public.get_org_entitlements(public.get_my_org_id())->>'can_write') = 'true' OR public.is_platform_admin())
  );
CREATE POLICY "tenant_delete_admin"
  ON public.user_roles FOR DELETE TO authenticated
  USING (
    public.is_org_admin() AND organization_id = public.get_my_org_id()
    AND ((public.get_org_entitlements(public.get_my_org_id())->>'can_write') = 'true' OR public.is_platform_admin())
  );

-- profiles: profile_insert_own, profile_update_own – add can_write
DROP POLICY IF EXISTS "profile_insert_own" ON public.profiles;
DROP POLICY IF EXISTS "profile_update_own" ON public.profiles;
CREATE POLICY "profile_insert_own"
  ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (
    id = auth.uid()
    AND ((public.get_org_entitlements(public.get_my_org_id())->>'can_write') = 'true' OR public.is_platform_admin())
  );
CREATE POLICY "profile_update_own"
  ON public.profiles FOR UPDATE TO authenticated
  USING (
    id = auth.uid()
    AND ((public.get_org_entitlements(public.get_my_org_id())->>'can_write') = 'true' OR public.is_platform_admin())
  )
  WITH CHECK (id = auth.uid());

-- organization_settings: tenant insert/update – add can_write
DROP POLICY IF EXISTS "organization_settings_tenant_insert" ON public.organization_settings;
DROP POLICY IF EXISTS "organization_settings_org_admin_update" ON public.organization_settings;
CREATE POLICY "organization_settings_tenant_insert"
  ON public.organization_settings FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.get_my_org_id() AND public.is_org_admin()
    AND ((public.get_org_entitlements(public.get_my_org_id())->>'can_write') = 'true' OR public.is_platform_admin())
  );
CREATE POLICY "organization_settings_org_admin_update"
  ON public.organization_settings FOR UPDATE TO authenticated
  USING (
    organization_id = public.get_my_org_id() AND public.is_org_admin()
    AND ((public.get_org_entitlements(public.get_my_org_id())->>'can_write') = 'true' OR public.is_platform_admin())
  )
  WITH CHECK (organization_id = public.get_my_org_id() AND public.is_org_admin());
