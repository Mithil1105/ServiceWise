-- Migration 0009: Add storage bucket for bills and payment reminder tracking

-- Create storage bucket for bills (if it doesn't exist)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM storage.buckets WHERE name = 'bills'
  ) THEN
    INSERT INTO storage.buckets (id, name, public)
    VALUES ('bills', 'bills', false);
  END IF;
END $$;

-- Storage policies for bills bucket
DO $$
BEGIN
  -- Allow authenticated users to view bills
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Authenticated users can view bills'
  ) THEN
    CREATE POLICY "Authenticated users can view bills"
    ON storage.objects FOR SELECT
    TO authenticated
    USING (bucket_id = 'bills');
  END IF;

  -- Allow admin and manager to upload bills
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Admin and Manager can upload bills'
  ) THEN
    CREATE POLICY "Admin and Manager can upload bills"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (
      bucket_id = 'bills' AND
      EXISTS (
        SELECT 1 FROM public.user_roles 
        WHERE user_id = auth.uid() 
        AND role::text IN ('admin', 'manager')
      )
    );
  END IF;

  -- Allow admin and manager to update bills
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Admin and Manager can update bills'
  ) THEN
    CREATE POLICY "Admin and Manager can update bills"
    ON storage.objects FOR UPDATE
    TO authenticated
    USING (
      bucket_id = 'bills' AND
      EXISTS (
        SELECT 1 FROM public.user_roles 
        WHERE user_id = auth.uid() 
        AND role::text IN ('admin', 'manager')
      )
    );
  END IF;
END $$;

-- Add payment_reminder_sent_at column to bills table for tracking reminders
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'bills') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'bills' 
      AND column_name = 'payment_reminder_sent_at'
    ) THEN
      ALTER TABLE public.bills ADD COLUMN payment_reminder_sent_at TIMESTAMPTZ;
    END IF;
  END IF;
END $$;
