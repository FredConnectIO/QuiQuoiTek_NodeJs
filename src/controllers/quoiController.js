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
