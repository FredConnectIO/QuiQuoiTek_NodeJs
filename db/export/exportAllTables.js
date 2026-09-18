const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
const { exportTable } = require('./exportTable');

const DB_CONFIG = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'fred',
  port: Number(process.env.DB_PORT || 5432),
  database: process.env.DB_NAME || 'quiquoitekdb',
};

const buildOutputDir = () => {
  const now = new Date();
  const pad = (value) => String(value).padStart(2, '0');
  const date = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
  const time = `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  return path.resolve(__dirname, `csv ${date} ${time}`);
};

const buildOutputSuffix = () => {
  const now = new Date();
  const pad = (value) => String(value).padStart(2, '0');
  const date = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
  const time = `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  return `${date} ${time}`;
};

async function fetchPublicTables() {
  const client = new Client(DB_CONFIG);
  await client.connect();
  try {
    const sql = `
      SELECT tablename
      FROM pg_catalog.pg_tables
      WHERE schemaname = 'public'
      ORDER BY tablename
    `;
    const { rows } = await client.query(sql);
    return rows.map((row) => row.tablename);
  } finally {
    await client.end();
  }
}

async function exportAllTables() {
  const OUTPUT_DIR = buildOutputDir();
  const OUTPUT_SUFFIX = buildOutputSuffix();
  await fs.promises.mkdir(OUTPUT_DIR, { recursive: true });
  const tables = await fetchPublicTables();
  if (!tables.length) {
    console.log('Aucune table trouvée dans le schéma public.');
    return { tables: [], outputDir: OUTPUT_DIR };
  }

  console.log(`Tables détectées: ${tables.join(', ')}`);
  const results = [];

  for (const tableName of tables) {
    const outputFile = path.join(OUTPUT_DIR, `${tableName} ${OUTPUT_SUFFIX}.csv`);
    try {
      const { rows, file } = await exportTable(tableName, outputFile);
      console.log(`Exporté ${rows} lignes de ${tableName} -> ${file}`);
      results.push({ table: tableName, rows, file });
    } catch (error) {
      console.error(`Erreur export ${tableName}:`, error);
      throw error;
    }
  }

  console.log('Export complet terminé.');
  return { tables: results, outputDir: OUTPUT_DIR };
}

if (require.main === module) {
  exportAllTables().catch((err) => {
    console.error('exportAllTables échoué:', err);
    process.exitCode = 1;
  });
}

module.exports = { exportAllTables };
