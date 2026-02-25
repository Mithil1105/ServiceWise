-- Allow org admin/manager to UPDATE their own organization (for branding: logo_url, company_name).
-- Previously only master admin could update organizations, so logo and company name saves did nothing.

DROP POLICY IF EXISTS "org_update_master" ON public.organizations;

CREATE POLICY "org_update_master"
  ON public.organizations FOR UPDATE TO authenticated
  USING (public.is_master_admin())
  WITH CHECK (public.is_master_admin());

CREATE POLICY "org_update_org_admin"
  ON public.organizations FOR UPDATE TO authenticated
  USING (
    id = public.get_my_org_id()
    AND public.is_org_admin_member(id)
  )
  WITH CHECK (id = public.get_my_org_id());
