-- Supervisor project mode with open pool + legacy compatibility.
-- Default mode is "project"; existing direct car assignment remains available via "legacy" mode.

-- 1) Organization setting: supervisor assignment mode
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'organization_settings'
      AND column_name = 'supervisor_assignment_mode'
  ) THEN
    ALTER TABLE public.organization_settings
      ADD COLUMN supervisor_assignment_mode TEXT NOT NULL DEFAULT 'project';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'organization_settings'
      AND constraint_name = 'organization_settings_supervisor_assignment_mode_check'
  ) THEN
    ALTER TABLE public.organization_settings
      ADD CONSTRAINT organization_settings_supervisor_assignment_mode_check
      CHECK (supervisor_assignment_mode IN ('project', 'legacy'));
  END IF;
END $$;

-- 2) Projects and car-pool mapping tables
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'supervisor_projects'
  ) THEN
    CREATE TABLE public.supervisor_projects (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      project_type TEXT NOT NULL CHECK (project_type IN ('open', 'private')),
      supervisor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
      is_active BOOLEAN NOT NULL DEFAULT true,
      created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_supervisor_projects_open_per_org
  ON public.supervisor_projects(organization_id)
  WHERE project_type = 'open' AND is_active = true;

CREATE UNIQUE INDEX IF NOT EXISTS uq_supervisor_projects_private_one_per_supervisor
  ON public.supervisor_projects(organization_id, supervisor_id)
  WHERE project_type = 'private' AND supervisor_id IS NOT NULL AND is_active = true;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'supervisor_project_cars'
  ) THEN
    CREATE TABLE public.supervisor_project_cars (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
      project_id UUID NOT NULL REFERENCES public.supervisor_projects(id) ON DELETE CASCADE,
      car_id UUID NOT NULL REFERENCES public.cars(id) ON DELETE CASCADE,
      moved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
      moved_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      notes TEXT
    );
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_supervisor_project_cars_car_id
  ON public.supervisor_project_cars(car_id);

CREATE INDEX IF NOT EXISTS idx_supervisor_project_cars_org_project
  ON public.supervisor_project_cars(organization_id, project_id);

-- 3) Core helper: ensure open project for an org
CREATE OR REPLACE FUNCTION public.ensure_open_project_for_org(
  p_organization_id UUID,
  p_actor UUID DEFAULT auth.uid()
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_project_id UUID;
BEGIN
  SELECT id
    INTO v_project_id
  FROM public.supervisor_projects
  WHERE organization_id = p_organization_id
    AND project_type = 'open'
    AND is_active = true
  LIMIT 1;

  IF v_project_id IS NULL THEN
    INSERT INTO public.supervisor_projects (
      organization_id, name, project_type, created_by
    )
    VALUES (
      p_organization_id, 'Open Project', 'open', p_actor
    )
    RETURNING id INTO v_project_id;
  END IF;

  RETURN v_project_id;
END;
$$;

-- 4) Backfill open project + place all cars in open if not mapped
DO $$
DECLARE
  v_org RECORD;
  v_open_project_id UUID;
BEGIN
  FOR v_org IN
    SELECT id FROM public.organizations
  LOOP
    v_open_project_id := public.ensure_open_project_for_org(v_org.id, NULL);

    INSERT INTO public.supervisor_project_cars (
      organization_id, project_id, car_id, notes
    )
    SELECT
      c.organization_id,
      v_open_project_id,
      c.id,
      'Backfilled into Open Project'
    FROM public.cars c
    WHERE c.organization_id = v_org.id
      AND NOT EXISTS (
        SELECT 1
        FROM public.supervisor_project_cars spc
        WHERE spc.car_id = c.id
      );
  END LOOP;
END $$;

