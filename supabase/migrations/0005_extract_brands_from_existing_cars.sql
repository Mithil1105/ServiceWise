-- Migration 0005: Extract brands from existing car models and populate brand column
-- This function extracts brand names from model strings (e.g., "Toyota Innova" -> "Toyota")

DO $$
DECLARE
  car_record RECORD;
  brand_name TEXT;
  model_parts TEXT[];
BEGIN
  -- Only run if cars table exists and has brand column
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'cars'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'cars' 
    AND column_name = 'brand'
  ) THEN
    
    -- Common brand names to extract (case-insensitive matching)
    -- Process each car and extract brand from model
    FOR car_record IN 
      SELECT id, model, brand 
      FROM public.cars 
      WHERE brand IS NULL OR brand = ''
    LOOP
      -- Split model by space and take first word as brand
      model_parts := string_to_array(trim(car_record.model), ' ');
      
      IF array_length(model_parts, 1) > 0 THEN
        brand_name := model_parts[1];
        
        -- Handle special cases (multi-word brands)
        IF brand_name ILIKE 'Mercedes-Benz' OR car_record.model ILIKE 'Mercedes-Benz%' THEN
          brand_name := 'Mercedes-Benz';
        ELSIF brand_name ILIKE 'Land' AND array_length(model_parts, 1) > 1 AND model_parts[2] ILIKE 'Rover' THEN
          brand_name := 'Land Rover';
        ELSIF brand_name ILIKE 'Range' AND array_length(model_parts, 1) > 1 AND model_parts[2] ILIKE 'Rover' THEN
          brand_name := 'Range Rover';
        ELSIF brand_name ILIKE 'Maruti' THEN
          brand_name := 'Maruti';
        ELSIF brand_name ILIKE 'Mahindra' THEN
          brand_name := 'Mahindra';
        ELSIF brand_name ILIKE 'Toyota' THEN
          brand_name := 'Toyota';
        ELSIF brand_name ILIKE 'Hyundai' THEN
          brand_name := 'Hyundai';
        ELSIF brand_name ILIKE 'Honda' THEN
          brand_name := 'Honda';
        ELSIF brand_name ILIKE 'Tata' THEN
          brand_name := 'Tata';
        ELSIF brand_name ILIKE 'Kia' THEN
          brand_name := 'Kia';
        ELSIF brand_name ILIKE 'MG' THEN
          brand_name := 'MG';
        ELSIF brand_name ILIKE 'Nissan' THEN
          brand_name := 'Nissan';
        ELSIF brand_name ILIKE 'Renault' THEN
          brand_name := 'Renault';
        ELSIF brand_name ILIKE 'Ford' THEN
          brand_name := 'Ford';
        ELSIF brand_name ILIKE 'Volkswagen' THEN
          brand_name := 'Volkswagen';
        ELSIF brand_name ILIKE 'Skoda' THEN
          brand_name := 'Skoda';
        ELSIF brand_name ILIKE 'Force' THEN
          brand_name := 'Force';
        ELSIF brand_name ILIKE 'Isuzu' THEN
          brand_name := 'Isuzu';
        ELSIF brand_name ILIKE 'Jeep' THEN
          brand_name := 'Jeep';
        ELSIF brand_name ILIKE 'Citroen' THEN
          brand_name := 'Citroen';
        ELSIF brand_name ILIKE 'BMW' THEN
          brand_name := 'BMW';
        ELSIF brand_name ILIKE 'Audi' THEN
          brand_name := 'Audi';
        ELSIF brand_name ILIKE 'Jaguar' THEN
          brand_name := 'Jaguar';
        ELSIF brand_name ILIKE 'Volvo' THEN
          brand_name := 'Volvo';
        ELSIF brand_name ILIKE 'Porsche' THEN
          brand_name := 'Porsche';
        ELSIF brand_name ILIKE 'Datsun' THEN
          brand_name := 'Datsun';
        END IF;
        
        -- Update the car with extracted brand
        UPDATE public.cars 
        SET brand = brand_name 
        WHERE id = car_record.id;
      END IF;
    END LOOP;
    
    RAISE NOTICE 'Brand extraction completed. Updated cars with extracted brand names.';
  END IF;
END $$;
