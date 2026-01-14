-- Downtime logs table for tracking car unavailability
CREATE TABLE public.downtime_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  car_id uuid NOT NULL REFERENCES public.cars(id) ON DELETE CASCADE,
  started_at timestamp with time zone NOT NULL DEFAULT now(),
  ended_at timestamp with time zone,
  reason text NOT NULL CHECK (reason IN ('service', 'breakdown', 'accident', 'other')),
  notes text,
  source text NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'system')),
  created_by uuid REFERENCES auth.users(id),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Incidents table for breakdowns and issues
CREATE TABLE public.incidents (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  car_id uuid NOT NULL REFERENCES public.cars(id) ON DELETE CASCADE,
  incident_at timestamp with time zone NOT NULL DEFAULT now(),
  type text NOT NULL CHECK (type IN ('breakdown', 'overheating', 'puncture', 'towing', 'accident', 'other')),
  severity text NOT NULL DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high')),
  description text,
  location text,
  cost numeric,
  resolved boolean NOT NULL DEFAULT false,
  resolved_at timestamp with time zone,
  resolved_notes text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Car notes table
CREATE TABLE public.car_notes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  car_id uuid NOT NULL REFERENCES public.cars(id) ON DELETE CASCADE,
  note text NOT NULL,
  pinned boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- System config table for thresholds
CREATE TABLE public.system_config (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  key text NOT NULL UNIQUE,
  value jsonb NOT NULL,
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Insert default config values
INSERT INTO public.system_config (key, value) VALUES
  ('suspicious_odometer_jump_km', '8000'),
  ('stale_odometer_days', '10'),
  ('high_maintenance_cost_threshold', '40000'),
  ('high_maintenance_downtime_days', '7'),
  ('high_maintenance_incident_count', '3');

-- Enable RLS on all new tables
ALTER TABLE public.downtime_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.car_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_config ENABLE ROW LEVEL SECURITY;

-- Downtime logs policies
CREATE POLICY "Authenticated users can view downtime logs"
ON public.downtime_logs FOR SELECT
USING (true);

CREATE POLICY "Admin and Manager can insert downtime logs"
ON public.downtime_logs FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "Admin and Manager can update downtime logs"
ON public.downtime_logs FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

-- Incidents policies
CREATE POLICY "Authenticated users can view incidents"
ON public.incidents FOR SELECT
USING (true);

CREATE POLICY "Admin and Manager can insert incidents"
ON public.incidents FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "Admin and Manager can update incidents"
ON public.incidents FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

-- Car notes policies
CREATE POLICY "Authenticated users can view car notes"
ON public.car_notes FOR SELECT
USING (true);

CREATE POLICY "Admin and Manager can insert car notes"
ON public.car_notes FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "Admin can delete any notes, creators can delete own"
ON public.car_notes FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role) OR created_by = auth.uid());

-- System config policies (read-only for all, admin can update)
CREATE POLICY "Authenticated users can view system config"
ON public.system_config FOR SELECT
USING (true);

CREATE POLICY "Only Admin can update system config"
ON public.system_config FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));