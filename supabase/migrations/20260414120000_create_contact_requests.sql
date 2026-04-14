-- Public "Contact Us / Request Demo" submissions for master admin follow-up.
-- Allows anonymous inserts from marketing contact form and master-admin-only reads.

CREATE TABLE IF NOT EXISTS public.contact_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name TEXT NOT NULL,
  fleet_size TEXT,
  city TEXT,
  contact_person TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT NOT NULL,
  message TEXT,
  status TEXT NOT NULL DEFAULT 'new',
  source_page TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contact_requests_created_at
  ON public.contact_requests (created_at DESC);

ALTER TABLE public.contact_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "contact_requests_insert_public" ON public.contact_requests;
CREATE POLICY "contact_requests_insert_public"
  ON public.contact_requests
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "contact_requests_select_master_admin" ON public.contact_requests;
CREATE POLICY "contact_requests_select_master_admin"
  ON public.contact_requests
  FOR SELECT
  TO authenticated
  USING (public.is_master_admin());
