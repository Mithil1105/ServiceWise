-- Migration 0006: Create dummy brand-specific service rules
-- Creates service rules for Toyota, Maruti, and Hyundai brands based on existing template rules

DO $$
DECLARE
  template_rule RECORD;
  brand_name TEXT;
  new_rule_id UUID;
BEGIN
  -- Only run if service_rules table exists and has brand column
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'service_rules'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'service_rules' 
    AND column_name = 'brand'
  ) THEN
    
    -- Brands to create rules for
    FOR brand_name IN SELECT unnest(ARRAY['Toyota', 'Maruti', 'Hyundai']) LOOP
      
      -- Check if brand already has rules
      IF NOT EXISTS (
        SELECT 1 FROM public.service_rules WHERE brand = brand_name LIMIT 1
      ) THEN
        
        -- Copy all existing template rules (where brand IS NULL) to this brand
        FOR template_rule IN 
          SELECT * FROM public.service_rules WHERE brand IS NULL AND active = true
        LOOP
          -- Insert brand-specific rule based on template
          INSERT INTO public.service_rules (
            name,
            interval_km,
            interval_days,
            is_critical,
            due_soon_threshold_km,
            due_soon_threshold_days,
            active,
            brand,
            created_at,
            updated_at
          ) VALUES (
            template_rule.name,
            template_rule.interval_km,
            template_rule.interval_days,
            template_rule.is_critical,
            template_rule.due_soon_threshold_km,
            template_rule.due_soon_threshold_days,
            true,
            brand_name,
            now(),
            now()
          );
        END LOOP;
        
        RAISE NOTICE 'Created service rules for brand: %', brand_name;
      ELSE
        RAISE NOTICE 'Brand % already has service rules, skipping...', brand_name;
      END IF;
    END LOOP;
    
    RAISE NOTICE 'Dummy brand service rules creation completed.';
  END IF;
END $$;
