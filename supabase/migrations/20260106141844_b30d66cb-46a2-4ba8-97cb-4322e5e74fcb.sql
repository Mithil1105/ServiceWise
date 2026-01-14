-- Add estimated uptime date to downtime_logs
ALTER TABLE public.downtime_logs
ADD COLUMN estimated_uptime_at timestamp with time zone NULL;