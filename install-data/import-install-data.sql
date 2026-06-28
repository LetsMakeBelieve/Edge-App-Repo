-- Generated from /workspaces/Edge-App-Repo/install-data/Machine Install Data(Sheet1).csv
-- Review before running in Supabase SQL editor.
--
-- Counts:
--   Lathe models: 32
--   Bar feeder models: 15
--   Distance rows: 24
--   Skipped source rows: 11

BEGIN;

-- Required schema support.
ALTER TABLE lathes
ADD COLUMN IF NOT EXISTS manufacturer TEXT;

ALTER TABLE bar_feeders
ADD COLUMN IF NOT EXISTS manufacturer TEXT;

ALTER TABLE distances
ADD COLUMN IF NOT EXISTS distance_in_eighths INT;

DROP INDEX IF EXISTS lathes_name_unique_ci;
DROP INDEX IF EXISTS bar_feeders_name_unique_ci;

CREATE UNIQUE INDEX IF NOT EXISTS lathes_manufacturer_name_unique_ci
ON lathes (lower(coalesce(manufacturer, '')), lower(name));

CREATE UNIQUE INDEX IF NOT EXISTS bar_feeders_manufacturer_name_unique_ci
ON bar_feeders (lower(coalesce(manufacturer, '')), lower(name));

ALTER TABLE bar_feeders
DROP CONSTRAINT IF EXISTS bar_feeders_known_manufacturer;

ALTER TABLE bar_feeders
ADD CONSTRAINT bar_feeders_known_manufacturer
CHECK (
  manufacturer IS NULL
  OR manufacturer IN ('Edge Technologies', 'FMB')
);

CREATE TEMP TABLE import_lathes (
  manufacturer TEXT NOT NULL,
  name TEXT NOT NULL
) ON COMMIT DROP;

CREATE TEMP TABLE import_bar_feeders (
  manufacturer TEXT NOT NULL,
  name TEXT NOT NULL
) ON COMMIT DROP;

CREATE TEMP TABLE import_distances (
  source_row INT NOT NULL,
  lathe_manufacturer TEXT NOT NULL,
  lathe_model TEXT NOT NULL,
  bar_feeder_manufacturer TEXT NOT NULL,
  bar_feeder_model TEXT NOT NULL,
  distance_in_eighths INT NOT NULL,
  distance_mm INT NOT NULL,
  notes TEXT
) ON COMMIT DROP;

INSERT INTO import_lathes (manufacturer, name)
VALUES
  ('Citizen', 'A-32'),
  ('Citizen', 'C-20'),
  ('EMCO', 'Emco Turn 420 MC'),
  ('Ganesh', 'Ganesh 32CS'),
  ('Ganesh', 'Ganesh 52 TTMY'),
  ('Ganesh', 'Ganesh Cyclone 32 NCY'),
  ('Hanawah', 'Hanwha XD20H'),
  ('Maier', 'Maier MLK 32/38'),
  ('Miyano', 'Miyano BNA-42 DHY'),
  ('STAR', 'SB 20'),
  ('STAR', 'SB16r type E'),
  ('STAR', 'SR10J type C'),
  ('STAR', 'SR20R IV type B'),
  ('STAR', 'SR32 J'),
  ('STAR', 'Sr32JN'),
  ('STAR', 'Star SR 32JN'),
  ('STAR', 'Star ST38'),
  ('STAR', 'SV32'),
  ('Tsugami', 'Tsugami'),
  ('Tsugami', 'Tsugami BE 12 V'),
  ('Tsugami', 'Tsugami BH38'),
  ('Tsugami', 'Tsugami BO 125 II'),
  ('Tsugami', 'Tsugami Bo 325'),
  ('Tsugami', 'Tsugami BO 326'),
  ('Tsugami', 'Tsugami BO385L'),
  ('Tsugami', 'Tsugami GO 385L'),
  ('Tsugami', 'Tsugami S206'),
  ('Tsugami', 'Tsugami S207-5AX'),
  ('Tsugami', 'Tsugami SS26'),
  ('Tsugami', 'Tsugami SS32'),
  ('Tsugami', 'Tsugami SS327-5AX'),
  ('Tsugami', 'Tusgami BO125');

