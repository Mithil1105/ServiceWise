-- Only org admins (or master admin) can remove members; no self-removal.
-- Org admins can remove other members only; they cannot remove themselves.

DROP POLICY IF EXISTS "organization_members_delete_org_admin" ON public.organization_members;

CREATE POLICY "organization_members_delete_org_admin"
  ON public.organization_members FOR DELETE TO authenticated
  USING (
    public.is_master_admin()
    OR (
      public.is_org_admin_member(organization_id)
      AND user_id != auth.uid()
    )
  );
