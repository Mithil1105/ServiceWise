-- Add fuel_entries table + fuel_filler role support
-- - Extends public.organization_members.role CHECK constraint
-- - Creates public.fuel_entries with RLS policies

DO $$
DECLARE
  r RECORD;
BEGIN
  -- Drop existing role CHECK constraints that only allow admin/manager/supervisor
  FOR r IN
    SELECT tc.constraint_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.check_constraints cc
      ON cc.constraint_name = tc.constraint_name
     AND cc.constraint_schema = tc.table_schema
    WHERE tc.table_schema = 'public'
      AND tc.table_name = 'organization_members'
      AND tc.constraint_type = 'CHECK'
      AND cc.check_clause ILIKE '%role IN%'
  LOOP
    EXECUTE format('ALTER TABLE public.organization_members DROP CONSTRAINT %I', r.constraint_name);
  END LOOP;

  -- Add/replace the canonical role check constraint
  IF EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'organization_members'
      AND constraint_type = 'CHECK'
      AND constraint_name = 'organization_members_role_check'
  ) THEN
    ALTER TABLE public.organization_members DROP CONSTRAINT organization_members_role_check;
  END IF;

  ALTER TABLE public.organization_members
    ADD CONSTRAINT organization_members_role_check
    CHECK (role IN ('supervisor', 'manager', 'admin', 'fuel_filler'));
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'fuel_entries'
  ) THEN
    CREATE TABLE public.fuel_entries (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
      car_id UUID NOT NULL REFERENCES public.cars(id) ON DELETE CASCADE,

      -- Stored as TIMESTAMPTZ so we can build correct timelines and full-tank segments
      filled_at TIMESTAMPTZ NOT NULL DEFAULT now(),

      odometer_km INTEGER NOT NULL CHECK (odometer_km >= 0),
      fuel_liters NUMERIC(12, 3) NOT NULL CHECK (fuel_liters > 0),
      amount_inr NUMERIC(12, 2) NOT NULL CHECK (amount_inr >= 0),

      -- Used for "accurate full-tank to full-tank" mileage computations
      is_full_tank BOOLEAN NOT NULL DEFAULT false,
      notes TEXT,

      entered_by UUID REFERENCES auth.users(id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    ALTER TABLE public.fuel_entries ENABLE ROW LEVEL SECURITY;

    -- Indexes for reporting and fuel-filler pages
    CREATE INDEX idx_fuel_entries_org_car_filled_at ON public.fuel_entries (organization_id, car_id, filled_at DESC);
    CREATE INDEX idx_fuel_entries_org_filled_at ON public.fuel_entries (organization_id, filled_at DESC);

    -- SELECT: active org members can see fuel entries; master admin can see all
    CREATE POLICY "fuel_entries_select_member_or_master"
      ON public.fuel_entries
      FOR SELECT TO authenticated
      USING (
        public.is_master_admin()
        OR public.is_active_member(organization_id)
      );

    -- INSERT: allow admins/managers/supervisors/fuel_filler within the row's organization
    CREATE POLICY "fuel_entries_insert_roles"
      ON public.fuel_entries
      FOR INSERT TO authenticated
      WITH CHECK (
        public.is_master_admin()
        OR (
          organization_id = public.get_my_org_id()
          AND EXISTS (
            SELECT 1
            FROM public.organization_members om
            WHERE om.organization_id = organization_id
              AND om.user_id = auth.uid()
              AND om.status = 'active'
              AND om.role IN ('admin', 'manager', 'supervisor', 'fuel_filler')
          )
        )
      );

    -- UPDATE: restrict edits to admin/manager (master admin always allowed)
    CREATE POLICY "fuel_entries_update_admin_manager"
      ON public.fuel_entries
      FOR UPDATE TO authenticated
      USING (
        public.is_master_admin()
        OR EXISTS (
          SELECT 1
          FROM public.organization_members om
          WHERE om.organization_id = organization_id
            AND om.user_id = auth.uid()
            AND om.status = 'active'
            AND om.role IN ('admin', 'manager')
        )
      )
      WITH CHECK (
        public.is_master_admin()
        OR EXISTS (
          SELECT 1
          FROM public.organization_members om
          WHERE om.organization_id = organization_id
            AND om.user_id = auth.uid()
            AND om.status = 'active'
            AND om.role IN ('admin', 'manager')
        )
      );

    -- DELETE: restrict deletes to admin/manager (master admin always allowed)
    CREATE POLICY "fuel_entries_delete_admin_manager"
      ON public.fuel_entries
      FOR DELETE TO authenticated
      USING (
        public.is_master_admin()
        OR EXISTS (
          SELECT 1
          FROM public.organization_members om
          WHERE om.organization_id = organization_id
            AND om.user_id = auth.uid()
            AND om.status = 'active'
            AND om.role IN ('admin', 'manager')
        )
      );
  END IF;
END $$;

