const { Client } = require('pg');

async function run() {
  const client = new Client({
    host: 'localhost',
    user: 'postgres',
    password: 'fred',
    database: 'quiquoitekdb',
    port: 5432,
  });

  const updateQuery = `
    UPDATE quoi
    SET nom = regexp_replace(nom, '^(.*?)\\s*/\\s*(.*)$', '\\1 (' || date_aaaa::text || ') - \\2')
    WHERE nom ~ '\\S+\\s*/\\s*\\S+'
      AND date_aaaa IS NOT NULL
  `;

  try {
    await client.connect();
    console.log('Connected to PostgreSQL');

    const countBeforeResult = await client.query(`
      SELECT COUNT(*) AS count
      FROM quoi
      WHERE nom ~ '\\S+\\s*/\\s*\\S+'
        AND date_aaaa IS NOT NULL
    `);
    const countBefore = Number(countBeforeResult.rows[0].count);
    console.log(`${countBefore} enregistrements potentiels avant mise à jour.`);

    await client.query('BEGIN');

    const result = await client.query(updateQuery);
    console.log(`${result.rowCount} ligne(s) mises à jour.`);

    await client.query('COMMIT');

    const countAfterResult = await client.query(`
      SELECT COUNT(*) AS count
      FROM quoi
      WHERE nom ~ '\\S+\\s*/\\s*\\S+'
        AND date_aaaa IS NOT NULL
    `);
    const countAfter = Number(countAfterResult.rows[0].count);
    console.log(`${countAfter} enregistrements restant après mise à jour.`);
    console.log('Migration terminée avec succès.');
  } catch (error) {
    console.error('Migration failed:', error.message);
    try {
      await client.query('ROLLBACK');
    } catch (rollbackError) {
      console.error('Rollback failed:', rollbackError.message);
    }
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

run();
