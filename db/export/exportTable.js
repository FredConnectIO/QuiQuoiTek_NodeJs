//exporter les données: mode opératoire
// utiliser le bouton "Exporter les données" dans "index.html"

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'fred',
  port: Number(process.env.DB_PORT || 5432),
  database: process.env.DB_NAME || 'quiquoitekdb',
};

const sanitizeTableName = (tableName) => {
  if (typeof tableName !== 'string' || !tableName.trim()) {
    throw new Error('Invalid table name');
  }
  const trimmed = tableName.trim();
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(trimmed)) {
    throw new Error(`Unsafe table name: ${tableName}`);
  }
  return trimmed;
};

const formatCellValue = (value) => {
  if (value === null || value === undefined) {
    return '';
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (Array.isArray(value) || typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch (err) {
      return String(value);
    }
  }
  return String(value)
    .replace(/\t/g, ' ')
    .replace(/\r?\n/g, ' ');
};

async function exportTable(tableName, outputFile) {
  const client = new Client(dbConfig);
  const safeTable = sanitizeTableName(tableName);
  await client.connect();
  try {
    const query = `SELECT * FROM ${safeTable} ORDER BY id ASC`;
    const result = await client.query(query);
    const headers = result.fields.map((field) => field.name);
    const lines = [];
    lines.push(headers.join('\t'));
    result.rows.forEach((row) => {
      const cells = headers.map((header) => formatCellValue(row[header]));
      lines.push(cells.join('\t'));
    });
    const content = lines.join('\r\n');
    await fs.promises.mkdir(path.dirname(outputFile), { recursive: true });
    await fs.promises.writeFile(outputFile, content, 'utf8');
    return { rows: result.rowCount, file: outputFile };
  } finally {
    await client.end();
  }
}

module.exports = { exportTable };
