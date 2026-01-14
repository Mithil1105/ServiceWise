-- Add seats column to cars table
ALTER TABLE public.cars ADD COLUMN seats integer DEFAULT 5;

-- Update existing dummy cars with random seat counts for variety
UPDATE public.cars SET seats = 
  CASE 
    WHEN model ILIKE '%innova%' OR model ILIKE '%crysta%' THEN 7
    WHEN model ILIKE '%ertiga%' OR model ILIKE '%carens%' OR model ILIKE '%marazzo%' THEN 7
    WHEN model ILIKE '%xl6%' OR model ILIKE '%hector%' THEN 6
    WHEN model ILIKE '%fortuner%' OR model ILIKE '%safari%' OR model ILIKE '%scorpio%' THEN 7
    WHEN model ILIKE '%swift%' OR model ILIKE '%i20%' OR model ILIKE '%baleno%' OR model ILIKE '%glanza%' THEN 5
    WHEN model ILIKE '%dzire%' OR model ILIKE '%amaze%' OR model ILIKE '%aura%' THEN 5
    WHEN model ILIKE '%city%' OR model ILIKE '%verna%' OR model ILIKE '%ciaz%' THEN 5
    WHEN model ILIKE '%creta%' OR model ILIKE '%seltos%' OR model ILIKE '%nexon%' THEN 5
    WHEN model ILIKE '%thar%' THEN 4
    ELSE 5
  END;