INSERT INTO import_bar_feeders (manufacturer, name)
VALUES
  ('Edge Technologies', 'C320'),
  ('Edge Technologies', 'C332'),
  ('Edge Technologies', 'Minuteman 320'),
  ('Edge Technologies', 'Minuteman 320 Extended'),
  ('Edge Technologies', 'MLS-65'),
  ('Edge Technologies', 'Patriot 332'),
  ('Edge Technologies', 'Patriot 338'),
  ('Edge Technologies', 'Patriot 551'),
  ('Edge Technologies', 'Rebel V-65 Servo'),
  ('Edge Technologies', 'V65 Rebel'),
  ('Edge Technologies', 'V65 Servo'),
  ('FMB', 'FMB Doppel Turbo ET420'),
  ('FMB', 'FMB Mini Turbo'),
  ('FMB', 'FMB turbo 220'),
  ('FMB', 'FMB Turbo 338');

INSERT INTO import_distances (
  source_row,
  lathe_manufacturer,
  lathe_model,
  bar_feeder_manufacturer,
  bar_feeder_model,
  distance_in_eighths,
  distance_mm,
  notes
)
VALUES
  (9, 'EMCO', 'Emco Turn 420 MC', 'FMB', 'FMB Doppel Turbo ET420', 98, 311, 'Imported from spreadsheet row 9'),
  (13, 'Ganesh', 'Ganesh 52 TTMY', 'Edge Technologies', 'Patriot 551', 60, 191, 'Distance context: from oil Recouperator
Imported from spreadsheet row 13'),
  (26, 'Miyano', 'Miyano BNA-42 DHY', 'Edge Technologies', 'MLS-65', 90, 286, 'Imported from spreadsheet row 26'),
  (29, 'Maier', 'Maier MLK 32/38', 'FMB', 'FMB Turbo 338', 112, 356, 'Imported from spreadsheet row 29'),
  (33, 'STAR', 'SR10J type C', 'Edge Technologies', 'Minuteman 320', 60, 191, 'Distance context: from Main sheetmetal
Imported from spreadsheet row 33'),
  (34, 'STAR', 'SB16r type E', 'Edge Technologies', 'Minuteman 320', 112, 356, 'Install notes: remove 2 inches from Telescopic tube
Imported from spreadsheet row 34'),
  (35, 'STAR', 'SR20R IV type B', 'Edge Technologies', 'Minuteman 320', 94, 298, 'Install notes: Cut Telescope to 11 inches colapsed Threaded rod to 16 inches
Imported from spreadsheet row 35'),
  (36, 'STAR', 'SB 20', 'Edge Technologies', 'Minuteman 320', 130, 413, 'Install notes: No modificatons to Telescopic tube
Imported from spreadsheet row 36'),
  (38, 'STAR', 'SR32 J', 'Edge Technologies', 'Patriot 332', 196, 622, 'Install notes: Cut Telescope to 11 inches colapsed Threaded rod to 16 inches
Imported from spreadsheet row 38'),
  (39, 'STAR', 'Star SR 32JN', 'Edge Technologies', 'V65 Rebel', 102, 324, 'Install notes: Should use telescopic tube
Imported from spreadsheet row 39'),
  (40, 'STAR', 'Sr32JN', 'Edge Technologies', 'Minuteman 320', 72, 229, 'Install notes: No Modifications to Telescopic tube
Imported from spreadsheet row 40'),
  (41, 'STAR', 'SV32', 'Edge Technologies', 'Patriot 338', 196, 622, 'Imported from spreadsheet row 41'),
  (50, 'Tsugami', 'Tsugami BO385L', 'Edge Technologies', 'Patriot 338', 124, 394, 'Imported from spreadsheet row 50'),
  (51, 'Tsugami', 'Tsugami Bo 325', 'Edge Technologies', 'Patriot 338', 236, 749, 'Install notes: Cut Telescope to 10 in overall colapsed
Imported from spreadsheet row 51'),
  (52, 'Tsugami', 'Tsugami BO 326', 'Edge Technologies', 'Patriot 338', 234, 743, 'Install notes: Cut Telescpoic tube 2" keep drop
Imported from spreadsheet row 52'),
  (54, 'Tsugami', 'Tsugami SS32', 'Edge Technologies', 'Patriot 338', 208, 660, 'Imported from spreadsheet row 54'),
  (56, 'Tsugami', 'Tsugami', 'Edge Technologies', 'Minuteman 320', 132, 419, 'Imported from spreadsheet row 56'),
  (57, 'Tsugami', 'Tsugami BO 125 II', 'FMB', 'FMB Mini Turbo', 132, 419, 'Imported from spreadsheet row 57'),
  (58, 'Tsugami', 'Tsugami BE 12 V', 'FMB', 'FMB Mini Turbo', 120, 381, 'Imported from spreadsheet row 58'),
  (59, 'Tsugami', 'Tsugami S206', 'FMB', 'FMB Mini Turbo', 116, 368, 'Imported from spreadsheet row 59'),
  (60, 'Tsugami', 'Tusgami BO125', 'Edge Technologies', 'Minuteman 320', 132, 419, 'Imported from spreadsheet row 60'),
  (61, 'Tsugami', 'Tsugami SS26', 'Edge Technologies', 'Minuteman 320 Extended', 120, 381, 'Install notes: remove 3 inches from Telescopic tube keep remnant Cut threaded rod to 8 inches
Imported from spreadsheet row 61'),
  (62, 'Tsugami', 'Tsugami S207-5AX', 'FMB', 'FMB turbo 220', 116, 368, 'Imported from spreadsheet row 62'),
  (63, 'Tsugami', 'Tsugami SS327-5AX', 'Edge Technologies', 'Patriot 338', 232, 737, 'Imported from spreadsheet row 63');

INSERT INTO lathes (manufacturer, name)
SELECT manufacturer, name
FROM import_lathes
WHERE NOT EXISTS (
  SELECT 1
  FROM lathes
  WHERE lower(coalesce(lathes.manufacturer, '')) = lower(import_lathes.manufacturer)
    AND lower(lathes.name) = lower(import_lathes.name)
);

INSERT INTO bar_feeders (manufacturer, name)
SELECT manufacturer, name
FROM import_bar_feeders
WHERE NOT EXISTS (
  SELECT 1
  FROM bar_feeders
  WHERE lower(coalesce(bar_feeders.manufacturer, '')) = lower(import_bar_feeders.manufacturer)
    AND lower(bar_feeders.name) = lower(import_bar_feeders.name)
);

INSERT INTO distances (
  lathe_id,
  bar_feeder_id,
  distance_in_eighths,
  distance_mm,
  notes
)
SELECT
  lathes.id,
  bar_feeders.id,
  import_distances.distance_in_eighths,
  import_distances.distance_mm,
  import_distances.notes
FROM import_distances
JOIN lathes
  ON lower(coalesce(lathes.manufacturer, '')) = lower(import_distances.lathe_manufacturer)
  AND lower(lathes.name) = lower(import_distances.lathe_model)
JOIN bar_feeders
  ON lower(coalesce(bar_feeders.manufacturer, '')) = lower(import_distances.bar_feeder_manufacturer)
  AND lower(bar_feeders.name) = lower(import_distances.bar_feeder_model)
ON CONFLICT (lathe_id, bar_feeder_id)
DO UPDATE SET
  distance_in_eighths = EXCLUDED.distance_in_eighths,
  distance_mm = EXCLUDED.distance_mm,
  notes = EXCLUDED.notes;

COMMIT;

-- Skipped rows from the source JSON:
-- Row 4: missing_install_distance | machine=A-32 | bar_feeder=C332
-- Row 5: missing_install_distance | machine=C-20 | bar_feeder=C320
-- Row 12: missing_install_distance | machine=Ganesh 52 TTMY | bar_feeder=V65 Servo
-- Row 14: missing_install_distance | machine=Ganesh 32CS | bar_feeder=Rebel V-65 Servo
-- Row 15: missing_install_distance | machine=Ganesh Cyclone 32 NCY | bar_feeder=Patriot 338
-- Row 16: missing_install_distance | machine=Ganesh 32CS | bar_feeder=Patriot 338
-- Row 19: missing_bar_feeder_model | machine=Hanwha XD20H | bar_feeder=
-- Row 37: missing_install_distance | machine=Star ST38 | bar_feeder=FMB Turbo 338
-- Row 49: missing_install_distance | machine=Tsugami BH38 | bar_feeder=Patriot 338
-- Row 53: missing_install_distance | machine=Tsugami GO 385L | bar_feeder=Patriot 338
-- Row 55: missing_install_distance | machine=Tsugami SS32 | bar_feeder=FMB Turbo 338
