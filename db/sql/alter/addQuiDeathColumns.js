const { Client } = require('pg');

const client = new Client({
  host: 'localhost',
  user: 'postgres',
  password: 'fred',
  database: 'quiquoitekdb',
  port: 5432,
});

const columnsToAdd = [
  { name: 'datedeces_aaaa', type: 'integer' },
  { name: 'datedeces_mm', type: 'integer' },
  { name: 'datedeces_jj', type: 'integer' },
];

const buildEnsureColumnQuery = (column) => `
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'qui'
      AND column_name = '${column.name}'
  ) THEN
    ALTER TABLE public.qui
      ADD COLUMN ${column.name} ${column.type};
  END IF;
END$$;
`;

async function run() {
  try {
    await client.connect();
    console.log('Connected to PostgreSQL');
    for (const column of columnsToAdd) {
      console.log(`Ensuring column ${column.name} exists...`);
      await client.query(buildEnsureColumnQuery(column));
    }
    console.log('All required columns are present.');
  } catch (error) {
    console.error('Error while adding columns to public.qui:', error);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

run();
