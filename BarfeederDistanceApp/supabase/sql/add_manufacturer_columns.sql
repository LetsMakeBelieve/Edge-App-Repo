-- Add manufacturer metadata to machine model tables.
--
-- Bar feeder manufacturers are currently expected to be:
--   Edge Technologies
--   FMB
--
-- Lathe manufacturers are free text because the app may include many brands.

ALTER TABLE lathes
ADD COLUMN IF NOT EXISTS manufacturer TEXT;

ALTER TABLE bar_feeders
ADD COLUMN IF NOT EXISTS manufacturer TEXT;

UPDATE bar_feeders
SET manufacturer = CASE
  WHEN name ILIKE '%fmb%' THEN 'FMB'
  WHEN manufacturer IS NULL OR trim(manufacturer) = '' THEN 'Edge Technologies'
  ELSE manufacturer
END;

ALTER TABLE bar_feeders
DROP CONSTRAINT IF EXISTS bar_feeders_known_manufacturer;

ALTER TABLE bar_feeders
ADD CONSTRAINT bar_feeders_known_manufacturer
CHECK (
  manufacturer IS NULL
  OR manufacturer IN ('Edge Technologies', 'FMB')
);

DROP INDEX IF EXISTS lathes_name_unique_ci;
DROP INDEX IF EXISTS bar_feeders_name_unique_ci;

CREATE UNIQUE INDEX IF NOT EXISTS lathes_manufacturer_name_unique_ci
ON lathes (lower(coalesce(manufacturer, '')), lower(name));

CREATE UNIQUE INDEX IF NOT EXISTS bar_feeders_manufacturer_name_unique_ci
ON bar_feeders (lower(coalesce(manufacturer, '')), lower(name));
