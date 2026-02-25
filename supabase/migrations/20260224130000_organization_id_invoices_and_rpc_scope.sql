-- Ensure organization_id is assigned everywhere for multi-tenant scaling.
-- 1) Add organization_id to invoices (table was never in Phase 1 list)
-- 2) Scope check_available_cars to current user's org
-- 3) Scope assign_car_to_booking: verify booking and car belong to current org; fix audit log insert

-- ========== 1) INVOICES: add organization_id ==========
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'invoices') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'invoices' AND column_name = 'organization_id') THEN
      ALTER TABLE public.invoices
        ADD COLUMN organization_id UUID NULL REFERENCES public.organizations(id);
      -- Backfill from booking
      UPDATE public.invoices i
      SET organization_id = b.organization_id
      FROM public.bookings b
      WHERE i.booking_id = b.id AND i.organization_id IS NULL;
      ALTER TABLE public.invoices ALTER COLUMN organization_id SET NOT NULL;
      CREATE INDEX IF NOT EXISTS idx_invoices_organization_id ON public.invoices(organization_id);
      COMMENT ON COLUMN public.invoices.organization_id IS 'Tenant: organization that owns this invoice (via booking)';
    END IF;
  END IF;
END $$;

-- RLS for invoices (table was not in Phase 2 list)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'invoices') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'invoices' AND column_name = 'organization_id') THEN
      NULL; -- skip policies if column not added
    ELSE
      ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
      DROP POLICY IF EXISTS "tenant_select" ON public.invoices;
      CREATE POLICY "tenant_select" ON public.invoices FOR SELECT TO authenticated
        USING (organization_id = public.get_my_org_id());
      DROP POLICY IF EXISTS "tenant_insert" ON public.invoices;
      CREATE POLICY "tenant_insert" ON public.invoices FOR INSERT TO authenticated
        WITH CHECK (organization_id = public.get_my_org_id());
      DROP POLICY IF EXISTS "tenant_update" ON public.invoices;
      CREATE POLICY "tenant_update" ON public.invoices FOR UPDATE TO authenticated
        USING (organization_id = public.get_my_org_id())
        WITH CHECK (organization_id = public.get_my_org_id());
      DROP POLICY IF EXISTS "tenant_delete" ON public.invoices;
      CREATE POLICY "tenant_delete" ON public.invoices FOR DELETE TO authenticated
        USING (organization_id = public.get_my_org_id());
    END IF;
  END IF;
END $$;

-- ========== 2) check_available_cars: scope by current org ==========
DROP FUNCTION IF EXISTS public.check_available_cars(timestamp with time zone, timestamp with time zone, integer, uuid);

