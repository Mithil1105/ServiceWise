-- Create customers table for phonebook
CREATE TABLE public.customers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID
);

-- Enable RLS
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Authenticated users can view customers" 
ON public.customers 
FOR SELECT 
USING (true);

CREATE POLICY "Admin and Manager can insert customers" 
ON public.customers 
FOR INSERT 
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "Admin and Manager can update customers" 
ON public.customers 
FOR UPDATE 
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

-- Trigger for auto-update timestamp
CREATE TRIGGER update_customers_updated_at
BEFORE UPDATE ON public.customers
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add final_km column to booking_vehicles for final billing
ALTER TABLE public.booking_vehicles 
ADD COLUMN IF NOT EXISTS final_km NUMERIC;