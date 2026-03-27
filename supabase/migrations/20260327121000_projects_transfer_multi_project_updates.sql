-- Require explicit private project names and support multi-project supervisor transfers.

CREATE OR REPLACE FUNCTION public.get_project_pool_overview()
RETURNS TABLE (
  open_project_id UUID,
  open_project_name TEXT,
  open_supervisor_id UUID,
  open_supervisor_name TEXT,
  my_project_ids UUID[],
  my_project_names TEXT[],
  car_id UUID,
  vehicle_number TEXT,
  model TEXT,
  brand TEXT,
  car_project_id UUID,
  car_project_name TEXT,
  car_project_type TEXT,
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
  my_private_projects AS (
    SELECT p.id, p.name
    FROM public.supervisor_projects p
    JOIN me ON me.org_id = p.organization_id
    WHERE p.project_type = 'private'
      AND p.supervisor_id = me.user_id
      AND p.is_active = true
    ORDER BY p.name
  ),
  my_private_agg AS (
    SELECT
      COALESCE(array_agg(mpp.id), ARRAY[]::UUID[]) AS ids,
      COALESCE(array_agg(mpp.name), ARRAY[]::TEXT[]) AS names
    FROM my_private_projects mpp
  )
  SELECT
    op.id AS open_project_id,
    op.name AS open_project_name,
    op.supervisor_id AS open_supervisor_id,
    pr.name AS open_supervisor_name,
    mpa.ids AS my_project_ids,
    mpa.names AS my_project_names,
    c.id AS car_id,
    c.vehicle_number,
    c.model,
    c.brand,
    sp.id AS car_project_id,
    sp.name AS car_project_name,
    sp.project_type AS car_project_type,
    CASE
      WHEN sp.id = op.id THEN 'open'
      WHEN sp.project_type = 'private' AND sp.supervisor_id = me.user_id THEN 'mine_private'
      ELSE 'other'
    END AS car_project_scope
  FROM me
  JOIN open_project op ON true
  LEFT JOIN public.profiles pr ON pr.id = op.supervisor_id
  CROSS JOIN my_private_agg mpa
  JOIN public.cars c ON c.organization_id = me.org_id
  LEFT JOIN public.supervisor_project_cars spc ON spc.car_id = c.id
  LEFT JOIN public.supervisor_projects sp
    ON sp.id = spc.project_id
   AND sp.organization_id = me.org_id
   AND sp.is_active = true
  ORDER BY c.vehicle_number;
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
  -- - Open <-> own private project(s)
  -- - Own private <-> own private projects
  IF v_is_supervisor AND NOT v_is_admin_manager THEN
    IF v_source.project_type = 'open'
       AND v_target.project_type = 'private'
       AND v_target.supervisor_id = v_user_id THEN
      NULL;
    ELSIF v_source.project_type = 'private'
       AND v_source.supervisor_id = v_user_id
       AND v_target.project_type = 'open' THEN
      NULL;
    ELSIF v_source.project_type = 'private'
       AND v_source.supervisor_id = v_user_id
       AND v_target.project_type = 'private'
       AND v_target.supervisor_id = v_user_id THEN
      NULL;
    ELSE
      RETURN jsonb_build_object('success', false, 'error', 'Supervisor can only move within own projects and open project');
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

  v_final_name := NULLIF(trim(p_name), '');
  IF v_final_name IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Project name is required');
  END IF;

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
