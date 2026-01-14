-- Add supervisor to the app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'supervisor';

-- Create car_assignments table to track which cars are assigned to which supervisors
CREATE TABLE public.car_assignments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  car_id UUID NOT NULL REFERENCES public.cars(id) ON DELETE CASCADE,
  supervisor_id UUID NOT NULL,
  assigned_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  assigned_by UUID,
  notes TEXT,
  UNIQUE(car_id, supervisor_id)
);

-- Enable RLS
ALTER TABLE public.car_assignments ENABLE ROW LEVEL SECURITY;

-- Policies for car_assignments
-- Admins can do everything
CREATE POLICY "Admin can manage all car assignments"
ON public.car_assignments
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Managers can view assignments
CREATE POLICY "Manager can view car assignments"
ON public.car_assignments
FOR SELECT
USING (has_role(auth.uid(), 'manager'::app_role));

-- Supervisors can only view their own assignments
CREATE POLICY "Supervisors can view their own assignments"
ON public.car_assignments
FOR SELECT
USING (supervisor_id = auth.uid());

-- Create index for faster lookups
CREATE INDEX idx_car_assignments_supervisor ON public.car_assignments(supervisor_id);
CREATE INDEX idx_car_assignments_car ON public.car_assignments(car_id);