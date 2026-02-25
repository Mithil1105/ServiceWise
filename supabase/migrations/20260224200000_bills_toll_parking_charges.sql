-- Add toll and parking charges to bills (global, added to total; admin can customize labels via billing_layout_config)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'bills' AND column_name = 'toll_charges'
  ) THEN
    ALTER TABLE public.bills ADD COLUMN toll_charges NUMERIC NOT NULL DEFAULT 0;
    COMMENT ON COLUMN public.bills.toll_charges IS 'Toll tax / toll charges added to bill total. Display label configurable in Settings → Billing.';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'bills' AND column_name = 'parking_charges'
  ) THEN
    ALTER TABLE public.bills ADD COLUMN parking_charges NUMERIC NOT NULL DEFAULT 0;
    COMMENT ON COLUMN public.bills.parking_charges IS 'Parking charges added to bill total. Display label configurable in Settings → Billing.';
  END IF;
END $$;
