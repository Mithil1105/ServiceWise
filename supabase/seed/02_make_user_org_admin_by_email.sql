-- Step 2: Make the user with this email the org admin for Unimisk
-- Run this AFTER creating the user in Supabase Dashboard (Authentication → Users)
-- and AFTER running 01_create_organisation_unimisk.sql.
-- Replace the email and org_id with your values.

DO $$
DECLARE
  v_email    text := 'admin@mistryandshah.com';
  v_org_id   uuid := (SELECT id FROM public.organizations WHERE slug = 'unimisk' LIMIT 1);
  v_user_id  uuid;
BEGIN
  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Organization "Unimisk" not found. Run 01_create_organisation_unimisk.sql first.';
  END IF;

  SELECT id INTO v_user_id FROM auth.users WHERE email = v_email LIMIT 1;
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User with email % not found. Create the user in Dashboard → Authentication → Users first.', v_email;
  END IF;

  -- Profile: link to org
  INSERT INTO public.profiles (id, name, organization_id, is_active, created_at)
  VALUES (v_user_id, 'Unimisk Admin', v_org_id, true, now())
  ON CONFLICT (id) DO UPDATE
    SET organization_id = EXCLUDED.organization_id,
        name = EXCLUDED.name,
        is_active = true;

  -- Membership: admin, active
  INSERT INTO public.organization_members (organization_id, user_id, role, status, created_at)
  VALUES (v_org_id, v_user_id, 'admin', 'active', now())
  ON CONFLICT (organization_id, user_id) DO UPDATE
    SET role = 'admin',
        status = 'active';

  -- Role row (org admin, not platform admin)
  INSERT INTO public.user_roles (user_id, organization_id, role, created_at)
  VALUES (v_user_id, v_org_id, 'admin', now())
  ON CONFLICT (user_id, organization_id) DO UPDATE
    SET role = 'admin';

  RAISE NOTICE 'User % is now org admin for Unimisk (org_id: %)', v_email, v_org_id;
END $$;
