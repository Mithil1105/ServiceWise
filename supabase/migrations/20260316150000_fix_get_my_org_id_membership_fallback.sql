-- Fix get_my_org_id to use organization_members as primary source, with profile fallback.
-- Users with active organization_members but NULL profile.organization_id were getting NULL,
-- causing check_available_cars and other RPCs to return no data (e.g. no vehicles in assign flow).
-- This aligns get_my_org_id with is_active_member's logic: membership is source of truth.

CREATE OR REPLACE FUNCTION public.get_my_org_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    -- 1) Prefer organization_members (membership is source of truth)
    (SELECT om.organization_id
     FROM public.organization_members om
     WHERE om.user_id = auth.uid()
       AND om.status = 'active'
     LIMIT 1),
    -- 2) Fallback: profile.organization_id for legacy users without membership row
    (SELECT p.organization_id
     FROM public.profiles p
     WHERE p.id = auth.uid()
       AND p.organization_id IS NOT NULL
     LIMIT 1)
  );
$$;

COMMENT ON FUNCTION public.get_my_org_id() IS 'Returns current user organization ID. Prefers organization_members (active), falls back to profile.organization_id for legacy users.';
