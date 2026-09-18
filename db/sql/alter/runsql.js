const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

/**
 * Accept either raw SQL text or a path to a .sql file and execute it.
 */
async function runSql(sqlInput) {
  if (!sqlInput) {
    throw new Error('SQL query parameter is required.');
  }

  let sqlQuery = sqlInput;

  // If the argument points to a file, read its content instead of sending the filename to PostgreSQL.
  const asPassedPath = path.resolve(sqlInput);
  const relativeToScriptPath = path.join(__dirname, sqlInput);

  if (fs.existsSync(asPassedPath) && fs.statSync(asPassedPath).isFile()) {
    sqlQuery = await fs.promises.readFile(asPassedPath, 'utf8');
    console.log(`Executing SQL from file: ${asPassedPath}`);
  } else if (
    fs.existsSync(relativeToScriptPath) &&
    fs.statSync(relativeToScriptPath).isFile()
  ) {
    sqlQuery = await fs.promises.readFile(relativeToScriptPath, 'utf8');
    console.log(`Executing SQL from file: ${relativeToScriptPath}`);
  }

  if (!sqlQuery || !sqlQuery.trim()) {
    throw new Error('The SQL query is empty.');
  }

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
    await client.query(sqlQuery);
    console.log('Query executed.');
  } catch (error) {
    console.error('Error while executing query:', error);
    throw error;
  } finally {
    await client.end();
  }
}

if (require.main === module) {
  const sqlQuery = process.argv.slice(2).join(' ').trim();

  if (!sqlQuery) {
    console.error('Usage: node runsql.js "<SQL query>" | node runsql.js <file.sql>');
    process.exit(1);
  }

  runSql(sqlQuery).catch(() => {
    process.exitCode = 1;
  });
}

module.exports = runSql;
