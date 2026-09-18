const db = require('../db');
const path = require('path')
const fs = require('fs')
var listIdQuoi=";"
const projectRoot = path.resolve(__dirname, '..', '..');
const DEFAULT_IMAGE_VARIANT = '001';
const photosRoot = path.resolve('C:\\PARTAGE\\QQT_Data\\Photos');

const fallbackImage = path.resolve(projectRoot, 'public', 'img', 'ko.jpg');
const TRANSPARENT_PIXEL_BUFFER = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNgYGBgAAAABQABDQottAAAAABJRU5ErkJggg==',
  'base64'
);

const getCurrentTimestamp = () => new Date().toISOString().split('.')[0];

const sanitizeVariant = (variant) => {
  if (typeof variant === 'number') {
    return String(variant).padStart(3, '0');
  }
  if (typeof variant !== 'string') {
    return DEFAULT_IMAGE_VARIANT;
  }
  const digits = variant.trim().replace(/\D/g, '');
  if (!digits) {
    return DEFAULT_IMAGE_VARIANT;
  }
  return digits.slice(0, 3).padStart(3, '0');
};

exports.getAllQuoi = async (req, res) => {
  console.log("getAllQuoi")
  listIdQuoi=";"
  try {
    const { rows } = await db.query(
      'SELECT id, nom, domaine, genre, pays, stock, qualif, datedernierevisu, date_aaaa FROM quoi ORDER BY nom'
    );
    rows.forEach(quoi => {
      listIdQuoi+=quoi.id.toString().padStart(7, "0")+";";
    })
    //console.log("listIdQuoi"+listIdQuoi)
    res.json(rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: err.message });
  }
};

exports.getQuoiById = async (req, res) => {
  console.log("getQuoiById")
  
  try {
    const { id } = req.params;
    const { rows } = await db.query(
      `SELECT id, nom, domaine, genre, pays, stock, qualif, remarque,
              liendisk,
              lienweb,
              datedernierevisu,
              date_aaaa, date_mm, date_jj, modifts
         FROM quoi
        WHERE id = $1`,
      [id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Quoi not found' });
    }
    var row0=rows[0];
    //position du id Suivant:
    const posIdSuivant =listIdQuoi.indexOf(';'+id.padStart(7, "0")+";")+9 //debut du suivant
    row0.idSuivant=listIdQuoi.substring(posIdSuivant,posIdSuivant+7);
    //position du id precedent:
    const posIdPrecedent=posIdSuivant - 16
    if (posIdPrecedent>0) {
      row0.idPrecedent=listIdQuoi.substring(posIdPrecedent,posIdPrecedent+7);
    } else {
      row0.idPrecedent=0;
    }
    res.json(row0);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: err.message });
  }
};

exports.getImgQuoiById = async (req, res) => {
  const { id } = req.params;
  const variant = sanitizeVariant(req.query.variant);
  const requestedImage = resolveImagePath(id, variant);
  console.log("getImgQuoiById "+requestedImage)
  let imgPath = fallbackImage;
  if (fs.existsSync(requestedImage)) {
    imgPath = requestedImage;
  }

  res.setHeader('Cache-Control', 'no-store');
  res.sendFile(imgPath, (err) => {
    if (err) {
      console.error('Unable to send image', err);
      if (!res.headersSent) {
        res.status(err.statusCode || 500).end();
      }
    }
  });
};

exports.saveImgQuoi = async (req, res) => {
  console.log("saveImgQuoi")
  const { id } = req.params;
  const variant = sanitizeVariant(req.query.variant);
  if (!id) {
    return res.status(400).json({ error: 'Identifiant invalide' });
  }

  try {
    await fs.promises.access(photosRoot, fs.constants.F_OK | fs.constants.W_OK);
  } catch (err) {
    console.error('Directory check failed:', err);
    return res.status(500).json({ error: "Dossier cible introuvable ou inaccessible" });
  }

  if (!req.file || !req.file.buffer) {
    return res.status(400).json({ error: 'Aucun fichier fourni' });
  }

  const destinationPath = resolveImagePath(id, variant);
  try {
    await fs.promises.writeFile(destinationPath, req.file.buffer);
    res.status(200).json({ message: 'Image enregistree', variant });
  } catch (err) {
    console.error('Unable to save quoi image', err);
    res.status(500).json({ error: err.message });
  }
};

