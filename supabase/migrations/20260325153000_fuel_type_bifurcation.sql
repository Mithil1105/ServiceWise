-- Fuel type bifurcation:
-- - cars.allowed_fuel_types TEXT[] (multi-fuel support per car)
-- - fuel_entries.fuel_type TEXT (required, canonical)
-- - trigger to enforce: fuel_entries.fuel_type must be in car allowed types

-- Canonical fuel types used across app
DO $$
BEGIN
  -- cars.allowed_fuel_types
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'cars' AND column_name = 'allowed_fuel_types'
  ) THEN
    ALTER TABLE public.cars ADD COLUMN allowed_fuel_types TEXT[] NULL;
  END IF;

  -- Backfill allowed_fuel_types from cars.fuel_type when present
  UPDATE public.cars
  SET allowed_fuel_types = ARRAY[
    CASE
      WHEN lower(trim(fuel_type)) IN ('petrol','diesel','cng','electric') THEN lower(trim(fuel_type))
      ELSE 'diesel'
    END
  ]
  WHERE allowed_fuel_types IS NULL
    AND fuel_type IS NOT NULL
    AND trim(fuel_type) <> '';

  -- If still null, default to diesel to keep downstream invariants consistent
  UPDATE public.cars
  SET allowed_fuel_types = ARRAY['diesel']
  WHERE allowed_fuel_types IS NULL;

  -- Normalize existing arrays to lowercase trimmed values
  UPDATE public.cars
  SET allowed_fuel_types = (
    SELECT ARRAY(
      SELECT DISTINCT lower(trim(x))
      FROM unnest(allowed_fuel_types) AS x
      WHERE x IS NOT NULL
        AND trim(x) <> ''
        AND lower(trim(x)) IN ('petrol','diesel','cng','electric')
    )
  )
  WHERE allowed_fuel_types IS NOT NULL;

  -- If a row had only non-canonical values, the filtered array becomes NULL; default it.
  UPDATE public.cars
  SET allowed_fuel_types = ARRAY['diesel']
  WHERE allowed_fuel_types IS NULL;
END $$;

-- Constraints (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'cars'
      AND constraint_name = 'cars_allowed_fuel_types_nonempty'
  ) THEN
    ALTER TABLE public.cars
      ADD CONSTRAINT cars_allowed_fuel_types_nonempty
      CHECK (allowed_fuel_types IS NULL OR cardinality(allowed_fuel_types) > 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'cars'
      AND constraint_name = 'cars_allowed_fuel_types_canonical'
  ) THEN
    ALTER TABLE public.cars
      ADD CONSTRAINT cars_allowed_fuel_types_canonical
      CHECK (
        allowed_fuel_types IS NULL
        OR allowed_fuel_types <@ ARRAY['petrol','diesel','cng','electric']::text[]
      );
  END IF;
END $$;

-- fuel_entries.fuel_type
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'fuel_entries' AND column_name = 'fuel_type'
  ) THEN
    ALTER TABLE public.fuel_entries ADD COLUMN fuel_type TEXT NULL;
  END IF;
END $$;

-- Backfill fuel_entries.fuel_type from cars
UPDATE public.fuel_entries fe
SET fuel_type = lower(trim(COALESCE(c.fuel_type, (c.allowed_fuel_types)[1], 'diesel')))
FROM public.cars c
WHERE fe.car_id = c.id
  AND (fe.fuel_type IS NULL OR trim(fe.fuel_type) = '');

-- Default any remaining nulls to diesel (keeps NOT NULL safe)
UPDATE public.fuel_entries
SET fuel_type = 'diesel'
WHERE fuel_type IS NULL OR trim(fuel_type) = '';

-- Enforce NOT NULL + canonical fuel type
DO $$
BEGIN
  ALTER TABLE public.fuel_entries
    ALTER COLUMN fuel_type SET NOT NULL;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'fuel_entries'
      AND constraint_name = 'fuel_entries_fuel_type_canonical'
  ) THEN
    ALTER TABLE public.fuel_entries
      ADD CONSTRAINT fuel_entries_fuel_type_canonical
      CHECK (fuel_type IN ('petrol','diesel','cng','electric'));
  END IF;
END $$;

-- Trigger to ensure fuel_entries.fuel_type belongs to the car's allowed types
CREATE OR REPLACE FUNCTION public.fuel_entries_validate_fuel_type()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  allowed TEXT[];
  chosen TEXT;
BEGIN
  chosen := lower(trim(COALESCE(NEW.fuel_type, '')));
  NEW.fuel_type := chosen;

  IF chosen NOT IN ('petrol','diesel','cng','electric') THEN
    RAISE EXCEPTION 'Invalid fuel_type: %', NEW.fuel_type;
  END IF;

  SELECT COALESCE(c.allowed_fuel_types, ARRAY[lower(trim(COALESCE(c.fuel_type, 'diesel')))], ARRAY['diesel'])
    INTO allowed
  FROM public.cars c
  WHERE c.id = NEW.car_id;

  IF allowed IS NULL OR cardinality(allowed) = 0 THEN
    allowed := ARRAY['diesel'];
  END IF;

  IF NOT (chosen = ANY(allowed)) THEN
    RAISE EXCEPTION 'Fuel type % not allowed for car %. Allowed: %', chosen, NEW.car_id, allowed;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_fuel_entries_validate_fuel_type ON public.fuel_entries;
CREATE TRIGGER trg_fuel_entries_validate_fuel_type
  BEFORE INSERT OR UPDATE ON public.fuel_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.fuel_entries_validate_fuel_type();

