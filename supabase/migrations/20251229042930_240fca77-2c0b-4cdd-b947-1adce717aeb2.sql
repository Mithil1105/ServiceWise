-- Create table for multiple bill files per service record
CREATE TABLE public.service_bill_files (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  service_record_id UUID NOT NULL REFERENCES public.service_records(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  file_type TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.service_bill_files ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Authenticated users can view service bill files"
ON public.service_bill_files
FOR SELECT
USING (true);

CREATE POLICY "Admin and Manager can insert service bill files"
ON public.service_bill_files
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "Admin and Manager can delete service bill files"
ON public.service_bill_files
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

-- Create index for faster lookups
CREATE INDEX idx_service_bill_files_record_id ON public.service_bill_files(service_record_id);