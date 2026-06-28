const fs = require('fs');
const path = require('path');

const inputPath =
  process.argv[2] ||
  path.resolve(__dirname, '../../install-data/Machine Install Data(Sheet1).csv');
const outputPath =
  process.argv[3] ||
  path.resolve(__dirname, '../../install-data/parsed-install-data.json');

const edgeModelPatterns = [
  /\bmm\s*\d+/i,
  /\bminute\s*man\b/i,
  /\bminuteman\b/i,
  /\bpatriot\b/i,
  /\brebel\b/i,
  /\bv[-\s]?\d+\b/i,
  /\bmls[-\s]?\d+\b/i,
  /\bc\d{3}\b/i,
];

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const nextChar = text[index + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        field += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === ',' && !inQuotes) {
      row.push(field);
      field = '';
      continue;
    }

    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') {
        index += 1;
      }
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      continue;
    }

    field += char;
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}

function cleanText(value) {
  const cleaned = String(value ?? '').replace(/\s+/g, ' ').trim();
  return cleaned || null;
}

function normalizeBarFeederModel(value) {
  const cleaned = cleanText(value);

  if (!cleaned) {
    return null;
  }

  return cleaned
    .replace(/\bMM\s*(\d+)/gi, 'Minuteman $1')
    .replace(/\bMinute\s+Man\b/gi, 'Minuteman')
    .replace(/\s+/g, ' ')
    .trim();
}

function inferBarFeederManufacturer(model) {
  if (!model) {
    return null;
  }

  if (/\bfmb\b/i.test(model)) {
    return 'FMB';
  }

  if (edgeModelPatterns.some((pattern) => pattern.test(model))) {
    return 'Edge Technologies';
  }

  return null;
}

