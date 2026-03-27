-- Business rule:
-- If a car supports CNG, Petrol should also be allowed by default.
-- This migration patches existing rows and updates DB trigger logic so inserts/updates allow it.

-- 1) Patch existing allowed_fuel_types
UPDATE public.cars
SET allowed_fuel_types = (
  SELECT ARRAY(
    SELECT DISTINCT x
    FROM unnest(COALESCE(allowed_fuel_types, ARRAY[]::text[]) || ARRAY['petrol']) AS x
    WHERE x IS NOT NULL AND trim(x) <> ''
    ORDER BY x
  )
)
WHERE allowed_fuel_types IS NOT NULL
  AND 'cng' = ANY(allowed_fuel_types)
  AND NOT ('petrol' = ANY(allowed_fuel_types));

-- 2) If allowed_fuel_types is null but legacy fuel_type is cng, initialize to both
UPDATE public.cars
SET allowed_fuel_types = ARRAY['cng', 'petrol']
WHERE allowed_fuel_types IS NULL
  AND lower(trim(COALESCE(fuel_type, ''))) = 'cng';

-- 3) Recreate trigger function with CNG=>Petrol defaulting in fallback path
CREATE OR REPLACE FUNCTION public.fuel_entries_validate_fuel_type()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  allowed TEXT[];
  chosen TEXT;
  legacy_fuel_type TEXT;
BEGIN
  chosen := lower(trim(COALESCE(NEW.fuel_type, '')));
  NEW.fuel_type := chosen;

  IF chosen NOT IN ('petrol','diesel','cng','electric') THEN
    RAISE EXCEPTION 'Invalid fuel_type: %', NEW.fuel_type;
  END IF;

  SELECT c.allowed_fuel_types, lower(trim(COALESCE(c.fuel_type, '')))
    INTO allowed, legacy_fuel_type
  FROM public.cars c
  WHERE c.id = NEW.car_id;

  IF allowed IS NULL OR cardinality(allowed) = 0 THEN
    IF legacy_fuel_type = 'cng' THEN
      allowed := ARRAY['cng','petrol'];
    ELSIF legacy_fuel_type IN ('petrol','diesel','electric') THEN
      allowed := ARRAY[legacy_fuel_type];
    ELSE
      allowed := ARRAY['diesel'];
    END IF;
  END IF;

  IF 'cng' = ANY(allowed) AND NOT ('petrol' = ANY(allowed)) THEN
    allowed := allowed || ARRAY['petrol'];
  END IF;

  IF NOT (chosen = ANY(allowed)) THEN
    RAISE EXCEPTION 'Fuel type % not allowed for car %. Allowed: %', chosen, NEW.car_id, allowed;
  END IF;

  RETURN NEW;
END;
$$;

