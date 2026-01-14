
-- Add driver_name column to incidents table to track troublesome drivers
ALTER TABLE public.incidents 
ADD COLUMN driver_name text;

-- Add comment for clarity
COMMENT ON COLUMN public.incidents.driver_name IS 'Name of the driver involved in the incident';