exports.checkImgQuoiVariantExists = async (req, res) => {
  const { id, variant: variantParam } = req.params;
  const variant = sanitizeVariant(variantParam);
  const filePath = resolveImagePath(id, variant);
  try {
    const exists = await doesFileExist(filePath);
    res.json({ exists });
  } catch (err) {
    console.error('Unable to check quoi image existence', err);
    res.status(500).json({ error: err.message });
  }
};

exports.ensureImgQuoiVariant = async (req, res) => {
  const { id, variant: variantParam } = req.params;
  const variant = sanitizeVariant(variantParam);
  const filePath = resolveImagePath(id, variant);

  try {
    await fs.promises.access(photosRoot, fs.constants.F_OK | fs.constants.W_OK);
  } catch (err) {
    console.error('Directory check failed:', err);
    return res.status(500).json({ error: "Dossier cible introuvable ou inaccessible" });
  }

  try {
    const exists = await doesFileExist(filePath);
    if (exists) {
      return res.status(200).json({ created: false });
    }
  } catch (err) {
    console.error('Unable to check quoi image existence', err);
    return res.status(500).json({ error: err.message });
  }

  try {
    await fs.promises.writeFile(filePath, TRANSPARENT_PIXEL_BUFFER);
    res.status(201).json({ created: true, variant });
  } catch (err) {
    console.error('Unable to create quoi image placeholder', err);
    res.status(500).json({ error: err.message });
  }
};

const buildImageFilename = (id, variant = DEFAULT_IMAGE_VARIANT) => {
  const paddedId = String(id).padStart(7, '0');
  const safeVariant = sanitizeVariant(variant);
  return `o${paddedId}-${safeVariant}.png`;
};

const resolveImagePath = (id, variant = DEFAULT_IMAGE_VARIANT) =>
  path.resolve(photosRoot, buildImageFilename(id, variant));

const doesFileExist = async (filePath) => {
  try {
    await fs.promises.access(filePath, fs.constants.F_OK);
    return true;
  } catch (err) {
    return false;
  }
};

const toSafeInteger = (value) => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }
  if (typeof value === 'string') {
    const parsed = parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
};

const normalizeNullableText = (value) => {
  if (value === null || value === undefined) {
    return null;
  }
  const trimmed = String(value).trim();
  return trimmed || null;
};

const normalizeNullableDate = (value) => {
  const trimmed = normalizeNullableText(value);
  if (!trimmed) {
    return null;
  }
  return trimmed;
};

const toNullableInteger = (value) => {
  const trimmed = normalizeNullableText(value);
  if (!trimmed) {
    return null;
  }
  const parsed = parseInt(trimmed, 10);
  return Number.isFinite(parsed) ? parsed : null;
};

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

const normalizeImportValue = (column, value, lineNumber) => {
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
  if (QUOI_INTEGER_COLUMNS.has(column)) {
    if (!/^-?\d+$/.test(text)) {
      throw createImportError(`Valeur entière invalide pour ${column}, ligne ${lineNumber}.`);
    }
    return text;
  }
  if (column === 'datedernierevisu') {
    const match = text.match(/^(\d{4}-\d{2}-\d{2})/);
    if (!match) {
      throw createImportError(`Date invalide pour datedernierevisu, ligne ${lineNumber}.`);
    }
    return match[1];
  }
  const maxLength = QUOI_TEXT_LIMITS[column];
  if (maxLength && text.length > maxLength) {
    throw createImportError(`${column} dépasse ${maxLength} caractères à la ligne ${lineNumber}.`);
  }
  return text;
};

const normalizeQuoiName = (value) => String(value ?? '').trim().toLocaleLowerCase('fr');

