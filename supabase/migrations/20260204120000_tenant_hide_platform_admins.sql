-- Tenant isolation: organization users must NOT see platform admins in their org.
-- Platform admins (e.g. master admin) may have an organization_id for legacy reasons
-- but must be invisible to tenant user lists and role management.

-- 1) profiles: org members see only non–platform-admin profiles in their org
DROP POLICY IF EXISTS "profile_select_org" ON public.profiles;
CREATE POLICY "profile_select_org"
  ON public.profiles FOR SELECT TO authenticated
  USING (
    organization_id = public.get_my_org_id()
    AND id NOT IN (SELECT user_id FROM public.platform_admins WHERE is_active = true)
  );

-- 2) user_roles: tenant SELECT must not return rows for platform admins
-- (so User Management / role dropdowns never show platform admins)
DROP POLICY IF EXISTS "tenant_select" ON public.user_roles;
CREATE POLICY "tenant_select"
  ON public.user_roles FOR SELECT TO authenticated
  USING (
    organization_id = public.get_my_org_id()
    AND user_id NOT IN (SELECT user_id FROM public.platform_admins WHERE is_active = true)
  );
