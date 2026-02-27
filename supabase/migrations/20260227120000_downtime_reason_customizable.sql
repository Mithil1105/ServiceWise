-- Allow custom downtime reason values (no longer restrict to service/breakdown/accident/other).
-- Org-defined reason options are stored in organization_settings.downtime_form_config.reasonOptions.

ALTER TABLE public.downtime_logs
  DROP CONSTRAINT IF EXISTS downtime_logs_reason_check;

-- reason remains NOT NULL; any non-empty text is allowed
COMMENT ON COLUMN public.downtime_logs.reason IS 'Reason for downtime; value comes from org downtime_form_config.reasonOptions or legacy: service, breakdown, accident, other';