const prepareCsvImport = (csvText) => {
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
  const invalidHeaders = headers.filter((header) => !QUOI_IMPORT_COLUMNS.has(header));
  if (invalidHeaders.length > 0) {
    throw createImportError(`Colonnes inconnues pour la table quoi : ${invalidHeaders.join(', ')}.`);
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
        importedRow[column] = normalizeImportValue(column, values[columnIndex], recordIndex + 1);
      }
    });
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
    const key = normalizeQuoiName(row.nom);
    if (seenNames.has(key)) {
      duplicateNames.add(row.nom);
    }
    seenNames.add(key);
  });
  if (duplicateNames.size > 0) {
    throw createImportError('Le fichier CSV contient des noms en double.', 409, {
      duplicates: [...duplicateNames],
    });
  }

  const columns = headers.filter((header) => header !== 'id');
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

const fetchRoleLinkCount = async (quoiId) => {
  if (!quoiId) {
    return 0;
  }
  const { rows } = await db.query('SELECT COUNT(*)::int AS count FROM role WHERE id_quoi = $1', [quoiId]);
  const row = rows && rows[0] ? rows[0] : null;
  if (!row || row.count === undefined || row.count === null) {
    return 0;
  }
  return toSafeInteger(row.count);
};

const fetchRelThemeLinkCount = async (quoiId) => {
  if (!quoiId) {
    return 0;
  }
  const { rows } = await db.query(
    'SELECT COUNT(*)::int AS count FROM reltheme WHERE id_quoi = $1',
    [quoiId]
  );
  const row = rows && rows[0] ? rows[0] : null;
  return row && row.count !== undefined && row.count !== null
    ? toSafeInteger(row.count)
    : 0;
};

exports.getQuoiRoleCount = async (req, res) => {
  console.log('getQuoiRoleCount');
  try {
    const { id } = req.params;
    const count = await fetchRoleLinkCount(id);
    res.json({ count });
  } catch (err) {
    console.error('Unable to count roles for quoi', err);
    res.status(500).json({ error: err.message });
  }
};

exports.getQuoiRelThemeCount = async (req, res) => {
  console.log('getQuoiRelThemeCount');
  try {
    const { id } = req.params;
    const count = await fetchRelThemeLinkCount(id);
    res.json({ count });
  } catch (err) {
    console.error('Unable to count relthemes for quoi', err);
    res.status(500).json({ error: err.message });
  }
};

exports.importQuoisCsv = async (req, res) => {
  console.log('importQuoisCsv');
  try {
    if (!req.file || !req.file.buffer) {
      throw createImportError('Aucun fichier CSV fourni.');
    }
    if (!/\.csv$/i.test(req.file.originalname || '')) {
      throw createImportError('Le fichier sélectionné doit avoir l\'extension .csv.');
    }

    const csvText = req.file.buffer.toString('utf8');
    if (csvText.includes('\uFFFD')) {
      throw createImportError('Le fichier CSV doit être encodé en UTF-8.');
    }
    const prepared = prepareCsvImport(csvText);

    const result = await db.withTransaction(async (client) => {
      await client.query('LOCK TABLE quoi IN SHARE ROW EXCLUSIVE MODE');
      const { rows: existingRows } = await client.query('SELECT nom FROM quoi');
      const existingNames = new Set(existingRows.map((row) => normalizeQuoiName(row.nom)));
      const duplicates = prepared.rows
        .filter((row) => existingNames.has(normalizeQuoiName(row.nom)))
        .map((row) => row.nom);
      if (duplicates.length > 0) {
        return { duplicates };
      }

      const { rows: idRows } = await client.query('SELECT COALESCE(MAX(id), 0) AS max_id FROM quoi');
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
        `INSERT INTO quoi (${insertColumns.join(', ')}) VALUES ${valueGroups.join(', ')}`,
        params
      );
      return { inserted: rowCount };
    });

    if (result.duplicates) {
      return res.status(409).json({
        error: 'Certains noms existent déjà dans la table quoi. Aucun ajout effectué.',
        duplicates: result.duplicates,
      });
    }
    return res.status(201).json({ inserted: result.inserted });
  } catch (err) {
    console.error('Unable to import quoi CSV', err);
    return res.status(err.statusCode || 500).json({
      error: err.statusCode ? err.message : 'Import CSV impossible.',
      ...(Array.isArray(err.duplicates) ? { duplicates: err.duplicates } : {}),
    });
  }
};

