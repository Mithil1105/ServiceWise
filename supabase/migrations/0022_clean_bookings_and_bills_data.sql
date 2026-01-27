-- Migration 0022: Clean all bookings and bills data
-- This removes all data from bookings and billing-related tables
-- Tables and structure remain intact

DO $$
BEGIN
  -- Delete in order to respect foreign key constraints
  
  -- 1. Delete transfers (references bills)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'transfers') THEN
    DELETE FROM public.transfers;
    RAISE NOTICE 'Deleted all transfers';
  END IF;

  -- 2. Delete company bills (references bills and bookings)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'company_bills') THEN
    DELETE FROM public.company_bills;
    RAISE NOTICE 'Deleted all company bills';
  END IF;

  -- 3. Delete bills (references bookings)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'bills') THEN
    DELETE FROM public.bills;
    RAISE NOTICE 'Deleted all bills';
  END IF;

  -- 4. Delete booking vehicles (references bookings)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'booking_vehicles') THEN
    DELETE FROM public.booking_vehicles;
    RAISE NOTICE 'Deleted all booking vehicles';
  END IF;

  -- 5. Delete booking requested vehicles (references bookings)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'booking_requested_vehicles') THEN
    DELETE FROM public.booking_requested_vehicles;
    RAISE NOTICE 'Deleted all booking requested vehicles';
  END IF;

  -- 6. Delete booking audit logs (references bookings)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'booking_audit_logs') THEN
    DELETE FROM public.booking_audit_logs;
    RAISE NOTICE 'Deleted all booking audit logs';
  END IF;

  -- 7. Finally, delete bookings
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'bookings') THEN
    DELETE FROM public.bookings;
    RAISE NOTICE 'Deleted all bookings';
  END IF;

  RAISE NOTICE 'All bookings and bills data cleaned successfully';
END $$;

-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';
