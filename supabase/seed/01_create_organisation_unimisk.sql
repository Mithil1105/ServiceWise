-- Step 1: Create organisation "Unimisk"
-- Run this first. Copy the returned id for use in Step 3 (dummy data).

INSERT INTO public.organizations (
  id,
  name,
  slug,
  company_name,
  status,
  plan,
  created_at
)
VALUES (
  gen_random_uuid(),
  'Unimisk',
  'unimisk',
  'Unimisk',
  'active',
  'mvp',
  now()
)
RETURNING id, name, slug, join_code;
