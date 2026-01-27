-- Migration 0003: Add system-wide minimum KM defaults
-- Minimum KM thresholds are now system-wide defaults set by admin,
-- not per booking_requested_vehicle

-- Ensure system_config table exists (it should be created in an earlier migration)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'system_config') THEN
    CREATE TABLE public.system_config (
      id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
      key text NOT NULL UNIQUE,
      value jsonb NOT NULL,
      updated_at timestamp with time zone NOT NULL DEFAULT now()
    );

    -- Enable RLS
    ALTER TABLE public.system_config ENABLE ROW LEVEL SECURITY;

    -- Policies (if user_roles table exists)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_roles') THEN
      CREATE POLICY "Authenticated users can view system config" ON public.system_config
        FOR SELECT TO authenticated USING (true);

      CREATE POLICY "Admin can manage system config" ON public.system_config
        FOR ALL TO authenticated 
        USING (
          EXISTS (
            SELECT 1 FROM public.user_roles 
            WHERE user_id = auth.uid() 
            AND role::text = 'admin'
          )
        );
    ELSE
      -- Fallback: allow all authenticated users if user_roles doesn't exist yet
      CREATE POLICY "Authenticated users can view system config" ON public.system_config
        FOR SELECT TO authenticated USING (true);

      CREATE POLICY "Authenticated users can manage system config" ON public.system_config
        FOR ALL TO authenticated USING (true);
    END IF;
  END IF;
END $$;

-- Insert default minimum KM values into system_config (can be updated by admin later)
DO $$
BEGIN
  -- Only proceed if system_config table exists
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'system_config') THEN
    -- Insert per_km minimum KM default (if not exists)
    IF NOT EXISTS (SELECT 1 FROM public.system_config WHERE key = 'minimum_km_per_km') THEN
      INSERT INTO public.system_config (key, value)
      VALUES (
        'minimum_km_per_km',
        '100'::jsonb
      );
    END IF;

    -- Insert hybrid minimum KM per day default (if not exists)
    IF NOT EXISTS (SELECT 1 FROM public.system_config WHERE key = 'minimum_km_hybrid_per_day') THEN
      INSERT INTO public.system_config (key, value)
      VALUES (
        'minimum_km_hybrid_per_day',
        '100'::jsonb
      );
    END IF;
  END IF;
END $$;

-- Note: The minimum_km column in booking_requested_vehicles remains for backward compatibility
-- but new bookings will use system defaults from system_config.
