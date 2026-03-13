-- Allow supervisors to upload/update (and where applicable delete) in all storage buckets.
-- Fixes RLS 400 errors when uploading service bills or other files from supervisor account.

-- Helper: true if current user has any of admin, manager, or supervisor in user_roles (org-scoped).
CREATE OR REPLACE FUNCTION public.storage_can_upload()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role::text IN ('admin', 'manager', 'supervisor')
  );
$$;

-- ========== service-bills ==========
DROP POLICY IF EXISTS "Admin and Manager can upload bills" ON storage.objects;
DROP POLICY IF EXISTS "Admin and Manager can update bills" ON storage.objects;
DROP POLICY IF EXISTS "Admin can delete bills" ON storage.objects;

-- Recreate with supervisor included (policy names kept distinct for service-bills bucket)
CREATE POLICY "service_bills_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'service-bills'
    AND public.storage_can_upload()
  );

CREATE POLICY "service_bills_update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'service-bills'
    AND public.storage_can_upload()
  );

CREATE POLICY "service_bills_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'service-bills'
    AND public.storage_can_upload()
  );

-- ========== driver-licenses ==========
DROP POLICY IF EXISTS "Admin and Manager can upload driver licenses" ON storage.objects;
DROP POLICY IF EXISTS "Admin and Manager can delete driver licenses" ON storage.objects;

CREATE POLICY "driver_licenses_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'driver-licenses'
    AND public.storage_can_upload()
  );

CREATE POLICY "driver_licenses_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'driver-licenses'
    AND public.storage_can_upload()
  );

-- ========== car-documents ==========
DROP POLICY IF EXISTS "Admin and Manager can upload car documents" ON storage.objects;
DROP POLICY IF EXISTS "Admin and Manager can delete car documents" ON storage.objects;

CREATE POLICY "car_documents_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'car-documents'
    AND public.storage_can_upload()
  );

CREATE POLICY "car_documents_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'car-documents'
    AND public.storage_can_upload()
  );

-- ========== bills (invoice PDFs) ==========
DROP POLICY IF EXISTS "Authenticated users can upload bills" ON storage.objects;
DROP POLICY IF EXISTS "Admin and Manager can delete bills" ON storage.objects;

CREATE POLICY "bills_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'bills'
    AND public.storage_can_upload()
  );

CREATE POLICY "bills_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'bills'
    AND public.storage_can_upload()
  );

-- Note: SELECT policies for these buckets are unchanged (authenticated can view).
-- organization-logos stays admin/manager only unless you add a separate change.
