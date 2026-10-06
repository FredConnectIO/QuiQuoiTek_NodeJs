#!/usr/bin/env node
/**
 * Convert a menu JSON file into a tab-separated values (TSV/CSV) file.
 *
 * Usage:
 *   node scripts/menuJsonToCsv.js input.json [output.tsv]
 *
 * If output is omitted, the TSV content is written to stdout.
 */
const fs = require('fs');
const path = require('path');

const HEADERS = [
  'link',
  'menuTitle',
  'itemTitle',
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

function exitWithUsage(message) {
  const scriptName = path.basename(process.argv[1]);
  if (message) {
    console.error(`\n${message}\n`);
  }
  console.error(
    [
      `Usage: node ${scriptName} <input.json> [output.tsv]`,
      '',
      'The JSON file must contain either an array of menus or an object with a "menus" array.',
    ].join('\n'),
  );
  process.exit(1);
}

function parseArgs() {
  const [, , inputPath, outputPath] = process.argv;
  if (!inputPath) {
    exitWithUsage('Missing <input.json> argument.');
  }
  return { inputPath, outputPath };
}

function readJsonFile(filePath) {
  try {
    const rawContent = fs.readFileSync(filePath, 'utf8').trim();
    const normalized = rawContent.startsWith('{') || rawContent.startsWith('[')
      ? rawContent
      : `{${rawContent.replace(/^[\s,]*/, '')}}`;
    return JSON.parse(normalized);
  } catch (error) {
    console.error(`Unable to read or parse JSON from "${filePath}": ${error.message}`);
    process.exit(1);
  }
}

function normalizeMenus(jsonData) {
  if (Array.isArray(jsonData)) {
    return jsonData;
  }
  if (jsonData && Array.isArray(jsonData.menus)) {
    return jsonData.menus;
  }
  exitWithUsage('Input JSON does not contain a "menus" array.');
  return [];
}

function booleanToString(value) {
  if (value === undefined) {
    return '';
  }
  return value ? 'true' : 'false';
}

function sanitizeCell(value) {
  if (value === undefined || value === null) {
    return '';
  }
  return String(value).replace(/\r?\n/g, ' ').trim();
}

function menuItemsToRows(menus) {
  const rows = [];
  menus.forEach((menu) => {
    const link = sanitizeCell(menu.link);
    const menuTitle = sanitizeCell(menu.title);
    if (!menu.items || !Array.isArray(menu.items)) {
      return;
    }
    menu.items.forEach((item) => {
      rows.push([
        link,
        menuTitle,
        sanitizeCell(item.title),
        sanitizeCell(item.method),
        sanitizeCell(item.action),
        sanitizeCell(item.shortcutKey),
        booleanToString(item.shortcutAccel),
        booleanToString(item.shortcutShift),
        sanitizeCell(item.parameter),
        booleanToString(item.executeWithoutValidating),
        booleanToString(item.isSeparator),
        item.enabled === undefined ? '' : booleanToString(item.enabled),
      ]);
    });
  });
  return rows;
}

function toTsv(rows) {
  return [HEADERS.join('\t'), ...rows.map((cells) => cells.join('\t'))].join('\n');
}

function writeOutput(content, outputPath) {
  if (outputPath) {
    try {
      fs.writeFileSync(outputPath, `${content}\n`, 'utf8');
    } catch (error) {
      console.error(`Unable to write "${outputPath}": ${error.message}`);
      process.exit(1);
    }
  } else {
    process.stdout.write(`${content}\n`);
  }
}

function main() {
  const { inputPath, outputPath } = parseArgs();
  const jsonData = readJsonFile(inputPath);
  const menus = normalizeMenus(jsonData);
  const rows = menuItemsToRows(menus);
  const tsv = toTsv(rows);
  writeOutput(tsv, outputPath);
}

main();
