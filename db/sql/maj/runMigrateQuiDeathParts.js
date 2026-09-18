const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

async function run() {
  const sqlFile = path.resolve(__dirname, 'migrateQuiDeathParts.sql');
  const sql = fs.readFileSync(sqlFile, 'utf8');

  const client = new Client({
    host: 'localhost',
    user: 'postgres',
    password: 'fred',
    database: 'quiquoitekdb',
    port: 5432,
  });

  try {
    await client.connect();
    console.log('Connected to PostgreSQL');
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('COMMIT');
    console.log('Migration completed successfully.');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Migration failed:', error);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

run();
