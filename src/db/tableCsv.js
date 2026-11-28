const getCurrentTimestamp = () => new Date().toISOString().split('.')[0];
const extractIsoDate = (value) => /^(\d{4}-\d{2}-\d{2})(?=$|[T ])/.exec(value)?.[1] ?? null;

const QUOI_IMPORT_COLUMNS = new Set([
  'id',
  'nom',
  'genre',
  'pays',
  'domaine',
  'stock',
  'qualif',
  'remarque',
  'datedernierevisu',
  'date_aaaa',
  'date_mm',
  'date_jj',
  'modifts',
  'liendisk',
  'lienweb',
]);
const QUOI_INTEGER_COLUMNS = new Set(['date_aaaa', 'date_mm', 'date_jj']);
const QUOI_TEXT_LIMITS = {
  nom: 100,
  genre: 50,
  pays: 50,
  domaine: 50,
  stock: 50,
  qualif: 10,
  remarque: 5000,
  modifts: 20,
  liendisk: 100,
  lienweb: 100,
};
const QUI_INTEGER_COLUMNS = new Set([
  'datenaiss_aaaa', 'datenaiss_mm', 'datenaiss_jj',
  'datedeces_aaaa', 'datedeces_mm', 'datedeces_jj',
]);
const QUI_TEXT_LIMITS = {
  nom: 50,
  prenom: 50,
  fullname: 50,
  genre: 1,
  domaine: 50,
  pays: 50,
  style: 50,
  remarque: 5000,
  modifts: 20,
  liendisk: 100,
  lienweb: 100,
};
const QUI_IMPORT_COLUMNS = new Set(['id', ...Object.keys(QUI_TEXT_LIMITS), ...QUI_INTEGER_COLUMNS]);

const quoi = {
  table: 'quoi',
  columns: QUOI_IMPORT_COLUMNS,
  integers: QUOI_INTEGER_COLUMNS,
  textLimits: QUOI_TEXT_LIMITS,
  identityColumns: ['nom'],
  describe: row => row.nom,
};
const qui = {
  table: 'qui',
  columns: QUI_IMPORT_COLUMNS,
  integers: QUI_INTEGER_COLUMNS,
  textLimits: QUI_TEXT_LIMITS,
  identityColumns: ['nom', 'prenom'],
  describe: row => [row.prenom, row.nom].filter(Boolean).join(' '),
};
const MAX_CSV_IMPORT_ROWS = 3000;

const createImportError = (message, statusCode = 400, details = {}) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  Object.assign(error, details);
  return error;
};

