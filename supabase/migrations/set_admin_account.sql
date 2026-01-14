-- ============================================
-- SET ADMIN ACCOUNT
-- This script assigns admin role to admin@patidartravels.com
-- ============================================

DO $$
DECLARE
  admin_user_id UUID;
  role_count INTEGER;
  role_name TEXT;
BEGIN
  -- Find the user with the admin email
  SELECT id INTO admin_user_id 
  FROM auth.users 
  WHERE email = 'admin@patidartravels.com';
  
  -- Check if user exists
  IF admin_user_id IS NULL THEN
    RAISE EXCEPTION 'User with email admin@patidartravels.com not found. Please create the user first through Supabase Auth.';
  END IF;
  
  RAISE NOTICE 'Found user: %', admin_user_id;
  
  -- Ensure profile exists
  INSERT INTO public.profiles (id, name, created_at, updated_at)
  VALUES (admin_user_id, 'Admin User', now(), now())
  ON CONFLICT (id) DO UPDATE 
    SET name = COALESCE(EXCLUDED.name, public.profiles.name),
        updated_at = now();
  
  RAISE NOTICE 'Profile created/updated successfully';
  
  -- Remove any existing roles first to avoid conflicts
  DELETE FROM public.user_roles WHERE user_id = admin_user_id;
  
  -- Assign admin role (only admin, not manager, to avoid .single() issues in frontend)
  INSERT INTO public.user_roles (user_id, role, created_at)
  VALUES (admin_user_id, 'admin'::public.app_role, now());
  
  -- Verify the role was assigned
  SELECT COUNT(*) INTO role_count 
  FROM public.user_roles 
  WHERE user_id = admin_user_id AND role = 'admin'::public.app_role;
  
  IF role_count = 0 THEN
    RAISE EXCEPTION 'Failed to assign admin role. Please check the user_roles table.';
  END IF;
  
  RAISE NOTICE 'Successfully assigned admin role to admin@patidartravels.com (User ID: %)', admin_user_id;
  RAISE NOTICE 'Role verification: % admin role(s) found', role_count;
  
  -- Show current roles for verification
  RAISE NOTICE 'Current roles for this user:';
  FOR role_name IN 
    SELECT role::TEXT FROM public.user_roles WHERE user_id = admin_user_id
  LOOP
    RAISE NOTICE '  - %', role_name;
  END LOOP;
END $$;

-- Verification query (run this separately to check)
-- SELECT u.email, ur.role, p.name
-- FROM auth.users u
-- LEFT JOIN public.user_roles ur ON u.id = ur.user_id
-- LEFT JOIN public.profiles p ON u.id = p.id
-- WHERE u.email = 'admin@patidartravels.com';

