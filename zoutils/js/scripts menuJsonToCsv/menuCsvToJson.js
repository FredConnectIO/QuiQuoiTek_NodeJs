#!/usr/bin/env node
/**
 * Convert a tab separated CSV containing menu definitions into the JSON structure
 * expected by the diaporama application.
 *
 * Usage:
 *   node scripts/menuCsvToJson.js input.tsv [output.json]
 *
 * Expected columns inside the TSV:
 *   link, menuTitle, itemTitle, method, action, shortcutKey,
 *   shortcutAccel, shortcutShift, parameter, executeWithoutValidating,
 *   isSeparator, enabled
 *
 * Columns can be left empty. Boolean columns accept: true/false, 1/0, yes/no, oui/non.
 */
const fs = require('fs');
const path = require('path');

const REQUIRED_COLUMNS = ['link', 'menuTitle', 'itemTitle'];

const OPTIONAL_COLUMNS = [
  'method',
  'action',
  'shortcutKey',
  'shortcutAccel',
  'shortcutShift',
  'parameter',
  'executeWithoutValidating',
  'isSeparator',
  'enabled',
];

const ALL_COLUMNS = [...REQUIRED_COLUMNS, ...OPTIONAL_COLUMNS];

function exitWithUsage(message) {
  const scriptName = path.basename(process.argv[1]);
  if (message) {
    console.error(`\n${message}\n`);
  }
  console.error(
    [
      `Usage: node ${scriptName} <input.tsv> [output.json]`,
      '',
      'The input file must be a tab separated values file that uses the following headers:',
      `  ${ALL_COLUMNS.join(', ')}`,
    ].join('\n'),
  );
  process.exit(1);
}

function parseArgs() {
  const [, , inputPath, outputPath] = process.argv;
  if (!inputPath) {
    exitWithUsage('Missing <input.tsv> argument.');
  }
  return { inputPath, outputPath };
}

function readFileContent(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch (error) {
    console.error(`Unable to read file "${filePath}": ${error.message}`);
    process.exit(1);
  }
}

function parseBoolean(rawValue) {
  if (rawValue === undefined || rawValue === null) {
    return undefined;
  }

  const normalized = String(rawValue).trim();
  if (normalized === '') {
    return undefined;
  }

  const lower = normalized.toLowerCase();
  if (['true', '1', 'yes', 'y', 'oui'].includes(lower)) {
    return true;
  }
  if (['false', '0', 'no', 'n', 'non'].includes(lower)) {
    return false;
  }

  return undefined;
}

function parseNumber(rawValue) {
  if (rawValue === undefined || rawValue === null) {
    return undefined;
  }
  const trimmed = String(rawValue).trim();
  if (trimmed === '') {
    return undefined;
  }
  const numeric = Number(trimmed);
  return Number.isNaN(numeric) ? undefined : numeric;
}

function sanitizeValue(value) {
  if (value === undefined || value === null) {
    return undefined;
  }
  const trimmed = String(value).trim();
  return trimmed === '' ? undefined : trimmed;
}

function buildItem(row) {
  const item = {};
  const title = sanitizeValue(row.itemTitle);
  const method = sanitizeValue(row.method);
  const action = sanitizeValue(row.action);
  const shortcutKey = sanitizeValue(row.shortcutKey);
  const parameter = sanitizeValue(row.parameter);
  const executeWithoutValidating = parseBoolean(row.executeWithoutValidating);
  const shortcutAccel = parseBoolean(row.shortcutAccel);
  const shortcutShift = parseBoolean(row.shortcutShift);
  const isSeparator = parseBoolean(row.isSeparator);
  const enabled = parseBoolean(row.enabled);

  if (!title && !isSeparator) {
    return null;
  }

  if (title) {
    item.title = title;
  }
  if (method) {
    item.method = method;
  }
  if (action) {
    item.action = action;
  }
  if (parameter) {
    item.parameter = parameter;
  }
  if (shortcutKey) {
    item.shortcutKey = shortcutKey;
  }
  if (shortcutAccel !== undefined) {
    item.shortcutAccel = shortcutAccel;
  }
  if (shortcutShift !== undefined) {
    item.shortcutShift = shortcutShift;
  }
  if (executeWithoutValidating !== undefined) {
    item.executeWithoutValidating = executeWithoutValidating;
  }
  if (isSeparator !== undefined) {
    item.isSeparator = isSeparator;
  }
  if (enabled !== undefined) {
    item.enabled = enabled;
  }

  return item;
}

function validateHeaders(headers) {
  const missing = REQUIRED_COLUMNS.filter((column) => !headers.includes(column));
  if (missing.length > 0) {
    exitWithUsage(`Missing required column(s): ${missing.join(', ')}`);
  }
}

function parseTsv(content) {
  const lines = content
    .split(/\r?\n/)
    .map((line) => line.replace(/^\uFEFF/, ''))
    .filter((line) => line.trim() !== '');

  if (lines.length === 0) {
    console.error('Input file does not contain any data.');
    process.exit(1);
  }

  const headers = lines[0].split('\t').map((header) => header.trim());
  validateHeaders(headers);

  const records = lines.slice(1).map((line, index) => {
    const cells = line.split('\t');
    if (cells.length !== headers.length) {
      console.warn(
        `Warning: Line ${index + 2} has ${cells.length} columns but ${headers.length} headers. Extra cells will be ignored.`,
      );
    }
    const entry = {};
    headers.forEach((header, cellIndex) => {
      entry[header] = cells[cellIndex] !== undefined ? cells[cellIndex] : '';
    });
    return entry;
  });

  return { headers, records };
}

function rowsToMenus(records) {
  const menusByLink = new Map();

  records.forEach((row) => {
    const linkRaw = sanitizeValue(row.link);
    if (!linkRaw) {
      console.warn('Skipping row without link value.');
      return;
    }

    const linkNumber = parseNumber(linkRaw);
    const link = linkNumber !== undefined ? linkNumber : linkRaw;

    const menuTitle = sanitizeValue(row.menuTitle);
    if (!menuTitle) {
      console.warn(`Skipping row with link ${link} because menuTitle is empty.`);
      return;
    }

    if (!menusByLink.has(link)) {
      menusByLink.set(link, {
        link,
        title: menuTitle,
        items: [],
      });
    }

    const menu = menusByLink.get(link);
    const item = buildItem(row);
    if (item) {
      menu.items.push(item);
    }
  });

  return Array.from(menusByLink.values());
}

function main() {
  const { inputPath, outputPath } = parseArgs();
  const tsvContent = readFileContent(inputPath);
  const { records } = parseTsv(tsvContent);
  const menus = rowsToMenus(records);

  const json = JSON.stringify({ menus }, null, 2);

  if (outputPath) {
    try {
      fs.writeFileSync(outputPath, `${json}\n`, 'utf8');
    } catch (error) {
      console.error(`Unable to write output file "${outputPath}": ${error.message}`);
      process.exit(1);
    }
  } else {
    process.stdout.write(`${json}\n`);
  }
}

main();