const detectCsvDelimiter = (text) => {
  const firstLine = String(text).split(/\r?\n/, 1)[0] || '';
  const counts = new Map([['\t', 0], [';', 0], [',', 0]]);
  let quoted = false;
  for (let index = 0; index < firstLine.length; index += 1) {
    const char = firstLine[index];
    if (char === '"') {
      if (quoted && firstLine[index + 1] === '"') {
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (!quoted && counts.has(char)) {
      counts.set(char, counts.get(char) + 1);
    }
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
};

const parseCsv = (text) => {
  const delimiter = detectCsvDelimiter(text);
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quoted) {
      if (char === '"') {
        if (text[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          quoted = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"' && field.length === 0) {
      quoted = true;
    } else if (char === delimiter) {
      row.push(field);
      field = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[index + 1] === '\n') {
        index += 1;
      }
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += char;
    }
  }

  if (quoted) {
    throw createImportError('Le fichier CSV contient un champ entre guillemets non terminé.');
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
};

const normalizeImportValue = (schema, column, value, lineNumber) => {
  const text = String(value ?? '').trim();
  if (!text) {
    if (column === 'nom') {
      throw createImportError(`Nom manquant à la ligne ${lineNumber}.`);
    }
    return null;
  }
  if (text.includes('\u0000')) {
    throw createImportError(`Caractère interdit dans la colonne ${column}, ligne ${lineNumber}.`);
  }
  if (schema.integers.has(column)) {
    if (!/^-?\d+$/.test(text)) {
      throw createImportError(`Valeur entière invalide pour ${column}, ligne ${lineNumber}.`);
    }
    return text;
  }
  if (column === 'datedernierevisu') {
    const date = extractIsoDate(text);
    if (!date) {
      throw createImportError(`Date invalide pour datedernierevisu, ligne ${lineNumber}.`);
    }
    return date;
  }
  const maxLength = schema.textLimits[column];
  if (maxLength && text.length > maxLength) {
    throw createImportError(`${column} dépasse ${maxLength} caractères à la ligne ${lineNumber}.`);
  }
  return text;
};

const getIdentity = (schema, row) => JSON.stringify(schema.identityColumns.map(column =>
  String(row[column] ?? '').trim().toLocaleLowerCase('fr')
));

const prepareCsv = (schema, csvBuffer) => {
  const csvText = csvBuffer.toString('utf8');
  if (csvText.includes('\uFFFD')) {
    throw createImportError('Le fichier CSV doit être encodé en UTF-8.');
  }
  const records = parseCsv(csvText.replace(/^\uFEFF/, ''));
  if (records.length === 0) {
    throw createImportError('Le fichier CSV est vide.');
  }

  const headers = records[0].map((header) => String(header).trim().toLowerCase());
  if (headers.some((header) => !header)) {
    throw createImportError('La première ligne contient un nom de colonne vide.');
  }
  const duplicateHeaders = headers.filter((header, index) => headers.indexOf(header) !== index);
  if (duplicateHeaders.length > 0) {
    throw createImportError(`Colonnes en double : ${[...new Set(duplicateHeaders)].join(', ')}.`);
  }
  const invalidHeaders = headers.filter((header) => !schema.columns.has(header));
  if (invalidHeaders.length > 0) {
    throw createImportError(`Colonnes inconnues pour la table ${schema.table} : ${invalidHeaders.join(', ')}.`);
  }
  if (!headers.includes('nom')) {
    throw createImportError('La colonne nom est obligatoire.');
  }

  const importedRows = [];
  for (let recordIndex = 1; recordIndex < records.length; recordIndex += 1) {
    const values = records[recordIndex];
    if (values.every((value) => String(value).trim() === '')) {
      continue;
    }
    if (values.length > headers.length && values.slice(headers.length).some((value) => String(value).trim() !== '')) {
      throw createImportError(`Trop de colonnes à la ligne ${recordIndex + 1}.`);
    }
    const importedRow = {};
    headers.forEach((column, columnIndex) => {
      if (column !== 'id') {
        importedRow[column] = normalizeImportValue(schema, column, values[columnIndex], recordIndex + 1);
      }
    });
    if (schema === qui && !importedRow.fullname) {
      importedRow.fullname = normalizeImportValue(schema, 'fullname', qui.describe(importedRow), recordIndex + 1);
    }
    importedRows.push(importedRow);
  }

  if (importedRows.length === 0) {
    throw createImportError('Le fichier CSV ne contient aucune ligne de données.');
  }
  if (importedRows.length > MAX_CSV_IMPORT_ROWS) {
    throw createImportError(`Le fichier dépasse la limite de ${MAX_CSV_IMPORT_ROWS} lignes.`);
  }

  const seenNames = new Set();
  const duplicateNames = new Set();
  importedRows.forEach((row) => {
    const key = getIdentity(schema, row);
    if (seenNames.has(key)) {
      duplicateNames.add(schema.describe(row));
    }
    seenNames.add(key);
  });
  if (duplicateNames.size > 0) {
    throw createImportError('Le fichier CSV contient des noms en double.', 409, {
      duplicates: [...duplicateNames],
    });
  }

  const columns = headers.filter((header) => header !== 'id');
  if (schema === qui && !columns.includes('fullname')) {
    columns.push('fullname');
  }
  if (!columns.includes('modifts')) {
    columns.push('modifts');
  }
  const timestamp = getCurrentTimestamp();
  importedRows.forEach((row) => {
    if (!row.modifts) {
      row.modifts = timestamp;
    }
  });
  return { columns, rows: importedRows };
};

const insertCsv = async (schema, client, prepared) => {
  await client.query(`LOCK TABLE ${schema.table} IN SHARE ROW EXCLUSIVE MODE`);
  const { rows: existingRows } = await client.query(`SELECT ${schema.identityColumns.join(', ')} FROM ${schema.table}`);
  const existingNames = new Set(existingRows.map(row => getIdentity(schema, row)));
  const duplicates = prepared.rows
    .filter(row => existingNames.has(getIdentity(schema, row)))
    .map(schema.describe);
  if (duplicates.length > 0) {
    return { duplicates };
  }

  const { rows: idRows } = await client.query(`SELECT COALESCE(MAX(id), 0) AS max_id FROM ${schema.table}`);
  const firstId = Number.parseInt(idRows[0].max_id, 10) + 1;
  const insertColumns = ['id', ...prepared.columns];
  const params = [];
  const valueGroups = prepared.rows.map((row, rowIndex) => {
    const values = [firstId + rowIndex, ...prepared.columns.map((column) => row[column] ?? null)];
    const placeholders = values.map((value) => {
      params.push(value);
      return `$${params.length}`;
    });
    return `(${placeholders.join(', ')})`;
  });
  const { rowCount } = await client.query(
    `INSERT INTO ${schema.table} (${insertColumns.join(', ')}) VALUES ${valueGroups.join(', ')}`,
    params
  );
  return { inserted: rowCount };
};

module.exports = {
  createImportError,
  extractIsoDate,
  getCurrentTimestamp,
  insertQuisCsv: (client, prepared) => insertCsv(qui, client, prepared),
  insertQuoisCsv: (client, prepared) => insertCsv(quoi, client, prepared),
  prepareQuisCsv: csvBuffer => prepareCsv(qui, csvBuffer),
  prepareQuoisCsv: csvBuffer => prepareCsv(quoi, csvBuffer),
};