CREATE OR REPLACE FUNCTION public.check_available_cars(
  p_start_at timestamp with time zone,
  p_end_at timestamp with time zone,
  p_buffer_minutes integer DEFAULT 60,
  p_exclude_booking_id uuid DEFAULT NULL::uuid
)
RETURNS TABLE(
  car_id uuid,
  vehicle_number text,
  model text,
  seats integer,
  vehicle_class text,
  is_available boolean,
  conflict_booking_ref text,
  conflict_start timestamp with time zone,
  conflict_end timestamp with time zone,
  conflict_booked_by text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  WITH my_org AS (
    SELECT public.get_my_org_id() AS id
  ),
  active_cars AS (
    SELECT c.id, c.vehicle_number, c.model, COALESCE(c.seats, 5) AS seats,
           COALESCE(c.vehicle_class, 'lmv')::text AS vehicle_class
    FROM cars c
    CROSS JOIN my_org o
    WHERE c.status = 'active'
      AND o.id IS NOT NULL
      AND c.organization_id = o.id
  ),
  cars_in_downtime AS (
    SELECT DISTINCT dl.car_id
    FROM downtime_logs dl
    WHERE dl.started_at <= p_end_at
      AND (dl.ended_at IS NULL OR dl.ended_at >= p_start_at)
  ),
  conflicting_bookings AS (
    SELECT
      bv.car_id,
      b.booking_ref,
      b.start_at,
      b.end_at,
      p.name AS booked_by_name
    FROM booking_vehicles bv
    JOIN bookings b ON bv.booking_id = b.id
    LEFT JOIN profiles p ON b.created_by = p.id
    WHERE b.status IN ('inquiry', 'tentative', 'confirmed', 'ongoing')
      AND (p_exclude_booking_id IS NULL OR b.id != p_exclude_booking_id)
      AND (p_start_at < (b.end_at + (p_buffer_minutes || ' minutes')::INTERVAL))
      AND (p_end_at > (b.start_at - (p_buffer_minutes || ' minutes')::INTERVAL))
  )
  SELECT
    ac.id AS car_id,
    ac.vehicle_number,
    ac.model,
    ac.seats,
    ac.vehicle_class,
    (cid.car_id IS NULL AND cb.car_id IS NULL) AS is_available,
    cb.booking_ref AS conflict_booking_ref,
    cb.start_at AS conflict_start,
    cb.end_at AS conflict_end,
    cb.booked_by_name AS conflict_booked_by
  FROM active_cars ac
  LEFT JOIN cars_in_downtime cid ON ac.id = cid.car_id
  LEFT JOIN conflicting_bookings cb ON ac.id = cb.car_id
  WHERE cid.car_id IS NULL
  ORDER BY (cb.car_id IS NULL) DESC, ac.vehicle_number;
END;
$function$;

-- ========== 3) assign_car_to_booking: verify org + fix audit log organization_id ==========
CREATE OR REPLACE FUNCTION public.assign_car_to_booking(
  p_booking_id UUID,
  p_car_id UUID,
  p_driver_name TEXT DEFAULT NULL,
  p_driver_phone TEXT DEFAULT NULL,
  p_rate_type public.rate_type DEFAULT 'total',
  p_rate_total NUMERIC DEFAULT NULL,
  p_rate_per_day NUMERIC DEFAULT NULL,
  p_rate_per_km NUMERIC DEFAULT NULL,
  p_estimated_km NUMERIC DEFAULT NULL,
  p_advance_amount NUMERIC DEFAULT 0,
  p_buffer_minutes INTEGER DEFAULT 60,
  p_requested_vehicle_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_booking RECORD;
  v_car RECORD;
  v_conflict RECORD;
  v_computed_total NUMERIC;
  v_days INTEGER;
  v_vehicle_id UUID;
  v_my_org_id UUID;
BEGIN
  v_my_org_id := public.get_my_org_id();
  IF v_my_org_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Organization not found');
  END IF;

  SELECT * INTO v_booking FROM bookings WHERE id = p_booking_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Booking not found');
  END IF;
  IF v_booking.organization_id IS DISTINCT FROM v_my_org_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Booking does not belong to your organization');
  END IF;

  SELECT * INTO v_car FROM cars WHERE id = p_car_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Car not found');
  END IF;
  IF v_car.organization_id IS DISTINCT FROM v_my_org_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Car does not belong to your organization');
  END IF;

  IF v_car.status != 'active' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Car is not active');
  END IF;

  IF EXISTS (
    SELECT 1 FROM downtime_logs dl
    WHERE dl.car_id = p_car_id
      AND dl.started_at <= v_booking.end_at
      AND (dl.ended_at IS NULL OR dl.ended_at >= v_booking.start_at)
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Car is currently in downtime');
  END IF;

  SELECT
    b.booking_ref,
    b.start_at,
    b.end_at,
    p.name AS booked_by
  INTO v_conflict
  FROM booking_vehicles bv
  JOIN bookings b ON bv.booking_id = b.id
  LEFT JOIN profiles p ON b.created_by = p.id
  WHERE bv.car_id = p_car_id
    AND b.id != p_booking_id
    AND b.status IN ('inquiry', 'tentative', 'confirmed', 'ongoing')
    AND (v_booking.start_at < (b.end_at + (p_buffer_minutes || ' minutes')::INTERVAL))
    AND (v_booking.end_at > (b.start_at - (p_buffer_minutes || ' minutes')::INTERVAL))
  LIMIT 1;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', format('Car already booked from %s to %s (Booking Ref: %s, Booked by: %s)',
        to_char(v_conflict.start_at AT TIME ZONE 'Asia/Kolkata', 'DD Mon YYYY HH24:MI'),
        to_char(v_conflict.end_at AT TIME ZONE 'Asia/Kolkata', 'DD Mon YYYY HH24:MI'),
        v_conflict.booking_ref,
        COALESCE(v_conflict.booked_by, 'Unknown')
      )
    );
  END IF;

  v_days := CEIL(EXTRACT(EPOCH FROM (v_booking.end_at - v_booking.start_at)) / 86400);
  IF v_days < 1 THEN v_days := 1; END IF;

  CASE p_rate_type
    WHEN 'total' THEN
      v_computed_total := p_rate_total;
    WHEN 'per_day' THEN
      v_computed_total := v_days * COALESCE(p_rate_per_day, 0);
    WHEN 'per_km' THEN
      v_computed_total := COALESCE(p_rate_per_km, 0) * COALESCE(p_estimated_km, 0);
    WHEN 'hybrid' THEN
      v_computed_total := (v_days * COALESCE(p_rate_per_day, 0)) + (COALESCE(p_rate_per_km, 0) * COALESCE(p_estimated_km, 0));
    ELSE
      v_computed_total := 0;
  END CASE;

  INSERT INTO booking_vehicles (
    organization_id, booking_id, car_id, driver_name, driver_phone,
    rate_type, rate_total, rate_per_day, rate_per_km, estimated_km,
    computed_total, advance_amount, requested_vehicle_id, created_by, updated_by
  )
  VALUES (
    v_booking.organization_id, p_booking_id, p_car_id, p_driver_name, p_driver_phone,
    p_rate_type, p_rate_total, p_rate_per_day, p_rate_per_km, p_estimated_km,
    v_computed_total, p_advance_amount, p_requested_vehicle_id, auth.uid(), auth.uid()
  )
  ON CONFLICT (booking_id, car_id) DO UPDATE SET
    driver_name = EXCLUDED.driver_name,
    driver_phone = EXCLUDED.driver_phone,
    rate_type = EXCLUDED.rate_type,
    rate_total = EXCLUDED.rate_total,
    rate_per_day = EXCLUDED.rate_per_day,
    rate_per_km = EXCLUDED.rate_per_km,
    estimated_km = EXCLUDED.estimated_km,
    computed_total = EXCLUDED.computed_total,
    advance_amount = EXCLUDED.advance_amount,
    requested_vehicle_id = EXCLUDED.requested_vehicle_id,
    updated_by = auth.uid(),
    updated_at = now()
  RETURNING id INTO v_vehicle_id;

  INSERT INTO booking_audit_log (organization_id, booking_id, action, after, actor_id)
  VALUES (
    v_booking.organization_id,
    p_booking_id,
    'vehicle_assigned',
    jsonb_build_object('car_id', p_car_id, 'vehicle_number', v_car.vehicle_number),
    auth.uid()
  );

  RETURN jsonb_build_object(
    'success', true,
    'vehicle_id', v_vehicle_id,
    'computed_total', v_computed_total
  );
END;
$$;
