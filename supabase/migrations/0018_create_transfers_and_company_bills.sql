-- Migration 0018: Create transfers and company_bills tables for financial management

-- Create transfers table to track advance payment transfers
CREATE TABLE IF NOT EXISTS public.transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  bill_id UUID REFERENCES public.bills(id) ON DELETE SET NULL,
  amount NUMERIC NOT NULL,
  from_account_type TEXT NOT NULL CHECK (from_account_type IN ('personal', 'cash')),
  from_account_id UUID REFERENCES public.bank_accounts(id) ON DELETE SET NULL, -- Only for personal accounts
  collected_by_user_id UUID REFERENCES auth.users(id),
  collected_by_name TEXT NOT NULL, -- Manager/admin name who collected
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed')),
  transfer_date TIMESTAMPTZ, -- When transfer was completed
  completed_by_user_id UUID REFERENCES auth.users(id), -- Who marked as completed
  completed_at TIMESTAMPTZ,
  cash_given_to_cashier BOOLEAN DEFAULT false, -- For cash payments
  cashier_name TEXT, -- Name of cashier who received cash
  reminder_sent_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create indexes for transfers
CREATE INDEX IF NOT EXISTS idx_transfers_booking_id ON public.transfers(booking_id);
CREATE INDEX IF NOT EXISTS idx_transfers_bill_id ON public.transfers(bill_id);
CREATE INDEX IF NOT EXISTS idx_transfers_status ON public.transfers(status);
CREATE INDEX IF NOT EXISTS idx_transfers_collected_by_user_id ON public.transfers(collected_by_user_id);
CREATE INDEX IF NOT EXISTS idx_transfers_created_at ON public.transfers(created_at);

-- Create company_bills table
CREATE TABLE IF NOT EXISTS public.company_bills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  customer_bill_id UUID NOT NULL REFERENCES public.bills(id) ON DELETE CASCADE,
  bill_number TEXT UNIQUE NOT NULL,
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ NOT NULL,
  pickup TEXT,
  dropoff TEXT,
  start_odometer_reading NUMERIC,
  end_odometer_reading NUMERIC,
  total_km_driven NUMERIC NOT NULL,
  km_calculation_method TEXT CHECK (km_calculation_method IN ('odometer', 'manual')),
  vehicle_details JSONB NOT NULL, -- Same structure as customer bill
  total_amount NUMERIC NOT NULL,
  total_driver_allowance NUMERIC NOT NULL DEFAULT 0,
  advance_amount NUMERIC NOT NULL DEFAULT 0,
  advance_payment_method TEXT CHECK (advance_payment_method IN ('cash', 'online')),
  advance_account_type TEXT CHECK (advance_account_type IN ('company', 'personal')),
  advance_account_id UUID REFERENCES public.bank_accounts(id),
  advance_collected_by TEXT, -- Manager/admin name
  transfer_requirements JSONB, -- Array of transfer details
  internal_notes TEXT,
  threshold_note TEXT,
  pdf_file_path TEXT,
  pdf_file_name TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create indexes for company_bills
CREATE INDEX IF NOT EXISTS idx_company_bills_booking_id ON public.company_bills(booking_id);
CREATE INDEX IF NOT EXISTS idx_company_bills_customer_bill_id ON public.company_bills(customer_bill_id);
CREATE INDEX IF NOT EXISTS idx_company_bills_bill_number ON public.company_bills(bill_number);
CREATE INDEX IF NOT EXISTS idx_company_bills_created_at ON public.company_bills(created_at);

-- Create sequence for company bill numbers
CREATE SEQUENCE IF NOT EXISTS public.company_bill_number_seq START 1;

-- Create function to generate company bill number
CREATE OR REPLACE FUNCTION public.generate_company_bill_number()
RETURNS TEXT AS $$
DECLARE
  year_part TEXT;
  seq_num INTEGER;
  bill_num TEXT;
BEGIN
  year_part := to_char(now(), 'YYYY');
  seq_num := nextval('public.company_bill_number_seq');
  bill_num := 'PT-CB-' || year_part || '-' || lpad(seq_num::text, 6, '0');
  RETURN bill_num;
END;
$$ LANGUAGE plpgsql;

-- Enable RLS
ALTER TABLE public.transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_bills ENABLE ROW LEVEL SECURITY;

-- RLS Policies for transfers
CREATE POLICY "Authenticated users can view transfers"
  ON public.transfers FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = auth.uid() 
      AND role::text IN ('admin', 'manager')
    )
  );

CREATE POLICY "Admin and Manager can create transfers"
  ON public.transfers FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = auth.uid() 
      AND role::text IN ('admin', 'manager')
    )
  );

CREATE POLICY "Admin and Manager can update transfers"
  ON public.transfers FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = auth.uid() 
      AND role::text IN ('admin', 'manager')
    )
  );

-- RLS Policies for company_bills
CREATE POLICY "Authenticated users can view company bills"
  ON public.company_bills FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = auth.uid() 
      AND role::text IN ('admin', 'manager')
    )
  );

CREATE POLICY "Admin and Manager can create company bills"
  ON public.company_bills FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = auth.uid() 
      AND role::text IN ('admin', 'manager')
    )
  );

CREATE POLICY "Admin and Manager can update company bills"
  ON public.company_bills FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = auth.uid() 
      AND role::text IN ('admin', 'manager')
    )
  );

-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';
