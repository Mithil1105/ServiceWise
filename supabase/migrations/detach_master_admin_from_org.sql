-- Detach master admin (mithil20056mistry@gmail.com) from any organization.
-- Run in Supabase SQL Editor. After this, they will only see the master admin panel and Log out.
-- Keeps their platform/master-admin role (user_roles where organization_id IS NULL).

DO $$
DECLARE
  v_email text := 'mithil20056mistry@gmail.com';
  v_user_id uuid;
BEGIN
  SELECT id INTO v_user_id FROM auth.users WHERE email = v_email LIMIT 1;
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User with email % not found.', v_email;
  END IF;

  -- Clear organization from profile so they are not affiliated to any org
  UPDATE public.profiles
  SET organization_id = NULL
  WHERE id = v_user_id;

  -- Remove all org memberships (tenant app access)
  DELETE FROM public.organization_members WHERE user_id = v_user_id;

  -- Remove all org-scoped roles (keep rows where organization_id IS NULL for master admin)
  DELETE FROM public.user_roles
  WHERE user_id = v_user_id AND organization_id IS NOT NULL;

  RAISE NOTICE 'User % (id: %) detached from all organizations. Master admin role (org null) unchanged.', v_email, v_user_id;
END $$;
