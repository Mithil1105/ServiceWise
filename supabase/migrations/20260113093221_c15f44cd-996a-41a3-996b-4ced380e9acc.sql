-- Add estimated_return_at to incidents table
ALTER TABLE public.incidents 
ADD COLUMN IF NOT EXISTS estimated_return_at TIMESTAMP WITH TIME ZONE;

-- Create index for downtime-related queries
CREATE INDEX IF NOT EXISTS idx_incidents_unresolved_car 
ON public.incidents(car_id) WHERE resolved = false;