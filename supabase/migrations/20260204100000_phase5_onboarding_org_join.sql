-- Phase 5: Org onboarding, join-by-code, master admin org creation (no email).

-- A1) Allow profiles without org (nullable organization_id for new signups)
ALTER TABLE public.profiles
  ALTER COLUMN organization_id DROP NOT NULL;

-- A4) Generate unique org code function (create first so we can use it)
CREATE OR REPLACE FUNCTION public.generate_org_code()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c TEXT;
BEGIN
  LOOP
    c := (100000 + floor(random() * 9000000))::text;
    IF length(c) = 6 OR length(c) = 7 THEN
      EXIT WHEN NOT EXISTS (SELECT 1 FROM public.organizations WHERE org_code = c);
    END IF;
  END LOOP;
  RETURN c;
END;
$$;

-- A2) Add organization join code to organizations
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS org_code TEXT NULL;

-- Backfill existing orgs with unique codes
DO $$
DECLARE
  r RECORD;
  c TEXT;
BEGIN
  FOR r IN (SELECT id FROM public.organizations WHERE org_code IS NULL)
  LOOP
    c := public.generate_org_code();
    UPDATE public.organizations SET org_code = c WHERE id = r.id;
  END LOOP;
END $$;

ALTER TABLE public.organizations
  ALTER COLUMN org_code SET NOT NULL;

ALTER TABLE public.organizations
  DROP CONSTRAINT IF EXISTS organizations_org_code_format;

ALTER TABLE public.organizations
  ADD CONSTRAINT organizations_org_code_format CHECK (org_code ~ '^[0-9]{6,7}$');

CREATE UNIQUE INDEX IF NOT EXISTS idx_organizations_org_code ON public.organizations(org_code);

-- Set default for new orgs
ALTER TABLE public.organizations
  ALTER COLUMN org_code SET DEFAULT public.generate_org_code();

-- A3) created_at and created_by already exist on organizations from Phase 1.

-- A5) Onboarding requests table (lightweight tracking)
CREATE TABLE IF NOT EXISTS public.onboarding_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('create_org', 'join_org')),
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_onboarding_requests_user_id ON public.onboarding_requests(user_id);

ALTER TABLE public.onboarding_requests ENABLE ROW LEVEL SECURITY;

-- Only platform admin can SELECT onboarding_requests; inserts from edge functions (service role)
DROP POLICY IF EXISTS "onboarding_requests_platform_admin_select" ON public.onboarding_requests;
CREATE POLICY "onboarding_requests_platform_admin_select"
  ON public.onboarding_requests FOR SELECT TO authenticated
  USING (public.is_platform_admin());

-- Allow service role to insert (edge functions); no policy needed for anon/authenticated insert
-- RLS: no INSERT for authenticated by default, so only service_role can insert.

-- B1) Trigger: prevent client from changing organization_id on profiles
CREATE OR REPLACE FUNCTION public.profiles_block_org_id_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.organization_id IS DISTINCT FROM OLD.organization_id THEN
    IF public.is_platform_admin() THEN
      RETURN NEW;
    END IF;
    IF current_setting('request.jwt.claim.role', true) = 'service_role' THEN
      RETURN NEW;
    END IF;
    IF current_setting('role', true) = 'service_role' THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'organization_id can only be set via platform or join/create org flows';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_block_org_id_change_trigger ON public.profiles;
CREATE TRIGGER profiles_block_org_id_change_trigger
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.profiles_block_org_id_change();

-- B2) profiles: org-member select policy – only when get_my_org_id() is not null
-- Phase 2 policy "profile_select_org" uses (organization_id = public.get_my_org_id()).
-- When get_my_org_id() is null, (organization_id = null) is NULL in SQL, so no rows. Safe.
-- Ensure profile_update_own does not allow updating organization_id (trigger blocks it).

-- Unique (user_id, organization_id) on user_roles for upsert in join/create flows
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'user_roles_user_id_organization_id_key'
    AND conrelid = 'public.user_roles'::regclass
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.user_roles'::regclass
    AND pg_get_constraintdef(oid) LIKE '%user_id%organization_id%'
  ) THEN
    ALTER TABLE public.user_roles
    ADD CONSTRAINT user_roles_user_id_organization_id_key UNIQUE (user_id, organization_id);
  END IF;
END $$;

-- Update handle_new_user: do NOT assign DEMO org; leave organization_id NULL for onboarding
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, name, organization_id)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'name', NEW.email),
    NULL
  );
  RETURN NEW;
END;
$$;
