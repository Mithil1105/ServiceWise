-- Phase 1: Multi-tenant foundation – organizations and organization_id on all business tables
-- Default org: DEMO. Backfill existing data into DEMO. No RLS isolation yet.

-- Ensure gen_random_uuid is available (built-in in Postgres 13+)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1) Create organizations table
CREATE TABLE IF NOT EXISTS public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
  plan TEXT NOT NULL DEFAULT 'mvp',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID NULL REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_organizations_status ON public.organizations(status);

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view organizations"
  ON public.organizations FOR SELECT TO authenticated USING (true);

-- 2) Add organization_id to profiles and user_roles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS organization_id UUID NULL REFERENCES public.organizations(id);

ALTER TABLE public.user_roles
  ADD COLUMN IF NOT EXISTS organization_id UUID NULL REFERENCES public.organizations(id);

-- 3) Add organization_id to all business tables (only if table exists)
DO $$
DECLARE
  t TEXT;
  tables TEXT[] := ARRAY[
    'cars', 'drivers', 'customers', 'bookings', 'booking_vehicles', 'booking_requested_vehicles',
    'booking_audit_log', 'bills', 'company_bills', 'transfers', 'bank_accounts',
    'service_rules', 'car_service_rules', 'service_records', 'odometer_entries',
    'incidents', 'downtime_logs', 'system_config', 'car_documents', 'car_notes',
    'car_assignments', 'supervisor_activity_log', 'user_snoozes', 'tentative_holds'
  ];
BEGIN
  FOREACH t IN ARRAY tables
  LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = t) THEN
      EXECUTE format(
        'ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS organization_id UUID NULL REFERENCES public.organizations(id)',
        t
      );
    END IF;
  END LOOP;
END $$;

-- 4) Create default organization DEMO and backfill
INSERT INTO public.organizations (id, name, slug, status, plan)
VALUES (
  gen_random_uuid(),
  'DEMO',
  'demo',
  'active',
  'mvp'
)
ON CONFLICT (slug) DO NOTHING;

DO $$
DECLARE
  demo_id UUID;
  t TEXT;
  tables TEXT[] := ARRAY[
    'profiles', 'user_roles', 'cars', 'drivers', 'customers', 'bookings', 'booking_vehicles',
    'booking_requested_vehicles', 'booking_audit_log', 'bills', 'company_bills', 'transfers',
    'bank_accounts', 'service_rules', 'car_service_rules', 'service_records', 'odometer_entries',
    'incidents', 'downtime_logs', 'system_config', 'car_documents', 'car_notes',
    'car_assignments', 'supervisor_activity_log', 'user_snoozes', 'tentative_holds'
  ];
BEGIN
  SELECT id INTO demo_id FROM public.organizations WHERE slug = 'demo' LIMIT 1;
  IF demo_id IS NULL THEN
    RAISE EXCEPTION 'Default organization DEMO not found';
  END IF;

  FOREACH t IN ARRAY tables
  LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = t) THEN
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = t AND column_name = 'organization_id') THEN
        EXECUTE format('UPDATE public.%I SET organization_id = $1 WHERE organization_id IS NULL', t) USING demo_id;
      END IF;
    END IF;
  END LOOP;
END $$;

-- 5) Set organization_id NOT NULL on all tables
DO $$
DECLARE
  t TEXT;
  tables TEXT[] := ARRAY[
    'profiles', 'user_roles', 'cars', 'drivers', 'customers', 'bookings', 'booking_vehicles',
    'booking_requested_vehicles', 'booking_audit_log', 'bills', 'company_bills', 'transfers',
    'bank_accounts', 'service_rules', 'car_service_rules', 'service_records', 'odometer_entries',
    'incidents', 'downtime_logs', 'system_config', 'car_documents', 'car_notes',
    'car_assignments', 'supervisor_activity_log', 'user_snoozes', 'tentative_holds'
  ];
BEGIN
  FOREACH t IN ARRAY tables
  LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = t) THEN
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = t AND column_name = 'organization_id') THEN
        EXECUTE format('ALTER TABLE public.%I ALTER COLUMN organization_id SET NOT NULL', t);
      END IF;
    END IF;
  END LOOP;
END $$;

-- 6) Add indexes on organization_id
DO $$
DECLARE
  t TEXT;
  tables TEXT[] := ARRAY[
    'profiles', 'user_roles', 'cars', 'drivers', 'customers', 'bookings', 'booking_vehicles',
    'booking_requested_vehicles', 'booking_audit_log', 'bills', 'company_bills', 'transfers',
    'bank_accounts', 'service_rules', 'car_service_rules', 'service_records', 'odometer_entries',
    'incidents', 'downtime_logs', 'system_config', 'car_documents', 'car_notes',
    'car_assignments', 'supervisor_activity_log', 'user_snoozes', 'tentative_holds'
  ];
BEGIN
  FOREACH t IN ARRAY tables
  LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = t) THEN
      EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%I_organization_id ON public.%I (organization_id)', t, t);
    END IF;
  END LOOP;
END $$;

-- 7) Optional: unique (organization_id, vehicle_number) on cars
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'cars') THEN
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE table_schema = 'public' AND table_name = 'cars' AND constraint_name = 'cars_vehicle_number_key') THEN
      ALTER TABLE public.cars DROP CONSTRAINT cars_vehicle_number_key;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE table_schema = 'public' AND table_name = 'cars' AND constraint_name = 'cars_organization_id_vehicle_number_key') THEN
      ALTER TABLE public.cars ADD CONSTRAINT cars_organization_id_vehicle_number_key UNIQUE (organization_id, vehicle_number);
    END IF;
  END IF;
END $$;

-- 8) Optional: unique (organization_id, booking_ref) on bookings
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'bookings') THEN
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE table_schema = 'public' AND table_name = 'bookings' AND constraint_name = 'bookings_booking_ref_key') THEN
      ALTER TABLE public.bookings DROP CONSTRAINT bookings_booking_ref_key;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE table_schema = 'public' AND table_name = 'bookings' AND constraint_name = 'bookings_organization_id_booking_ref_key') THEN
      ALTER TABLE public.bookings ADD CONSTRAINT bookings_organization_id_booking_ref_key UNIQUE (organization_id, booking_ref);
    END IF;
  END IF;
END $$;

-- 9) Update handle_new_user trigger to set organization_id to DEMO for new signups
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  demo_org_id UUID;
BEGIN
  SELECT id INTO demo_org_id FROM public.organizations WHERE slug = 'demo' LIMIT 1;
  INSERT INTO public.profiles (id, name, organization_id)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'name', NEW.email),
    COALESCE(demo_org_id, (SELECT id FROM public.organizations LIMIT 1))
  );
  RETURN NEW;
END;
$$;

-- 10) Helper: get current user's org_id from profiles (for Phase 2 RLS)
CREATE OR REPLACE FUNCTION public.get_my_org_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT organization_id FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$$;
