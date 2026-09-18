const { Client } = require('pg');

const client = new Client({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'fred',
  port: Number(process.env.DB_PORT || 5432),
  database: process.env.DB_NAME || 'quiquoitekdb',
});

const allowNullNomQuery = `
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'role'
      AND column_name = 'nom'
  ) THEN
    ALTER TABLE public.role
      ALTER COLUMN nom DROP NOT NULL;
  ELSE
    RAISE NOTICE 'La colonne public.role.nom est introuvable.';
  END IF;
END $$;
`;

async function run() {
  try {
    await client.connect();
    console.log('Connexion PostgreSQL ouverte');
    await client.query(allowNullNomQuery);
    console.log('La colonne public.role.nom accepte désormais NULL.');
  } catch (err) {
    console.error('Erreur lors de la modification de public.role.nom :', err);
    process.exitCode = 1;
  } finally {
    await client.end();
    console.log('Connexion PostgreSQL fermée');
  }
}

run();
