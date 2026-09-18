const { Client } = require('pg');

const client = new Client({
  host: 'localhost',
  user: 'postgres',
  password: 'fred',
  database: 'quiquoitekdb',
  port: 5432,
});

const alterColumnLengthQuery = `
DO $$
BEGIN
      ALTER TABLE public.parametre
      DROP COLUMN niv2;
END $$;
`;

async function run() {
  try {
    await client.connect();
    console.log('Connected to PostgreSQL');
    console.log('avant query...');
    await client.query(alterColumnLengthQuery);
    console.log('query OK.');
  } catch (error) {
    console.error('Error while altering parametre:', error);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

run();
