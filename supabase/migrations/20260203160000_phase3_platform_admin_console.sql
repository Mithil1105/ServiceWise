-- Phase 3: Master Admin Platform Console – platform tables, RLS, cross-org read for platform admins.
-- Dangerous mutations via Edge Functions (service role). Tenant users cannot access platform data.

-- 1.1 platform_admins
CREATE TABLE IF NOT EXISTS public.platform_admins (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  level TEXT NOT NULL DEFAULT 'superadmin',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 1.2 plans
CREATE TABLE IF NOT EXISTS public.plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  price_monthly_inr INT NOT NULL DEFAULT 0,
  max_users INT NULL,
  max_vehicles INT NULL,
  features JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 1.3 org_subscriptions
CREATE TABLE IF NOT EXISTS public.org_subscriptions (
  organization_id UUID PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  plan_id UUID REFERENCES public.plans(id),
  status TEXT NOT NULL DEFAULT 'trial' CHECK (status IN ('trial', 'active', 'past_due', 'canceled')),
  trial_ends_at TIMESTAMPTZ NULL,
  current_period_end TIMESTAMPTZ NULL,
  billing_email TEXT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_org_subscriptions_plan_id ON public.org_subscriptions(plan_id);
CREATE INDEX IF NOT EXISTS idx_org_subscriptions_status ON public.org_subscriptions(status);

-- 1.4 platform_announcements
CREATE TABLE IF NOT EXISTS public.platform_announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'info' CHECK (type IN ('info', 'warning', 'maintenance')),
  target_type TEXT NOT NULL DEFAULT 'all' CHECK (target_type IN ('all', 'org', 'plan')),
  target_id UUID NULL,
  starts_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ends_at TIMESTAMPTZ NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_platform_announcements_active_schedule
  ON public.platform_announcements(is_active, starts_at, ends_at);

-- 1.5 organization_settings (org-level overrides)
CREATE TABLE IF NOT EXISTS public.organization_settings (
  organization_id UUID PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  buffer_minutes INT NOT NULL DEFAULT 60,
  minimum_km_per_km INT NOT NULL DEFAULT 300,
  minimum_km_hybrid_per_day INT NOT NULL DEFAULT 300,
  support_notes TEXT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 1.6 platform_audit_log
CREATE TABLE IF NOT EXISTS public.platform_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id UUID NOT NULL,
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id UUID NULL,
  before JSONB NULL,
  after JSONB NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_platform_audit_log_created_at ON public.platform_audit_log(created_at);

-- 1.2 Helper: is_platform_admin()
CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.platform_admins
    WHERE user_id = auth.uid() AND is_active = true
  );
$$;

-- 1.3 RLS: Enable RLS on all new tables
ALTER TABLE public.platform_admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_audit_log ENABLE ROW LEVEL SECURITY;

-- platform_admins: only platform admins can SELECT (modifications via edge/service role)
DROP POLICY IF EXISTS "platform_admins_select" ON public.platform_admins;
CREATE POLICY "platform_admins_select"
  ON public.platform_admins FOR SELECT TO authenticated
  USING (public.is_platform_admin());

-- plans: only platform admins can CRUD
DROP POLICY IF EXISTS "plans_platform_admin_all" ON public.plans;
CREATE POLICY "plans_platform_admin_all"
  ON public.plans FOR ALL TO authenticated
  USING (public.is_platform_admin())
  WITH CHECK (public.is_platform_admin());

-- org_subscriptions: platform admin CRUD; tenant can SELECT only their org row
DROP POLICY IF EXISTS "org_subscriptions_tenant_select" ON public.org_subscriptions;
CREATE POLICY "org_subscriptions_tenant_select"
  ON public.org_subscriptions FOR SELECT TO authenticated
  USING (organization_id = public.get_my_org_id());
DROP POLICY IF EXISTS "org_subscriptions_platform_admin_all" ON public.org_subscriptions;
CREATE POLICY "org_subscriptions_platform_admin_all"
  ON public.org_subscriptions FOR ALL TO authenticated
  USING (public.is_platform_admin())
  WITH CHECK (public.is_platform_admin());

-- platform_announcements: tenant sees active announcements matching target (all / org / plan); platform admin CRUD
DROP POLICY IF EXISTS "platform_announcements_tenant_select" ON public.platform_announcements;
CREATE POLICY "platform_announcements_tenant_select"
  ON public.platform_announcements FOR SELECT TO authenticated
  USING (
    is_active = true
    AND (starts_at <= now())
    AND (ends_at IS NULL OR ends_at >= now())
    AND (
      target_type = 'all'
      OR (target_type = 'org' AND target_id = public.get_my_org_id())
      OR (target_type = 'plan' AND target_id IN (
        SELECT plan_id FROM public.org_subscriptions WHERE organization_id = public.get_my_org_id() AND plan_id IS NOT NULL
      ))
    )
  );
DROP POLICY IF EXISTS "platform_announcements_platform_admin_all" ON public.platform_announcements;
CREATE POLICY "platform_announcements_platform_admin_all"
  ON public.platform_announcements FOR ALL TO authenticated
  USING (public.is_platform_admin())
  WITH CHECK (public.is_platform_admin());

-- organization_settings: tenant SELECT own org; org admin UPDATE own org (optional); platform admin CRUD
DROP POLICY IF EXISTS "organization_settings_tenant_select" ON public.organization_settings;
CREATE POLICY "organization_settings_tenant_select"
  ON public.organization_settings FOR SELECT TO authenticated
  USING (organization_id = public.get_my_org_id());
DROP POLICY IF EXISTS "organization_settings_org_admin_update" ON public.organization_settings;
CREATE POLICY "organization_settings_org_admin_update"
  ON public.organization_settings FOR UPDATE TO authenticated
  USING (organization_id = public.get_my_org_id() AND public.is_org_admin())
  WITH CHECK (organization_id = public.get_my_org_id() AND public.is_org_admin());
DROP POLICY IF EXISTS "organization_settings_tenant_insert" ON public.organization_settings;
CREATE POLICY "organization_settings_tenant_insert"
  ON public.organization_settings FOR INSERT TO authenticated
  WITH CHECK (organization_id = public.get_my_org_id() AND public.is_org_admin());
DROP POLICY IF EXISTS "organization_settings_platform_admin_all" ON public.organization_settings;
CREATE POLICY "organization_settings_platform_admin_all"
  ON public.organization_settings FOR ALL TO authenticated
  USING (public.is_platform_admin())
  WITH CHECK (public.is_platform_admin());

-- platform_audit_log: platform admin SELECT and INSERT (for edge function logging we use service role; optional allow platform admin insert)
DROP POLICY IF EXISTS "platform_audit_log_platform_admin" ON public.platform_audit_log;
CREATE POLICY "platform_audit_log_platform_admin"
  ON public.platform_audit_log FOR SELECT TO authenticated
  USING (public.is_platform_admin());
CREATE POLICY "platform_audit_log_platform_admin_insert"
  ON public.platform_audit_log FOR INSERT TO authenticated
  WITH CHECK (public.is_platform_admin());

-- Organizations: add platform admin SELECT so they can list all orgs (read-only cross-org). Phase 2 already has org_select_own for tenants.
DROP POLICY IF EXISTS "org_select_platform_admin" ON public.organizations;
CREATE POLICY "org_select_platform_admin"
  ON public.organizations FOR SELECT TO authenticated
  USING (public.is_platform_admin());

-- Platform admin read-only cross-org: allow SELECT on profiles, cars, bookings for dashboard metrics
DROP POLICY IF EXISTS "profiles_platform_admin_select" ON public.profiles;
CREATE POLICY "profiles_platform_admin_select"
  ON public.profiles FOR SELECT TO authenticated
  USING (public.is_platform_admin());
DROP POLICY IF EXISTS "cars_platform_admin_select" ON public.cars;
CREATE POLICY "cars_platform_admin_select"
  ON public.cars FOR SELECT TO authenticated
  USING (public.is_platform_admin());
DROP POLICY IF EXISTS "bookings_platform_admin_select" ON public.bookings;
CREATE POLICY "bookings_platform_admin_select"
  ON public.bookings FOR SELECT TO authenticated
  USING (public.is_platform_admin());

-- Seed default plans (idempotent)
INSERT INTO public.plans (name, price_monthly_inr, max_users, max_vehicles, features)
VALUES
  ('MVP', 0, 10, 50, '{"basic": true}'::jsonb),
  ('Pro', 4999, 50, 200, '{"basic": true, "reports": true}'::jsonb),
  ('Enterprise', 14999, NULL, NULL, '{"basic": true, "reports": true, "api": true}'::jsonb)
ON CONFLICT (name) DO NOTHING;

-- Seed master admin: run in SQL editor after migration (auth.users is in auth schema).
-- Replace with your user id, or use the email-based insert below (run as superuser/service role).
-- INSERT INTO public.platform_admins (user_id, level) VALUES ('<your-auth-user-uuid>', 'superadmin');
-- For mithil20056mistry@gmail.com (run in Supabase SQL editor with sufficient privileges):
-- INSERT INTO public.platform_admins (user_id, level)
-- SELECT id, 'superadmin' FROM auth.users WHERE email = 'mithil20056mistry@gmail.com'
-- ON CONFLICT (user_id) DO UPDATE SET level = 'superadmin', is_active = true;
