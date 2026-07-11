-- Normalize manufacturer casing and allow signed-in users to add equipment.
--
-- Run this in the Supabase SQL editor after the existing schema scripts.
-- The app already restricts account creation/sign-in; these policies allow
-- any authenticated app user to insert lathes and bar feeders.

UPDATE lathes
SET manufacturer = CASE
  WHEN manufacturer IS NULL OR trim(manufacturer) = '' THEN manufacturer
  WHEN lower(trim(manufacturer)) = 'star' THEN 'STAR'
  WHEN lower(trim(manufacturer)) = 'dn solutions' THEN 'DN Solutions'
  WHEN lower(trim(manufacturer)) = 'mazak' THEN 'Mazak'
  WHEN lower(trim(manufacturer)) = 'okuma' THEN 'Okuma'
  WHEN lower(trim(manufacturer)) = 'doosan' THEN 'Doosan'
  WHEN lower(trim(manufacturer)) = 'haas' THEN 'Haas'
  WHEN lower(trim(manufacturer)) = 'miyano' THEN 'Miyano'
  WHEN lower(trim(manufacturer)) = 'citizen' THEN 'Citizen'
  WHEN lower(trim(manufacturer)) = 'tsugami' THEN 'Tsugami'
  WHEN lower(trim(manufacturer)) = 'hardinge' THEN 'Hardinge'
  ELSE initcap(trim(regexp_replace(manufacturer, '\s+', ' ', 'g')))
END;

UPDATE bar_feeders
SET manufacturer = CASE
  WHEN manufacturer IS NULL OR trim(manufacturer) = '' THEN manufacturer
  WHEN lower(trim(manufacturer)) = 'edge technologies' THEN 'Edge Technologies'
  WHEN lower(trim(manufacturer)) = 'fmb' THEN 'FMB'
  ELSE initcap(trim(regexp_replace(manufacturer, '\s+', ' ', 'g')))
END;

DROP POLICY IF EXISTS "Edge users can insert lathes" ON lathes;
DROP POLICY IF EXISTS "Edge users can insert bar feeders" ON bar_feeders;
DROP POLICY IF EXISTS "Authenticated users can insert lathes" ON lathes;
DROP POLICY IF EXISTS "Authenticated users can insert bar feeders" ON bar_feeders;

CREATE POLICY "Authenticated users can insert lathes"
ON lathes
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert bar feeders"
ON bar_feeders
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

DROP INDEX IF EXISTS lathes_manufacturer_name_unique_ci;
DROP INDEX IF EXISTS bar_feeders_manufacturer_name_unique_ci;

CREATE UNIQUE INDEX IF NOT EXISTS lathes_manufacturer_name_unique_ci
ON lathes (lower(coalesce(manufacturer, '')), lower(name));

CREATE UNIQUE INDEX IF NOT EXISTS bar_feeders_manufacturer_name_unique_ci
ON bar_feeders (lower(coalesce(manufacturer, '')), lower(name));
