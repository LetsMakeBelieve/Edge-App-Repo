const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const jsonPath =
  process.argv[2] ||
  path.resolve(__dirname, '../../install-data/parsed-install-data.json');
const isDryRun = process.argv.includes('--dry-run');

function loadEnv(envPath) {
  if (!fs.existsSync(envPath)) {
    return;
  }

  fs.readFileSync(envPath, 'utf8')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))
    .forEach((line) => {
      const separatorIndex = line.indexOf('=');

      if (separatorIndex === -1) {
        return;
      }

      const key = line.slice(0, separatorIndex).trim();
      const value = line.slice(separatorIndex + 1).trim().replace(/^["']|["']$/g, '');

      if (!process.env[key]) {
        process.env[key] = value;
      }
    });
}

function normalizeKey(value) {
  return String(value ?? '').trim().replace(/\s+/g, ' ').toLowerCase();
}

function makeModelKey(manufacturer, name) {
  return `${normalizeKey(manufacturer)}::${normalizeKey(name)}`;
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
      const key = makeModelKey(manufacturer, record.machine_model);
      modelMap.set(key, {
        manufacturer,
        name: record.machine_model,
      });
    }

    if (tableType === 'barFeeder' && record.bar_feeder_model_normalized) {
      const manufacturer = record.bar_feeder_manufacturer_inferred || 'Edge Technologies';
      const key = makeModelKey(manufacturer, record.bar_feeder_model_normalized);
      modelMap.set(key, {
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

async function fetchModels(supabase, table) {
  const { data, error } = await supabase
    .from(table)
    .select('id, name, manufacturer')
    .order('manufacturer')
    .order('name');

  if (error) {
    throw new Error(`${table} fetch failed: ${error.message}`);
  }

  return data ?? [];
}

async function ensureModels(supabase, table, models) {
  const existingModels = await fetchModels(supabase, table);
  const byKey = new Map(
    existingModels.map((model) => [
      makeModelKey(model.manufacturer, model.name),
      model,
    ])
  );
  const toInsert = models.filter(
    (model) => !byKey.has(makeModelKey(model.manufacturer, model.name))
  );

  if (toInsert.length > 0) {
    const { data, error } = await supabase
      .from(table)
      .insert(toInsert)
      .select('id, name, manufacturer');

    if (error) {
      throw new Error(`${table} insert failed: ${error.message}`);
    }

    (data ?? []).forEach((model) => {
      byKey.set(makeModelKey(model.manufacturer, model.name), model);
    });
  }

  return {
    inserted: toInsert.length,
    map: byKey,
    total: byKey.size,
  };
}

async function upsertDistances(supabase, records, latheMap, barFeederMap) {
  const distanceRows = [];
  const skipped = [];

  records.forEach((record) => {
    if (
      !record.machine_model ||
      !record.bar_feeder_model_normalized ||
      !record.distance_in_eighths
    ) {
      skipped.push({
        reason: record.review_flags,
        source_row: record.source_row,
      });
      return;
    }

    const lathe = latheMap.get(
      makeModelKey(record.lathe_manufacturer || 'Unknown', record.machine_model)
    );
    const barFeeder = barFeederMap.get(
      makeModelKey(
        record.bar_feeder_manufacturer_inferred || 'Edge Technologies',
        record.bar_feeder_model_normalized
      )
    );

    if (!lathe || !barFeeder) {
      skipped.push({
        reason: ['missing_imported_model_id'],
        source_row: record.source_row,
      });
      return;
    }

    distanceRows.push({
      bar_feeder_id: barFeeder.id,
      distance_in_eighths: record.distance_in_eighths,
      distance_mm: Math.round((record.distance_in_eighths * 25.4) / 8),
      lathe_id: lathe.id,
      notes: buildNotes(record),
    });
  });

  if (distanceRows.length > 0) {
    const { error } = await supabase
      .from('distances')
      .upsert(distanceRows, {
        onConflict: 'lathe_id,bar_feeder_id',
      });

    if (error) {
      throw new Error(`distances upsert failed: ${error.message}`);
    }
  }

  return {
    skipped,
    upserted: distanceRows.length,
  };
}

async function main() {
  loadEnv(path.resolve(__dirname, '../.env'));

  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!fs.existsSync(jsonPath)) {
    throw new Error(`JSON file not found: ${jsonPath}`);
  }

  const parsed = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  const records = parsed.records ?? [];
  const latheModels = getUniqueModels(records, 'lathe');
  const barFeederModels = getUniqueModels(records, 'barFeeder');
  const importableDistances = records.filter(
    (record) =>
      record.machine_model &&
      record.bar_feeder_model_normalized &&
      record.distance_in_eighths
  );

  console.log(
    JSON.stringify(
      {
        bar_feeder_models_to_ensure: barFeederModels.length,
        dry_run: isDryRun,
        install_records_in_json: records.length,
        lathe_models_to_ensure: latheModels.length,
        source_file: parsed.source_file,
        upsertable_distances: importableDistances.length,
      },
      null,
      2
    )
  );

  if (isDryRun) {
    return;
  }

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      'Set EXPO_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env before uploading.'
    );
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
    },
  });

  const latheResult = await ensureModels(supabase, 'lathes', latheModels);
  const barFeederResult = await ensureModels(
    supabase,
    'bar_feeders',
    barFeederModels
  );
  const distanceResult = await upsertDistances(
    supabase,
    records,
    latheResult.map,
    barFeederResult.map
  );

  console.log(
    JSON.stringify(
      {
        bar_feeders_inserted: barFeederResult.inserted,
        bar_feeders_total_seen: barFeederResult.total,
        distances_skipped: distanceResult.skipped.length,
        distances_upserted: distanceResult.upserted,
        lathes_inserted: latheResult.inserted,
        lathes_total_seen: latheResult.total,
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
