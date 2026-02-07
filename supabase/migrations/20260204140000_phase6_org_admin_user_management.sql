-- Phase 6: Org admin user management + email verification (self-serve).
-- B1) Add user management fields to profiles

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS invited_by_user_id UUID NULL REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS created_via TEXT NOT NULL DEFAULT 'self' CHECK (created_via IN ('self', 'org_admin', 'platform_admin')),
  ADD COLUMN IF NOT EXISTS deactivated_at TIMESTAMPTZ NULL;

-- Index for listing active users by org
CREATE INDEX IF NOT EXISTS idx_profiles_organization_id_is_active
  ON public.profiles(organization_id, is_active);

-- Backfill existing rows
UPDATE public.profiles
SET is_active = COALESCE(is_active, true),
    created_via = COALESCE(created_via, 'self')
WHERE is_active IS NULL OR created_via IS NULL;

-- B2) Trigger: only service role (or backend) can change is_active; clients cannot.
CREATE OR REPLACE FUNCTION public.profiles_block_is_active_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND (OLD.is_active IS DISTINCT FROM NEW.is_active OR OLD.deactivated_at IS DISTINCT FROM NEW.deactivated_at) THEN
    -- Allow only when no user JWT (service role / edge function)
    IF auth.uid() IS NOT NULL THEN
      RAISE EXCEPTION 'Cannot change is_active or deactivated_at from client. Use org-admin edge functions.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_block_is_active_change ON public.profiles;
CREATE TRIGGER profiles_block_is_active_change
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.profiles_block_is_active_change();

-- B3) Optional: tenant-level user management audit table
CREATE TABLE IF NOT EXISTS public.org_user_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  actor_user_id UUID NOT NULL REFERENCES auth.users(id),
  action TEXT NOT NULL CHECK (action IN ('create_user', 'reset_password', 'deactivate_user', 'activate_user')),
  target_user_id UUID NOT NULL REFERENCES auth.users(id),
  before_state JSONB NULL,
  after_state JSONB NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_org_user_audit_log_organization_id ON public.org_user_audit_log(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_user_audit_log_created_at ON public.org_user_audit_log(created_at);

ALTER TABLE public.org_user_audit_log ENABLE ROW LEVEL SECURITY;

-- Org members can SELECT within their org
DROP POLICY IF EXISTS "org_user_audit_tenant_select" ON public.org_user_audit_log;
CREATE POLICY "org_user_audit_tenant_select"
  ON public.org_user_audit_log FOR SELECT TO authenticated
  USING (organization_id = public.get_my_org_id());

-- Only org admins can INSERT (edge functions use service role; this is for any future client insert)
DROP POLICY IF EXISTS "org_user_audit_org_admin_insert" ON public.org_user_audit_log;
CREATE POLICY "org_user_audit_org_admin_insert"
  ON public.org_user_audit_log FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.get_my_org_id()
    AND public.is_org_admin()
  );

-- Platform admins can SELECT all (optional)
DROP POLICY IF EXISTS "org_user_audit_platform_select" ON public.org_user_audit_log;
CREATE POLICY "org_user_audit_platform_select"
  ON public.org_user_audit_log FOR SELECT TO authenticated
  USING (public.is_platform_admin());
