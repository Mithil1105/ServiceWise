-- Create supervisor activity log table
CREATE TABLE public.supervisor_activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supervisor_id UUID NOT NULL,
  car_id UUID REFERENCES public.cars(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL,
  action_details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.supervisor_activity_log ENABLE ROW LEVEL SECURITY;

-- Admin and Manager can view all activity logs
CREATE POLICY "Admin and Manager can view all activity logs"
ON public.supervisor_activity_log
FOR SELECT
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));

-- Supervisors can view their own activity logs
CREATE POLICY "Supervisors can view own activity logs"
ON public.supervisor_activity_log
FOR SELECT
USING (supervisor_id = auth.uid());

-- Allow inserts from authenticated users (for logging their own actions)
CREATE POLICY "Authenticated users can insert activity logs"
ON public.supervisor_activity_log
FOR INSERT
WITH CHECK (supervisor_id = auth.uid());

-- Create index for faster queries
CREATE INDEX idx_supervisor_activity_log_supervisor ON public.supervisor_activity_log(supervisor_id);
CREATE INDEX idx_supervisor_activity_log_car ON public.supervisor_activity_log(car_id);
CREATE INDEX idx_supervisor_activity_log_created ON public.supervisor_activity_log(created_at DESC);