exports.createQuoi = async (req, res) => {
  console.log('createQuoi');
  try {
    const { nom } = req.body || {};
    const safeNom = normalizeNullableText(nom) || 'nouveau quoi';
    const { rows: idRows } = await db.query('SELECT COALESCE(MAX(id), 0) + 1 AS id FROM quoi');
    const newId = idRows[0].id;
    const timestamp = getCurrentTimestamp();
    const { rows } = await db.query(
      `INSERT INTO quoi (id, nom, modifts)
       VALUES ($1, $2, $3)
       RETURNING id, nom, domaine, genre, pays, stock, qualif, remarque,
                 liendisk,
                 lienweb,
                  datedernierevisu,
                 date_aaaa, date_mm, date_jj, modifts`,
      [newId, safeNom, timestamp]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('Unable to create quoi', err);
    res.status(500).json({ error: err.message });
  }
};

exports.updateQuoi = async (req, res) => {
  console.log('updateQuoi');
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ error: 'Identifiant manquant' });
    }
    const {
      nom,
      domaine,
      genre,
      pays,
      stock,
      qualif,
      remarque,
      liendisk,
      lienweb,
      datedernierevisu,
      date_aaaa,
      date_mm,
      date_jj,
    } = req.body || {};
    const safeNom = normalizeNullableText(nom) || 'Sans nom';
    const timestamp = getCurrentTimestamp();
    const values = [
      safeNom,
      normalizeNullableText(domaine),
      normalizeNullableText(genre),
      normalizeNullableText(pays),
      normalizeNullableText(stock),
      normalizeNullableText(qualif),
      normalizeNullableText(remarque),
      normalizeNullableText(liendisk),
      normalizeNullableDate(datedernierevisu),
      toNullableInteger(date_aaaa),
      toNullableInteger(date_mm),
      toNullableInteger(date_jj),
      timestamp,
      id,
      normalizeNullableText(lienweb),
    ];
    const { rows } = await db.query(
      `UPDATE quoi
         SET nom=$1,
             domaine=$2,
             genre=$3,
             pays=$4,
             stock=$5,
             qualif=$6,
             remarque=$7,
             liendisk=$8,
             lienweb=$15,
             datedernierevisu=$9,
             date_aaaa=$10,
             date_mm=$11,
             date_jj=$12,
             modifts=$13
       WHERE id=$14
       RETURNING id, nom, domaine, genre, pays, stock, qualif, remarque,
                 liendisk,
                 lienweb,
                 datedernierevisu,
                 date_aaaa, date_mm, date_jj, modifts`,
      values
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Quoi not found' });
    }
    res.json(rows[0]);
  } catch (err) {
    console.error('Unable to update quoi', err);
    res.status(500).json({ error: err.message });
  }
};

exports.deleteQuoi = async (req, res) => {
  console.log('deleteQuoi');
  try {
    const { id } = req.params;
    const roleCount = await fetchRoleLinkCount(id);
    const relThemeCount = await fetchRelThemeLinkCount(id);
    if (roleCount > 0) {
      return res.status(409).json({
        error: 'Quoi linked to roles',
        roleCount,
        relThemeCount,
      });
    }
    if (relThemeCount > 0) {
      return res.status(409).json({
        error: 'Quoi linked to relthemes',
        roleCount,
        relThemeCount,
      });
    }
    const { rowCount } = await db.query('DELETE FROM quoi WHERE id = $1', [id]);
    if (rowCount === 0) {
      return res.status(404).json({ error: 'Quoi not found' });
    }
    res.json({ message: 'Quoi deleted' });
  } catch (err) {
    console.error('Unable to delete quoi', err);
    res.status(500).json({ error: err.message });
  }
};
