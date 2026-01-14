-- Create drivers table
CREATE TABLE public.drivers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  location TEXT,
  region TEXT,
  license_expiry DATE,
  license_file_path TEXT,
  license_file_name TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on drivers
ALTER TABLE public.drivers ENABLE ROW LEVEL SECURITY;

-- RLS policies for drivers
CREATE POLICY "Authenticated users can view drivers"
ON public.drivers FOR SELECT
USING (true);

CREATE POLICY "Admin and Manager can insert drivers"
ON public.drivers FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "Admin and Manager can update drivers"
ON public.drivers FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "Admin can delete drivers"
ON public.drivers FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Trigger for updated_at
CREATE TRIGGER update_drivers_updated_at
BEFORE UPDATE ON public.drivers
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create car_documents table for RC, PUC, Insurance, Warranty
CREATE TABLE public.car_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  car_id UUID NOT NULL REFERENCES public.cars(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL, -- 'rc', 'puc', 'insurance', 'warranty'
  expiry_date DATE,
  file_path TEXT,
  file_name TEXT,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(car_id, document_type)
);

-- Enable RLS on car_documents
ALTER TABLE public.car_documents ENABLE ROW LEVEL SECURITY;

-- RLS policies for car_documents
CREATE POLICY "Authenticated users can view car documents"
ON public.car_documents FOR SELECT
USING (true);

CREATE POLICY "Admin and Manager can insert car documents"
ON public.car_documents FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "Admin and Manager can update car documents"
ON public.car_documents FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "Admin and Manager can delete car documents"
ON public.car_documents FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

-- Trigger for updated_at
CREATE TRIGGER update_car_documents_updated_at
BEFORE UPDATE ON public.car_documents
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add warranty fields to service_records
ALTER TABLE public.service_records
ADD COLUMN warranty_expiry DATE,
ADD COLUMN warranty_file_path TEXT,
ADD COLUMN warranty_file_name TEXT,
ADD COLUMN serial_number TEXT;

-- Create storage bucket for driver licenses
INSERT INTO storage.buckets (id, name, public) VALUES ('driver-licenses', 'driver-licenses', false);

-- Create storage bucket for car documents
INSERT INTO storage.buckets (id, name, public) VALUES ('car-documents', 'car-documents', false);

-- Storage policies for driver-licenses bucket
CREATE POLICY "Authenticated users can view driver licenses"
ON storage.objects FOR SELECT
USING (bucket_id = 'driver-licenses' AND auth.role() = 'authenticated');

CREATE POLICY "Admin and Manager can upload driver licenses"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'driver-licenses' AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role)));

CREATE POLICY "Admin and Manager can delete driver licenses"
ON storage.objects FOR DELETE
USING (bucket_id = 'driver-licenses' AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role)));

-- Storage policies for car-documents bucket
CREATE POLICY "Authenticated users can view car documents files"
ON storage.objects FOR SELECT
USING (bucket_id = 'car-documents' AND auth.role() = 'authenticated');

CREATE POLICY "Admin and Manager can upload car documents"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'car-documents' AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role)));

CREATE POLICY "Admin and Manager can delete car documents"
ON storage.objects FOR DELETE
USING (bucket_id = 'car-documents' AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role)));