-- 1) Create organization "Patidar Travels"
-- 2) Move user admin@patidartravels.com to this org and make them org admin
--
-- Run this in the Supabase SQL Editor. Ensure the user admin@patidartravels.com
-- already exists in Authentication → Users.

DO $$
DECLARE
  v_new_org_id   uuid;
  v_user_id      uuid;
  v_user_email  text := 'admin@patidartravels.com';
BEGIN
  -- Resolve user
  SELECT id INTO v_user_id FROM auth.users WHERE email = v_user_email LIMIT 1;
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User with email % not found. Create the user in Dashboard → Authentication → Users first.', v_user_email;
  END IF;

  -- 1) Insert new organization (join_code uses default from generate_join_code())
  INSERT INTO public.organizations (
    id,
    name,
    slug,
    company_name,
    status,
    plan,
    created_at,
    created_by
  )
  VALUES (
    gen_random_uuid(),
    'Patidar Travels',
    'patidar-travels',
    'Patidar Travels',
    'active',
    'mvp',
    now(),
    v_user_id
  )
  RETURNING id INTO v_new_org_id;

  -- 2) Point profile to new org
  INSERT INTO public.profiles (id, name, organization_id, is_active, created_at)
  VALUES (v_user_id, 'Patidar Travels Admin', v_new_org_id, true, now())
  ON CONFLICT (id) DO UPDATE
    SET organization_id = EXCLUDED.organization_id,
        name            = EXCLUDED.name,
        is_active       = true;

  -- 3) Remove user from previous org(s) in organization_members and user_roles
  DELETE FROM public.organization_members WHERE user_id = v_user_id;
  DELETE FROM public.user_roles WHERE user_id = v_user_id;

  -- 4) Add user as admin in the new org
  INSERT INTO public.organization_members (organization_id, user_id, role, status, created_at)
  VALUES (v_new_org_id, v_user_id, 'admin', 'active', now());

  INSERT INTO public.user_roles (user_id, organization_id, role, created_at)
  VALUES (v_user_id, v_new_org_id, 'admin', now());

  RAISE NOTICE 'Organization "Patidar Travels" created (id: %). User % is now org admin.', v_new_org_id, v_user_email;
END $$;
