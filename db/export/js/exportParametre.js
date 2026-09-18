const path = require('path');
const { exportTable } = require('./exportTable');

const TABLE_NAME = 'parametre';
const OUTPUT_FILE = path.resolve(__dirname, 'csv', `${TABLE_NAME}.csv`);

async function run() {
  try {
    const { rows, file } = await exportTable(TABLE_NAME, OUTPUT_FILE);
    console.log(`Export ${rows} lignes de ${TABLE_NAME} -> ${file}`);
    process.exit(0);
  } catch (error) {
    console.error(`Export ${TABLE_NAME} KO`, error);
    process.exit(1);
  }
}

run();
