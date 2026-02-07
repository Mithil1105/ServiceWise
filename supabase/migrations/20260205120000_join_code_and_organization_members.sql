-- Join organization by code (SW-XXXX-XXXX) and pending-request flow.
-- Code format: SW-XXXX-XXXX (e.g. SW-A1B2-C3D4). Users request to join; org admin approves.

-- 1) Generate human-readable join code (SW- + 4 chars + - + 4 chars)
CREATE OR REPLACE FUNCTION public.generate_join_code()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  chars TEXT := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  part1 TEXT := '';
  part2 TEXT := '';
  i INT;
  c TEXT;
BEGIN
  FOR i IN 1..4 LOOP
    part1 := part1 || substr(chars, 1 + floor(random() * length(chars))::int, 1);
  END LOOP;
  FOR i IN 1..4 LOOP
    part2 := part2 || substr(chars, 1 + floor(random() * length(chars))::int, 1);
  END LOOP;
  c := 'SW-' || part1 || '-' || part2;
  IF EXISTS (SELECT 1 FROM public.organizations WHERE join_code = c) THEN
    RETURN public.generate_join_code();
  END IF;
  RETURN c;
END;
$$;

-- 2) Add join_code to organizations (nullable first for backfill)
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS join_code TEXT NULL;

-- Backfill existing orgs with unique join codes
DO $$
DECLARE
  r RECORD;
  c TEXT;
BEGIN
  FOR r IN (SELECT id FROM public.organizations WHERE join_code IS NULL)
  LOOP
    c := public.generate_join_code();
    UPDATE public.organizations SET join_code = c WHERE id = r.id;
  END LOOP;
END $$;

ALTER TABLE public.organizations
  ALTER COLUMN join_code SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_organizations_join_code ON public.organizations(join_code);

ALTER TABLE public.organizations
  ALTER COLUMN join_code SET DEFAULT public.generate_join_code();

ALTER TABLE public.organizations
  DROP CONSTRAINT IF EXISTS organizations_join_code_format;
ALTER TABLE public.organizations
  ADD CONSTRAINT organizations_join_code_format CHECK (join_code ~ '^SW-[A-Z0-9]{4}-[A-Z0-9]{4}$');

-- 3) organization_members: pending / active / blocked (one row per user per org)
CREATE TABLE IF NOT EXISTS public.organization_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'supervisor' CHECK (role IN ('supervisor', 'manager', 'admin')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'blocked')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(organization_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_organization_members_org_status ON public.organization_members(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_organization_members_user ON public.organization_members(user_id);

ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;

-- Users can see their own memberships
CREATE POLICY "organization_members_select_own"
  ON public.organization_members FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Org admins/managers can see members (including pending) for their org
CREATE POLICY "organization_members_select_org_admin"
  ON public.organization_members FOR SELECT TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM public.user_roles
      WHERE user_id = auth.uid() AND role IN ('admin', 'manager')
    )
  );

-- Users can request to join: insert own row with status = pending
CREATE POLICY "organization_members_insert_pending"
  ON public.organization_members FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND status = 'pending');

-- Org admins/managers can update pending rows (approve -> active, or block)
CREATE POLICY "organization_members_update_org_admin"
  ON public.organization_members FOR UPDATE TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM public.user_roles
      WHERE user_id = auth.uid() AND role IN ('admin', 'manager')
    )
    AND status = 'pending'
  )
  WITH CHECK (true);

-- 4) Trigger: when organization_members.status becomes 'active', set profile.organization_id and user_roles
CREATE OR REPLACE FUNCTION public.organization_members_on_approve()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'active' AND (OLD.status IS NULL OR OLD.status != 'active') THEN
    PERFORM set_config('app.approving_member', 'true', true);
    UPDATE public.profiles
    SET organization_id = NEW.organization_id, updated_at = now()
    WHERE id = NEW.user_id;
    INSERT INTO public.user_roles (user_id, organization_id, role, created_at)
    VALUES (NEW.user_id, NEW.organization_id, NEW.role, now())
    ON CONFLICT (user_id, organization_id) DO UPDATE SET role = NEW.role;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS organization_members_approve_trigger ON public.organization_members;
CREATE TRIGGER organization_members_approve_trigger
  AFTER UPDATE ON public.organization_members
  FOR EACH ROW EXECUTE FUNCTION public.organization_members_on_approve();

-- Allow trigger to set organization_id on profiles
CREATE OR REPLACE FUNCTION public.profiles_block_org_id_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.organization_id IS DISTINCT FROM OLD.organization_id THEN
    IF current_setting('app.approving_member', true) = 'true' THEN
      RETURN NEW;
    END IF;
    IF public.is_platform_admin() THEN
      RETURN NEW;
    END IF;
    IF current_setting('request.jwt.claim.role', true) = 'service_role' THEN
      RETURN NEW;
    END IF;
    IF current_setting('role', true) = 'service_role' THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'organization_id can only be set via platform, join approval, or join/create org flows';
  END IF;
  RETURN NEW;
END;
$$;
