-- =============================================================================
-- RUN THIS IN SUPABASE SQL EDITOR (Dashboard > SQL Editor > New query)
-- Copy-paste the entire script and click "Run".
-- This ensures the master admin is never visible in any organization's user list.
-- =============================================================================

-- Step 1: Ensure master admin (mithil20056mistry@gmail.com) is in platform_admins
-- so the RLS exclusion can hide them from tenant user lists.
INSERT INTO public.platform_admins (user_id, level, is_active)
SELECT id, 'superadmin', true
FROM auth.users
WHERE email = 'mithil20056mistry@gmail.com'
ON CONFLICT (user_id) DO UPDATE SET level = 'superadmin', is_active = true;

-- Step 2: profiles – tenant users see only org members who are NOT platform admins
DROP POLICY IF EXISTS "profile_select_org" ON public.profiles;
CREATE POLICY "profile_select_org"
  ON public.profiles FOR SELECT TO authenticated
  USING (
    organization_id = public.get_my_org_id()
    AND id NOT IN (SELECT user_id FROM public.platform_admins WHERE is_active = true)
  );

-- Step 3: user_roles – tenant users see only role rows for users who are NOT platform admins
DROP POLICY IF EXISTS "tenant_select" ON public.user_roles;
CREATE POLICY "tenant_select"
  ON public.user_roles FOR SELECT TO authenticated
  USING (
    organization_id = public.get_my_org_id()
    AND user_id NOT IN (SELECT user_id FROM public.platform_admins WHERE is_active = true)
  );

-- Done. Refresh the User Management page; the master admin will no longer appear.
