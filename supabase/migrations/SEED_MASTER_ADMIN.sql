-- Seed master admin for Phase 3 Platform Console
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor) after applying migrations.
-- Requires permission to read auth.users (e.g. run as postgres/superuser or use service role).

-- Option 1: By email (recommended) – seeds mithil20056mistry@gmail.com as superadmin
INSERT INTO public.platform_admins (user_id, level)
SELECT id, 'superadmin'
FROM auth.users
WHERE email = 'mithil20056mistry@gmail.com'
ON CONFLICT (user_id) DO UPDATE SET level = 'superadmin', is_active = true;

-- Option 2: By user UUID (if you already have the auth user id)
-- INSERT INTO public.platform_admins (user_id, level)
-- VALUES ('<your-auth-user-uuid>', 'superadmin')
-- ON CONFLICT (user_id) DO UPDATE SET level = 'superadmin', is_active = true;
