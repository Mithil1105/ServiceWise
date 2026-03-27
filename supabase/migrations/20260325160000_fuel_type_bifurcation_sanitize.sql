-- Fix existing rows that violate fuel_type canonical constraints.
-- Specifically, ensure `cars.allowed_fuel_types` contains ONLY:
--   petrol | diesel | cng | electric
-- and then (re)create constraints + enforcement trigger + fuel_entries.fuel_type.

DO $$
DECLARE
  v_canonical TEXT[] := ARRAY['petrol','diesel','cng','electric'];
BEGIN
  -- Ensure cars.allowed_fuel_types exists (older DBs might not have had the first migration applied)
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'cars'
      AND column_name = 'allowed_fuel_types'
  ) THEN
    ALTER TABLE public.cars ADD COLUMN allowed_fuel_types TEXT[] NULL;
  END IF;

  -- 1) Sanitize cars.allowed_fuel_types (if the column exists)
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'cars'
      AND column_name = 'allowed_fuel_types'
  ) THEN
    -- Initial backfill from cars.fuel_type (canonical only, fallback to diesel)
    UPDATE public.cars c
    SET allowed_fuel_types = ARRAY[
      CASE
        WHEN lower(trim(COALESCE(c.fuel_type, ''))) IN ('petrol','diesel','cng','electric')
          THEN lower(trim(COALESCE(c.fuel_type, '')))
        ELSE 'diesel'
      END
    ]
    WHERE c.allowed_fuel_types IS NULL;

    UPDATE public.cars c
    SET allowed_fuel_types = (
      SELECT
        CASE
          WHEN arr IS NULL OR cardinality(arr) = 0 THEN ARRAY['diesel']::text[]
          ELSE arr
        END
      FROM (
        SELECT ARRAY_AGG(DISTINCT fuel_clean ORDER BY fuel_clean) AS arr
        FROM unnest(COALESCE(c.allowed_fuel_types, ARRAY[lower(trim(COALESCE(c.fuel_type, 'diesel')))])) AS raw_fuel
        CROSS JOIN LATERAL (SELECT lower(trim(raw_fuel)) AS fuel_clean) fc
        WHERE fc.fuel_clean IS NOT NULL
          AND fc.fuel_clean <> ''
          AND fc.fuel_clean = ANY(v_canonical)
      ) s
    );
  END IF;

  -- 2) Add/ensure cars.allowed_fuel_types constraints
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

  -- 3) Ensure fuel_entries.fuel_type column exists + backfill
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'fuel_entries'
  ) THEN
    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'fuel_entries'
        AND column_name = 'fuel_type'
    ) THEN
      ALTER TABLE public.fuel_entries ADD COLUMN fuel_type TEXT NULL;
    END IF;

    UPDATE public.fuel_entries fe
    SET fuel_type = lower(trim(COALESCE(
      (SELECT c2.fuel_type FROM public.cars c2 WHERE c2.id = fe.car_id),
      (SELECT (c2.allowed_fuel_types)[1] FROM public.cars c2 WHERE c2.id = fe.car_id),
      'diesel'
    )))
    WHERE fe.fuel_type IS NULL OR trim(fe.fuel_type) = '';

    -- Ensure NOT NULL after backfill
    ALTER TABLE public.fuel_entries
      ALTER COLUMN fuel_type SET NOT NULL;

    -- Add/ensure canonical check
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints
      WHERE table_schema = 'public'
        AND table_name = 'fuel_entries'
        AND constraint_name = 'fuel_entries_fuel_type_canonical'
    ) THEN
      ALTER TABLE public.fuel_entries
        ADD CONSTRAINT fuel_entries_fuel_type_canonical
        CHECK (fuel_type = ANY(ARRAY['petrol','diesel','cng','electric']::text[]));
    END IF;

    -- 4) Ensure trigger enforcement exists
    CREATE OR REPLACE FUNCTION public.fuel_entries_validate_fuel_type()
    RETURNS TRIGGER
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = 'public'
    AS $fuel_type_bifurcation_sanitize_fn$
    DECLARE
      allowed TEXT[];
      chosen TEXT;
    BEGIN
      -- Canonical allowed values (must match frontend + constraints)
      -- Keep these inline because this function is created inside a migration.
      -- (No access to outer DO-block variables.)
      -- petrol | diesel | cng | electric
      -- NOTE: v_canonical is NOT available here.
      -- Use an inline array literal instead.
      chosen := lower(trim(COALESCE(NEW.fuel_type, '')));
      NEW.fuel_type := chosen;

      IF chosen IS NULL OR chosen = '' THEN
        chosen := 'diesel';
        NEW.fuel_type := chosen;
      END IF;

      IF chosen <> ALL(ARRAY['petrol','diesel','cng','electric']::text[]) THEN
        RAISE EXCEPTION 'Invalid fuel_type: %', NEW.fuel_type;
      END IF;

      SELECT COALESCE(c.allowed_fuel_types, ARRAY[lower(trim(COALESCE(c.fuel_type, 'diesel')))], ARRAY['diesel'])
        INTO allowed
      FROM public.cars c
      WHERE c.id = NEW.car_id;

      -- Remove any accidental non-canonical values (belt + suspenders)
      allowed := ARRAY(
        SELECT x
        FROM unnest(allowed) AS x
        WHERE lower(trim(x)) = ANY(ARRAY['petrol','diesel','cng','electric']::text[])
      );
      IF allowed IS NULL OR cardinality(allowed) = 0 THEN
        allowed := ARRAY['diesel'];
      END IF;

      IF NOT (chosen = ANY(allowed)) THEN
        RAISE EXCEPTION 'Fuel type % not allowed for car %. Allowed: %', chosen, NEW.car_id, allowed;
      END IF;

      RETURN NEW;
    END;
    $fuel_type_bifurcation_sanitize_fn$;

    DROP TRIGGER IF EXISTS trg_fuel_entries_validate_fuel_type ON public.fuel_entries;
    CREATE TRIGGER trg_fuel_entries_validate_fuel_type
      BEFORE INSERT OR UPDATE ON public.fuel_entries
      FOR EACH ROW
      EXECUTE FUNCTION public.fuel_entries_validate_fuel_type();
  END IF;
END $$;

