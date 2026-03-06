-- Multi-tenant user creation: handle_new_user reads organization_id from metadata;
-- assign_user_to_organization RPC for assigning created user to admin's org and role.

-- 1) Update handle_new_user: when auth user is created with organization_id in metadata,
--    upsert profile with that org and upsert organization_members (default role supervisor).
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_org_id UUID;
  meta_org TEXT;
BEGIN
  meta_org := NEW.raw_user_meta_data ->> 'organization_id';
  IF meta_org IS NOT NULL AND meta_org ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' THEN
    user_org_id := meta_org::UUID;
    IF EXISTS (SELECT 1 FROM public.organizations WHERE id = user_org_id) THEN
      INSERT INTO public.profiles (id, name, organization_id)
      VALUES (
        NEW.id,
        COALESCE(NULLIF(TRIM(NEW.raw_user_meta_data ->> 'name'), ''), COALESCE(NEW.email, 'New User')),
        user_org_id
      )
      ON CONFLICT (id) DO UPDATE SET
        name = COALESCE(NULLIF(TRIM(EXCLUDED.name), ''), profiles.name),
        organization_id = EXCLUDED.organization_id;

      INSERT INTO public.organization_members (organization_id, user_id, role, status)
      VALUES (user_org_id, NEW.id, 'supervisor', 'active')
      ON CONFLICT (organization_id, user_id) DO UPDATE SET status = 'active';
      RETURN NEW;
    END IF;
  END IF;

  -- No valid org in metadata: create profile with NULL organization_id (onboarding flow)
  INSERT INTO public.profiles (id, name, organization_id)
  VALUES (
    NEW.id,
    COALESCE(NULLIF(TRIM(NEW.raw_user_meta_data ->> 'name'), ''), COALESCE(NEW.email, 'New User')),
    NULL
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- 2) RPC: assign user to organization and role (called after auth user creation).
CREATE OR REPLACE FUNCTION public.assign_user_to_organization(
  p_user_id UUID,
  p_organization_id UUID,
  p_role TEXT DEFAULT 'supervisor'
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name TEXT;
  v_email TEXT;
BEGIN
  IF p_organization_id IS NULL THEN
    RETURN;
  END IF;
  IF p_role IS NULL OR p_role NOT IN ('supervisor', 'manager', 'admin') THEN
    p_role := 'supervisor';
  END IF;

  SELECT raw_user_meta_data->>'name', email INTO v_name, v_email
  FROM auth.users WHERE id = p_user_id;
  v_name := COALESCE(NULLIF(TRIM(v_name), ''), v_email, 'New User');

  INSERT INTO public.profiles (id, name, organization_id)
  VALUES (p_user_id, v_name, p_organization_id)
  ON CONFLICT (id) DO UPDATE SET
    organization_id = EXCLUDED.organization_id,
    name = COALESCE(NULLIF(TRIM(EXCLUDED.name), ''), profiles.name);

  INSERT INTO public.organization_members (organization_id, user_id, role, status)
  VALUES (p_organization_id, p_user_id, p_role, 'active')
  ON CONFLICT (organization_id, user_id) DO UPDATE SET
    role = EXCLUDED.role,
    status = 'active';

  INSERT INTO public.user_roles (user_id, organization_id, role, created_at)
  VALUES (p_user_id, p_organization_id, p_role, now())
  ON CONFLICT (user_id, organization_id) DO UPDATE SET role = EXCLUDED.role;
END;
$$;

GRANT EXECUTE ON FUNCTION public.assign_user_to_organization(UUID, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.assign_user_to_organization(UUID, UUID, TEXT) TO service_role;

COMMENT ON FUNCTION public.assign_user_to_organization(UUID, UUID, TEXT) IS
  'Assigns an auth user to an organization with the given role. Used after org admin creates user (Admin API or signUp).';

NOTIFY pgrst, 'reload schema';