function parseDistance(value) {
  const original = cleanText(value);

  if (!original) {
    return {
      distance_context: null,
      distance_display: null,
      distance_in_eighths: null,
      distance_in_inches_decimal: null,
      distance_original: null,
    };
  }

  const normalized = original.replace(/"/g, '').trim();
  let match = normalized.match(/^(\d+)\s+(\d+)\/(\d+)\b(.*)$/);

  if (match) {
    const whole = Number.parseInt(match[1], 10);
    const numerator = Number.parseInt(match[2], 10);
    const denominator = Number.parseInt(match[3], 10);
    const fractionEighths = Math.round((numerator / denominator) * 8);
    const eighths = whole * 8 + fractionEighths;

    return {
      distance_context: cleanText(match[4]),
      distance_display: formatEighths(eighths),
      distance_in_eighths: eighths,
      distance_in_inches_decimal: eighths / 8,
      distance_original: original,
    };
  }

  match = normalized.match(/^(\d+(?:\.\d+)?)(.*)$/);

  if (!match) {
    return {
      distance_context: original,
      distance_display: null,
      distance_in_eighths: null,
      distance_in_inches_decimal: null,
      distance_original: original,
    };
  }

  const decimal = Number.parseFloat(match[1]);
  const eighths = Math.round(decimal * 8);

  return {
    distance_context: cleanText(match[2]),
    distance_display: formatEighths(eighths),
    distance_in_eighths: eighths,
    distance_in_inches_decimal: eighths / 8,
    distance_original: original,
  };
}

function formatEighths(eighths) {
  const whole = Math.floor(eighths / 8);
  const remainder = eighths % 8;
  const fractions = {
    1: '1/8',
    2: '1/4',
    3: '3/8',
    4: '1/2',
    5: '5/8',
    6: '3/4',
    7: '7/8',
  };

  if (!remainder) {
    return `${whole} in`;
  }

  return `${whole} ${fractions[remainder]} in`;
}

function isBlankRow(cells) {
  return cells.every((cell) => !cleanText(cell));
}

function isSectionRow(cells) {
  return cleanText(cells[0]) && !cleanText(cells[1]) && !cleanText(cells[2]);
}

function isLikelyBarFeederModel(value) {
  const cleaned = normalizeBarFeederModel(value);

  if (!cleaned) {
    return false;
  }

  return inferBarFeederManufacturer(cleaned) || (cleaned.length <= 30 && /\d/.test(cleaned));
}

function isSectionNoteRow(cells) {
  return (
    cleanText(cells[0]) &&
    cleanText(cells[1]) &&
    !cleanText(cells[2]) &&
    !cleanText(cells[3]) &&
    !cleanText(cells[4]) &&
    !isLikelyBarFeederModel(cells[1])
  );
}

function buildRecord(cells, sourceRow, currentSection) {
  const machineModel = cleanText(cells[0]);
  const barFeederOriginal = cleanText(cells[1]);
  const barFeederNormalized = normalizeBarFeederModel(cells[1]);
  const distance = parseDistance(cells[2]);
  const modificationNotes = cleanText(cells[3]);
  const parameterRecord = cleanText(cells[4]);
  const inferredManufacturer = inferBarFeederManufacturer(barFeederNormalized);
  const reviewFlags = [];

  if (!machineModel) {
    reviewFlags.push('missing_machine_model');
  }

  if (!barFeederNormalized) {
    reviewFlags.push('missing_bar_feeder_model');
  }

  if (!inferredManufacturer && barFeederNormalized) {
    reviewFlags.push('bar_feeder_manufacturer_needs_review');
  }

  if (distance.distance_original && !distance.distance_in_eighths) {
    reviewFlags.push('distance_needs_review');
  }

  if (!distance.distance_in_eighths) {
    reviewFlags.push('missing_install_distance');
  }

  return {
    source_row: sourceRow,
    lathe_manufacturer: currentSection,
    machine_model: machineModel,
    bar_feeder_model_original: barFeederOriginal,
    bar_feeder_model_normalized: barFeederNormalized,
    bar_feeder_manufacturer_inferred: inferredManufacturer,
    ...distance,
    modification_notes: modificationNotes,
    parameter_record: parameterRecord,
    review_flags: reviewFlags,
  };
}

const csvText = fs.readFileSync(inputPath, 'utf8');
const rows = parseCsv(csvText);
const headers = rows[0].map((header) => cleanText(header));
const records = [];
const skipped_rows = [];
const section_notes = [];
const manufacturer_sections = [];
let currentSection = null;

rows.slice(1).forEach((cells, index) => {
  const sourceRow = index + 2;
  const paddedCells = [...cells, '', '', '', '', ''].slice(0, 5);

  if (isBlankRow(paddedCells)) {
    skipped_rows.push({ reason: 'blank_row', source_row: sourceRow });
    return;
  }

  if (isSectionRow(paddedCells)) {
    currentSection = cleanText(paddedCells[0]);
    manufacturer_sections.push({ name: currentSection, source_row: sourceRow });
    return;
  }

  if (isSectionNoteRow(paddedCells)) {
    currentSection = cleanText(paddedCells[0]);
    section_notes.push({
      note: cleanText(paddedCells[1]),
      section: currentSection,
      source_row: sourceRow,
    });
    return;
  }

  records.push(buildRecord(paddedCells, sourceRow, currentSection));
});

const output = {
  source_file: inputPath,
  headers,
  stats: {
    total_csv_rows_including_header: rows.length,
    parsed_install_records: records.length,
    blank_rows_skipped: skipped_rows.length,
    manufacturer_sections: manufacturer_sections.length,
    section_notes: section_notes.length,
    records_missing_distance: records.filter((record) =>
      record.review_flags.includes('missing_install_distance')
    ).length,
    records_missing_bar_feeder: records.filter((record) =>
      record.review_flags.includes('missing_bar_feeder_model')
    ).length,
    records_needing_manufacturer_review: records.filter((record) =>
      record.review_flags.includes('bar_feeder_manufacturer_needs_review')
    ).length,
  },
  manufacturer_sections,
  section_notes,
  records,
  skipped_rows,
};

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`);

console.log(`Parsed ${records.length} install records`);
console.log(`Wrote ${outputPath}`);