-- 5) Keep newly created cars in open project by default
CREATE OR REPLACE FUNCTION public.trg_assign_new_car_to_open_project()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_open_project_id UUID;
BEGIN
  v_open_project_id := public.ensure_open_project_for_org(NEW.organization_id, NEW.created_by);

  INSERT INTO public.supervisor_project_cars (
    organization_id, project_id, car_id, moved_by, notes
  )
  VALUES (
    NEW.organization_id, v_open_project_id, NEW.id, NEW.created_by, 'Default to Open Project'
  )
  ON CONFLICT (car_id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_assign_new_car_to_open_project ON public.cars;
CREATE TRIGGER trg_assign_new_car_to_open_project
  AFTER INSERT ON public.cars
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_assign_new_car_to_open_project();

-- 6) RPCs used by frontend
CREATE OR REPLACE FUNCTION public.get_projects_admin_overview()
RETURNS TABLE (
  project_id UUID,
  project_name TEXT,
  project_type TEXT,
  supervisor_id UUID,
  supervisor_name TEXT,
  car_count BIGINT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT
    p.id AS project_id,
    p.name AS project_name,
    p.project_type,
    p.supervisor_id,
    pr.name AS supervisor_name,
    COALESCE(COUNT(spc.id), 0) AS car_count
  FROM public.supervisor_projects p
  LEFT JOIN public.profiles pr
    ON pr.id = p.supervisor_id
  LEFT JOIN public.supervisor_project_cars spc
    ON spc.project_id = p.id
  WHERE p.organization_id = public.get_my_org_id()
    AND p.is_active = true
  GROUP BY p.id, p.name, p.project_type, p.supervisor_id, pr.name
  ORDER BY p.project_type, p.name;
$$;

CREATE OR REPLACE FUNCTION public.get_project_pool_overview()
RETURNS TABLE (
  open_project_id UUID,
  open_project_name TEXT,
  open_supervisor_id UUID,
  open_supervisor_name TEXT,
  my_private_project_id UUID,
  my_private_project_name TEXT,
  car_id UUID,
  vehicle_number TEXT,
  model TEXT,
  brand TEXT,
  car_project_scope TEXT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = 'public'
AS $$
  WITH me AS (
    SELECT auth.uid() AS user_id, public.get_my_org_id() AS org_id
  ),
  open_project AS (
    SELECT p.id, p.name, p.supervisor_id
    FROM public.supervisor_projects p
    JOIN me ON me.org_id = p.organization_id
    WHERE p.project_type = 'open' AND p.is_active = true
    LIMIT 1
  ),
  my_private AS (
    SELECT p.id, p.name
    FROM public.supervisor_projects p
    JOIN me ON me.org_id = p.organization_id
    WHERE p.project_type = 'private'
      AND p.supervisor_id = me.user_id
      AND p.is_active = true
    LIMIT 1
  )
  SELECT
    op.id AS open_project_id,
    op.name AS open_project_name,
    op.supervisor_id AS open_supervisor_id,
    pr.name AS open_supervisor_name,
    mp.id AS my_private_project_id,
    mp.name AS my_private_project_name,
    c.id AS car_id,
    c.vehicle_number,
    c.model,
    c.brand,
    CASE
      WHEN spc.project_id = op.id THEN 'open'
      WHEN spc.project_id = mp.id THEN 'private'
      ELSE 'other'
    END AS car_project_scope
  FROM me
  JOIN open_project op ON true
  LEFT JOIN my_private mp ON true
  LEFT JOIN public.profiles pr ON pr.id = op.supervisor_id
  JOIN public.cars c ON c.organization_id = me.org_id
  LEFT JOIN public.supervisor_project_cars spc ON spc.car_id = c.id
  ORDER BY c.vehicle_number;
$$;

CREATE OR REPLACE FUNCTION public.is_open_project_supervisor()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_org_id UUID;
  v_user_id UUID;
  v_mode TEXT;
  v_is_supervisor BOOLEAN;
BEGIN
  v_org_id := public.get_my_org_id();
  v_user_id := auth.uid();

  IF v_org_id IS NULL OR v_user_id IS NULL THEN
    RETURN false;
  END IF;

  -- Admin/manager always allowed bookings workflows.
  IF EXISTS (
    SELECT 1
    FROM public.organization_members om
    WHERE om.organization_id = v_org_id
      AND om.user_id = v_user_id
      AND om.status = 'active'
      AND om.role IN ('admin', 'manager')
  ) THEN
    RETURN true;
  END IF;

  SELECT COALESCE(os.supervisor_assignment_mode, 'project')
    INTO v_mode
  FROM public.organization_settings os
  WHERE os.organization_id = v_org_id;

  SELECT EXISTS (
    SELECT 1
    FROM public.organization_members om
    WHERE om.organization_id = v_org_id
      AND om.user_id = v_user_id
      AND om.status = 'active'
      AND om.role = 'supervisor'
  )
  INTO v_is_supervisor;

  IF NOT v_is_supervisor THEN
    RETURN false;
  END IF;

  -- Legacy mode keeps current supervisor booking behavior.
  IF v_mode = 'legacy' THEN
    RETURN true;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.supervisor_projects p
    WHERE p.organization_id = v_org_id
      AND p.project_type = 'open'
      AND p.is_active = true
      AND p.supervisor_id = v_user_id
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_my_accessible_car_ids()
RETURNS UUID[]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_org_id UUID;
  v_user_id UUID;
  v_mode TEXT;
  v_is_supervisor_only BOOLEAN;
  v_ids UUID[];
BEGIN
  v_org_id := public.get_my_org_id();
  v_user_id := auth.uid();

  IF v_org_id IS NULL OR v_user_id IS NULL THEN
    RETURN ARRAY[]::UUID[];
  END IF;

  -- Admin/manager: all org cars
  IF EXISTS (
    SELECT 1
    FROM public.organization_members om
    WHERE om.organization_id = v_org_id
      AND om.user_id = v_user_id
      AND om.status = 'active'
      AND om.role IN ('admin', 'manager')
  ) THEN
    SELECT COALESCE(array_agg(c.id), ARRAY[]::UUID[])
      INTO v_ids
    FROM public.cars c
    WHERE c.organization_id = v_org_id;
    RETURN v_ids;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.organization_members om
    WHERE om.organization_id = v_org_id
      AND om.user_id = v_user_id
      AND om.status = 'active'
      AND om.role = 'supervisor'
  )
  INTO v_is_supervisor_only;

  IF NOT v_is_supervisor_only THEN
    RETURN ARRAY[]::UUID[];
  END IF;

  SELECT COALESCE(os.supervisor_assignment_mode, 'project')
    INTO v_mode
  FROM public.organization_settings os
  WHERE os.organization_id = v_org_id;

  IF v_mode = 'legacy' THEN
    SELECT COALESCE(array_agg(ca.car_id), ARRAY[]::UUID[])
      INTO v_ids
    FROM public.car_assignments ca
    WHERE ca.organization_id = v_org_id
      AND ca.supervisor_id = v_user_id;
    RETURN v_ids;
  END IF;

  -- Project mode: cars in project(s) supervised by current user.
  SELECT COALESCE(array_agg(spc.car_id), ARRAY[]::UUID[])
    INTO v_ids
  FROM public.supervisor_project_cars spc
  JOIN public.supervisor_projects p
    ON p.id = spc.project_id
  WHERE p.organization_id = v_org_id
    AND p.is_active = true
    AND p.supervisor_id = v_user_id;

  RETURN v_ids;
END;
$$;

CREATE OR REPLACE FUNCTION public.transfer_car_to_project(
  p_car_id UUID,
  p_target_project_id UUID,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_org_id UUID;
  v_user_id UUID;
  v_mode TEXT;
  v_is_admin_manager BOOLEAN;
  v_is_supervisor BOOLEAN;
  v_target RECORD;
  v_source RECORD;
BEGIN
  v_org_id := public.get_my_org_id();
  v_user_id := auth.uid();

  IF v_org_id IS NULL OR v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  SELECT COALESCE(os.supervisor_assignment_mode, 'project')
    INTO v_mode
  FROM public.organization_settings os
  WHERE os.organization_id = v_org_id;

  IF v_mode = 'legacy' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Project transfers are disabled in legacy mode');
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = v_org_id
      AND om.user_id = v_user_id
      AND om.status = 'active'
      AND om.role IN ('admin', 'manager')
  )
  INTO v_is_admin_manager;

  SELECT EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = v_org_id
      AND om.user_id = v_user_id
      AND om.status = 'active'
      AND om.role = 'supervisor'
  )
  INTO v_is_supervisor;

  IF NOT (v_is_admin_manager OR v_is_supervisor) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient permissions');
  END IF;

  SELECT p.*
    INTO v_target
  FROM public.supervisor_projects p
  WHERE p.id = p_target_project_id
    AND p.organization_id = v_org_id
    AND p.is_active = true
  LIMIT 1;

  IF v_target.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Target project not found');
  END IF;

  SELECT p.*
    INTO v_source
  FROM public.supervisor_project_cars spc
  JOIN public.supervisor_projects p ON p.id = spc.project_id
  WHERE spc.car_id = p_car_id
    AND spc.organization_id = v_org_id
  LIMIT 1;

  IF v_source.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Car is not mapped to any project');
  END IF;

  -- Supervisor permissions:
  -- - Open -> own private
  -- - Own private -> Open
  IF v_is_supervisor AND NOT v_is_admin_manager THEN
    IF v_source.project_type = 'open'
       AND v_target.project_type = 'private'
       AND v_target.supervisor_id = v_user_id THEN
      NULL;
    ELSIF v_source.project_type = 'private'
       AND v_source.supervisor_id = v_user_id
       AND v_target.project_type = 'open' THEN
      NULL;
    ELSE
      RETURN jsonb_build_object('success', false, 'error', 'Supervisor can only move open<->own project');
    END IF;
  END IF;

  UPDATE public.supervisor_project_cars
  SET project_id = v_target.id,
      moved_by = v_user_id,
      moved_at = now(),
      notes = p_notes
  WHERE car_id = p_car_id
    AND organization_id = v_org_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.set_open_project_supervisor(
  p_supervisor_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_org_id UUID;
  v_user_id UUID;
  v_open_project_id UUID;
BEGIN
  v_org_id := public.get_my_org_id();
  v_user_id := auth.uid();

  IF v_org_id IS NULL OR v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = v_org_id
      AND om.user_id = v_user_id
      AND om.status = 'active'
      AND om.role IN ('admin', 'manager')
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only admin/manager can set open supervisor');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = v_org_id
      AND om.user_id = p_supervisor_id
      AND om.status = 'active'
      AND om.role = 'supervisor'
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Target user is not an active supervisor');
  END IF;

  v_open_project_id := public.ensure_open_project_for_org(v_org_id, v_user_id);

  UPDATE public.supervisor_projects
  SET supervisor_id = p_supervisor_id,
      updated_at = now()
  WHERE id = v_open_project_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.ensure_private_project_for_supervisor(
  p_supervisor_id UUID,
  p_name TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_org_id UUID;
  v_user_id UUID;
  v_supervisor_name TEXT;
  v_project_id UUID;
  v_final_name TEXT;
BEGIN
  v_org_id := public.get_my_org_id();
  v_user_id := auth.uid();

  IF v_org_id IS NULL OR v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = v_org_id
      AND om.user_id = v_user_id
      AND om.status = 'active'
      AND om.role IN ('admin', 'manager')
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only admin/manager can manage private projects');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = v_org_id
      AND om.user_id = p_supervisor_id
      AND om.status = 'active'
      AND om.role = 'supervisor'
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Target user is not an active supervisor');
  END IF;

  SELECT COALESCE(NULLIF(trim(p_name), ''), pr.name || ' Project', 'Supervisor Project')
    INTO v_final_name
  FROM public.profiles pr
  WHERE pr.id = p_supervisor_id;

  SELECT id INTO v_project_id
  FROM public.supervisor_projects
  WHERE organization_id = v_org_id
    AND project_type = 'private'
    AND supervisor_id = p_supervisor_id
    AND is_active = true
  LIMIT 1;

  IF v_project_id IS NULL THEN
    INSERT INTO public.supervisor_projects (
      organization_id, name, project_type, supervisor_id, created_by
    )
    VALUES (
      v_org_id, v_final_name, 'private', p_supervisor_id, v_user_id
    )
    RETURNING id INTO v_project_id;
  ELSE
    UPDATE public.supervisor_projects
    SET name = v_final_name,
        updated_at = now()
    WHERE id = v_project_id;
  END IF;

  RETURN jsonb_build_object('success', true, 'project_id', v_project_id);
END;
$$;

-- 7) Enable RLS and policies
ALTER TABLE public.supervisor_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supervisor_project_cars ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  p RECORD;
BEGIN
  FOR p IN (
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'supervisor_projects'
  ) LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.supervisor_projects', p.policyname);
  END LOOP;
END $$;

DO $$
DECLARE
  p RECORD;
BEGIN
  FOR p IN (
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'supervisor_project_cars'
  ) LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.supervisor_project_cars', p.policyname);
  END LOOP;
END $$;

CREATE POLICY "supervisor_projects_select_member_or_master"
  ON public.supervisor_projects
  FOR SELECT TO authenticated
  USING (
    public.is_master_admin()
    OR public.is_active_member(organization_id)
  );

CREATE POLICY "supervisor_projects_write_project_roles"
  ON public.supervisor_projects
  FOR ALL TO authenticated
  USING (
    public.is_master_admin()
    OR EXISTS (
      SELECT 1
      FROM public.organization_members om
      WHERE om.organization_id = organization_id
        AND om.user_id = auth.uid()
        AND om.status = 'active'
        AND om.role IN ('admin', 'manager', 'supervisor')
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
        AND om.role IN ('admin', 'manager', 'supervisor')
    )
  );

CREATE POLICY "supervisor_project_cars_select_member_or_master"
  ON public.supervisor_project_cars
  FOR SELECT TO authenticated
  USING (
    public.is_master_admin()
    OR public.is_active_member(organization_id)
  );

CREATE POLICY "supervisor_project_cars_write_project_roles"
  ON public.supervisor_project_cars
  FOR ALL TO authenticated
  USING (
    public.is_master_admin()
    OR EXISTS (
      SELECT 1
      FROM public.organization_members om
      WHERE om.organization_id = organization_id
        AND om.user_id = auth.uid()
        AND om.status = 'active'
        AND om.role IN ('admin', 'manager', 'supervisor')
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
        AND om.role IN ('admin', 'manager', 'supervisor')
    )
  );

