-- Fix RLS membership checks: treat profile.organization_id as active membership fallback.
-- This helps avoid "new row violates row-level security policy" errors on tables like
-- incidents, downtime_logs, drivers, traffic_challans, etc. for legacy users whose
-- organization_members row is missing but profiles.organization_id is correctly set.

CREATE OR REPLACE FUNCTION public.is_active_member(p_org_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    -- Master admins are always considered active for any org
    public.is_master_admin()
    OR EXISTS (
      SELECT 1
      FROM public.organization_members om
      WHERE om.organization_id = p_org_id
        AND om.user_id = auth.uid()
        AND om.status = 'active'
    )
    -- Fallback: legacy users whose profile.organization_id is set but membership row is missing
    OR EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.organization_id = p_org_id
    );
$$;

COMMENT ON FUNCTION public.is_active_member(UUID) IS
  'Returns true if current user is an active member of the given organization, or a master admin. Also treats a matching profiles.organization_id as active membership fallback for legacy users.';

