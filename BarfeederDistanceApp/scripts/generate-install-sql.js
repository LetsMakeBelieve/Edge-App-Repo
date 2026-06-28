const fs = require('fs');
const path = require('path');

const jsonPath =
  process.argv[2] ||
  path.resolve(__dirname, '../../install-data/parsed-install-data.json');
const outputPath =
  process.argv[3] ||
  path.resolve(__dirname, '../../install-data/import-install-data.sql');

function normalizeKey(value) {
  return String(value ?? '').trim().replace(/\s+/g, ' ').toLowerCase();
}

function makeModelKey(manufacturer, name) {
  return `${normalizeKey(manufacturer)}::${normalizeKey(name)}`;
}

function sqlString(value) {
  if (value === null || value === undefined) {
    return 'NULL';
  }

  return `'${String(value).replace(/'/g, "''")}'`;
}

function sqlInt(value) {
  if (value === null || value === undefined || value === '') {
    return 'NULL';
  }

  return String(Number.parseInt(value, 10));
}

function buildNotes(record) {
  const parts = [];

  if (record.distance_context) {
    parts.push(`Distance context: ${record.distance_context}`);
  }

  if (record.modification_notes) {
    parts.push(`Install notes: ${record.modification_notes}`);
  }

  if (record.parameter_record) {
    parts.push(`Parameter record: ${record.parameter_record}`);
  }

  parts.push(`Imported from spreadsheet row ${record.source_row}`);

  return parts.join('\n');
}

function getUniqueModels(records, tableType) {
  const modelMap = new Map();

  records.forEach((record) => {
    if (tableType === 'lathe' && record.machine_model) {
      const manufacturer = record.lathe_manufacturer || 'Unknown';
      modelMap.set(makeModelKey(manufacturer, record.machine_model), {
        manufacturer,
        name: record.machine_model,
      });
    }

    if (tableType === 'barFeeder' && record.bar_feeder_model_normalized) {
      const manufacturer = record.bar_feeder_manufacturer_inferred || 'Edge Technologies';
      modelMap.set(makeModelKey(manufacturer, record.bar_feeder_model_normalized), {
        manufacturer,
        name: record.bar_feeder_model_normalized,
      });
    }
  });

  return [...modelMap.values()].sort((left, right) =>
    makeModelKey(left.manufacturer, left.name).localeCompare(
      makeModelKey(right.manufacturer, right.name)
    )
  );
}

function valuesList(rows, columns) {
  return rows
    .map(
      (row) =>
        `  (${columns
          .map((column) =>
            column.type === 'int' ? sqlInt(row[column.name]) : sqlString(row[column.name])
          )
          .join(', ')})`
    )
    .join(',\n');
}

if (!fs.existsSync(jsonPath)) {
  throw new Error(`JSON file not found: ${jsonPath}`);
}

const parsed = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
const records = parsed.records ?? [];
const latheModels = getUniqueModels(records, 'lathe');
const barFeederModels = getUniqueModels(records, 'barFeeder');
const distanceRows = records
  .filter(
    (record) =>
      record.machine_model &&
      record.bar_feeder_model_normalized &&
      record.distance_in_eighths
  )
  .map((record) => ({
    bar_feeder_manufacturer:
      record.bar_feeder_manufacturer_inferred || 'Edge Technologies',
    bar_feeder_model: record.bar_feeder_model_normalized,
    distance_in_eighths: record.distance_in_eighths,
    distance_mm: Math.round((record.distance_in_eighths * 25.4) / 8),
    lathe_manufacturer: record.lathe_manufacturer || 'Unknown',
    lathe_model: record.machine_model,
    notes: buildNotes(record),
    source_row: record.source_row,
  }));

const skippedRows = records
  .filter(
    (record) =>
      !record.machine_model ||
      !record.bar_feeder_model_normalized ||
      !record.distance_in_eighths
  )
  .map((record) => ({
    bar_feeder_model: record.bar_feeder_model_normalized,
    machine_model: record.machine_model,
    reason: record.review_flags.join(', '),
    source_row: record.source_row,
  }));

const sql = `-- Generated from ${parsed.source_file}
-- Review before running in Supabase SQL editor.
--
-- Counts:
--   Lathe models: ${latheModels.length}
--   Bar feeder models: ${barFeederModels.length}
--   Distance rows: ${distanceRows.length}
--   Skipped source rows: ${skippedRows.length}

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
${valuesList(latheModels, [
  { name: 'manufacturer' },
  { name: 'name' },
])};

INSERT INTO import_bar_feeders (manufacturer, name)
VALUES
${valuesList(barFeederModels, [
  { name: 'manufacturer' },
  { name: 'name' },
])};

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
${valuesList(distanceRows, [
  { name: 'source_row', type: 'int' },
  { name: 'lathe_manufacturer' },
  { name: 'lathe_model' },
  { name: 'bar_feeder_manufacturer' },
  { name: 'bar_feeder_model' },
  { name: 'distance_in_eighths', type: 'int' },
  { name: 'distance_mm', type: 'int' },
  { name: 'notes' },
])};

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
${skippedRows
  .map(
    (row) =>
      `-- Row ${row.source_row}: ${row.reason || 'not importable'} | machine=${row.machine_model || ''} | bar_feeder=${row.bar_feeder_model || ''}`
  )
  .join('\n')}
`;

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, sql);

console.log(`Generated ${outputPath}`);
console.log(
  JSON.stringify(
    {
      bar_feeder_models: barFeederModels.length,
      distance_rows: distanceRows.length,
      lathe_models: latheModels.length,
      skipped_rows: skippedRows.length,
    },
    null,
    2
  )
);
