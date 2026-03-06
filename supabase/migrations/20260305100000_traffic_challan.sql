-- Traffic challan: allow incident type, challan_types + traffic_challans tables, RPC get_driver_for_car_at_time

-- 1) Incidents: allow type 'traffic_challan'
ALTER TABLE public.incidents DROP CONSTRAINT IF EXISTS incidents_type_check;
ALTER TABLE public.incidents
  ADD CONSTRAINT incidents_type_check
  CHECK (type IN ('breakdown', 'overheating', 'puncture', 'towing', 'accident', 'other', 'traffic_challan'));

-- 2) challan_types
CREATE TABLE IF NOT EXISTS public.challan_types (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_challan_types_organization_id ON public.challan_types(organization_id);
ALTER TABLE public.challan_types ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "challan_types_tenant_select" ON public.challan_types;
CREATE POLICY "challan_types_tenant_select" ON public.challan_types FOR SELECT TO authenticated
  USING (public.is_master_admin() OR public.is_active_member(organization_id));
DROP POLICY IF EXISTS "challan_types_tenant_insert" ON public.challan_types;
CREATE POLICY "challan_types_tenant_insert" ON public.challan_types FOR INSERT TO authenticated
  WITH CHECK (public.is_master_admin() OR (organization_id IS NOT NULL AND public.is_active_member(organization_id)));
DROP POLICY IF EXISTS "challan_types_tenant_update" ON public.challan_types;
CREATE POLICY "challan_types_tenant_update" ON public.challan_types FOR UPDATE TO authenticated
  USING (public.is_master_admin() OR public.is_active_member(organization_id))
  WITH CHECK (public.is_master_admin() OR public.is_active_member(organization_id));
DROP POLICY IF EXISTS "challan_types_tenant_delete" ON public.challan_types;
CREATE POLICY "challan_types_tenant_delete" ON public.challan_types FOR DELETE TO authenticated
  USING (public.is_master_admin() OR public.is_active_member(organization_id));

-- 3) traffic_challans
CREATE TABLE IF NOT EXISTS public.traffic_challans (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  incident_id uuid REFERENCES public.incidents(id) ON DELETE SET NULL,
  car_id uuid NOT NULL REFERENCES public.cars(id) ON DELETE CASCADE,
  driver_name text,
  driver_phone text,
  challan_type_id uuid REFERENCES public.challan_types(id) ON DELETE SET NULL,
  amount numeric NOT NULL DEFAULT 0,
  incident_at timestamptz NOT NULL DEFAULT now(),
  location text,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_traffic_challans_organization_id ON public.traffic_challans(organization_id);
CREATE INDEX IF NOT EXISTS idx_traffic_challans_incident_id ON public.traffic_challans(incident_id);
CREATE INDEX IF NOT EXISTS idx_traffic_challans_car_id ON public.traffic_challans(car_id);
CREATE INDEX IF NOT EXISTS idx_traffic_challans_driver_phone ON public.traffic_challans(driver_phone);
CREATE INDEX IF NOT EXISTS idx_traffic_challans_incident_at ON public.traffic_challans(incident_at);

ALTER TABLE public.traffic_challans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "traffic_challans_tenant_select" ON public.traffic_challans;
CREATE POLICY "traffic_challans_tenant_select" ON public.traffic_challans FOR SELECT TO authenticated
  USING (public.is_master_admin() OR public.is_active_member(organization_id));
DROP POLICY IF EXISTS "traffic_challans_tenant_insert" ON public.traffic_challans;
CREATE POLICY "traffic_challans_tenant_insert" ON public.traffic_challans FOR INSERT TO authenticated
  WITH CHECK (public.is_master_admin() OR (organization_id IS NOT NULL AND public.is_active_member(organization_id)));
DROP POLICY IF EXISTS "traffic_challans_tenant_update" ON public.traffic_challans;
CREATE POLICY "traffic_challans_tenant_update" ON public.traffic_challans FOR UPDATE TO authenticated
  USING (public.is_master_admin() OR public.is_active_member(organization_id))
  WITH CHECK (public.is_master_admin() OR public.is_active_member(organization_id));
DROP POLICY IF EXISTS "traffic_challans_tenant_delete" ON public.traffic_challans;
CREATE POLICY "traffic_challans_tenant_delete" ON public.traffic_challans FOR DELETE TO authenticated
  USING (public.is_master_admin() OR public.is_active_member(organization_id));

-- 4) RPC: get driver for car at time (from booking_vehicles where booking covers p_at)
CREATE OR REPLACE FUNCTION public.get_driver_for_car_at_time(p_car_id uuid, p_at timestamptz)
RETURNS TABLE (driver_name text, driver_phone text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT bv.driver_name::text, bv.driver_phone::text
  FROM booking_vehicles bv
  JOIN bookings b ON b.id = bv.booking_id
  WHERE bv.car_id = p_car_id
    AND b.start_at <= p_at
    AND b.end_at >= p_at
    AND b.status IN ('confirmed', 'ongoing')
  ORDER BY b.end_at DESC
  LIMIT 1;
END;
$$;

COMMENT ON FUNCTION public.get_driver_for_car_at_time(uuid, timestamptz) IS 'Returns driver_name and driver_phone for the booking that had the given car at the given time.';

NOTIFY pgrst, 'reload schema';
