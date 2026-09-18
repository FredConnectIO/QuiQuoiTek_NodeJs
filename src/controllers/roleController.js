const db = require('../db');
const path = require('path');
const fs = require('fs');

let listIdRole = ';';
const projectRoot = path.resolve(__dirname, '..', '..');
const photosRoot = path.resolve('C:\\PARTAGE\\QQT_Data\\Photos');

const fallbackImage = path.resolve(projectRoot, 'public', 'img', 'ko.jpg');
const DEFAULT_IMAGE_VARIANT = '001';
const TRANSPARENT_PIXEL_BUFFER = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNgYGBgAAAABQABDQottAAAAABJRU5ErkJggg==',
  'base64'
);

const toNumberOrNull = (value) => {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

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

const buildImageFilename = (id, variant = DEFAULT_IMAGE_VARIANT) => {
  const paddedId = String(id).padStart(7, '0');
  const safeVariant = sanitizeVariant(variant);
  return `r${paddedId}-${safeVariant}.png`;
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

exports.getAllRoles = async (req, res) => {
  console.log('getAllRoles');
  listIdRole = ';';
  try {
    const { rows } = await db.query(
      `SELECT
         role.*,
         COALESCE(NULLIF(CONCAT_WS(' ', qui.nom, qui.prenom), ''), '') AS qui_nomprenom,
         COALESCE(quoi.nom, '') AS nom_quoi,
         quoi.date_aaaa AS quoi_date_aaaa,
         quoi.domaine AS quoi_domaine,
         COALESCE(quoi.stock, '') AS quoi_stock,
         qui.genre AS qui_genre,
         qui.datenaiss_aaaa AS qui_datenaiss_aaaa,
         CASE
           WHEN quoi.date_aaaa IS NOT NULL AND qui.datenaiss_aaaa IS NOT NULL THEN
             CASE
               WHEN quoi.date_mm IS NOT NULL AND qui.datenaiss_mm IS NOT NULL
                    AND quoi.date_jj IS NOT NULL AND qui.datenaiss_jj IS NOT NULL THEN
                 (quoi.date_aaaa - qui.datenaiss_aaaa) -
                 CASE
                   WHEN (quoi.date_mm < qui.datenaiss_mm)
                        OR (quoi.date_mm = qui.datenaiss_mm AND quoi.date_jj < qui.datenaiss_jj)
                   THEN 1
                   ELSE 0
                 END
               ELSE
                 quoi.date_aaaa - qui.datenaiss_aaaa
             END
           ELSE NULL
         END AS age_quick_estimate
       FROM role
       LEFT JOIN qui ON role.id_qui = qui.id
       LEFT JOIN quoi ON role.id_quoi = quoi.id
       ORDER BY role.id`
    );
    rows.forEach((role) => {
      listIdRole += role.id.toString().padStart(7, '0') + ';';
    });
    res.json(rows);
  } catch (err) {
    console.log(err.message);
    res.status(500).json({ error: err.message });
  }
};

exports.getImgRoleById = async (req, res) => {
  const { id } = req.params;
  const variant = sanitizeVariant(req.query.variant);
  const requestedImage = resolveImagePath(id, variant);
  console.log('getImgRoleById '+requestedImage);

  let imgPath = fallbackImage;
  if (fs.existsSync(requestedImage)) {
    imgPath = requestedImage;
  }

  res.setHeader('Cache-Control', 'no-store');
  res.sendFile(imgPath, (err) => {
    if (err) {
      console.error('Unable to send role image', err);
      if (!res.headersSent) {
        res.status(err.statusCode || 500).end();
      }
    }
  });
};

exports.saveImgRole = async (req, res) => {
  const { id } = req.params;
  const variant = sanitizeVariant(req.query.variant);
  const dest = resolveImagePath(id, variant);
  console.log('saveImgRole ' + dest);

  try {
    await fs.promises.access(photosRoot, fs.constants.F_OK | fs.constants.W_OK);
  } catch (err) {
    console.error('Directory check failed:', err);
    return res.status(500).json({ error: 'Dossier cible introuvable ou inaccessible' });
  }

  if (!req.file || !req.file.buffer) {
    return res.status(400).json({ error: 'Aucun fichier fourni' });
  }

  try {
    await fs.promises.writeFile(dest, req.file.buffer);
    res.status(200).json({ message: 'Image enregistree', variant });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};

exports.checkImgRoleVariantExists = async (req, res) => {
  const { id, variant: variantParam } = req.params;
  const variant = sanitizeVariant(variantParam);
  const filePath = resolveImagePath(id, variant);
  try {
    const exists = await doesFileExist(filePath);
    res.json({ exists });
  } catch (err) {
    console.error('Unable to check role image existence', err);
    res.status(500).json({ error: err.message });
  }
};

exports.ensureImgRoleVariant = async (req, res) => {
  const { id, variant: variantParam } = req.params;
  const variant = sanitizeVariant(variantParam);
  const filePath = resolveImagePath(id, variant);

  try {
    await fs.promises.access(photosRoot, fs.constants.F_OK | fs.constants.W_OK);
  } catch (err) {
    console.error('Directory check failed:', err);
    return res.status(500).json({ error: 'Dossier cible introuvable ou inaccessible' });
  }

  try {
    const exists = await doesFileExist(filePath);
    if (exists) {
      return res.status(200).json({ created: false });
    }
  } catch (err) {
    console.error('Unable to check role image existence', err);
    return res.status(500).json({ error: err.message });
  }

  try {
    await fs.promises.writeFile(filePath, TRANSPARENT_PIXEL_BUFFER);
    res.status(201).json({ created: true });
  } catch (err) {
    console.error('Unable to create empty role image', err);
    res.status(500).json({ error: err.message });
  }
};

async function ensureRoleListCache() {
  if (listIdRole.length > 1) {
    return;
  }
  const { rows } = await db.query('SELECT id FROM role ORDER BY id');
  listIdRole = ';';
  rows.forEach((role) => {
    listIdRole += role.id.toString().padStart(7, '0') + ';';
  });
}

exports.getRoleById = async (req, res) => {
  console.log('getRoleById');
  try {
    const { id } = req.params;
    const { rows } = await db.query('SELECT * FROM role WHERE id = $1', [id]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Role not found' });
    }
    await ensureRoleListCache();
    const role = rows[0];

    const paddedId = id.toString().padStart(7, '0');
    const searchToken = ';' + paddedId + ';';
    const posIdSuivant = listIdRole.indexOf(searchToken) + 9;
    if (posIdSuivant + 7 > listIdRole.length) {
      role.idSuivant = listIdRole.substring(1, 8);
    } else {
      role.idSuivant = listIdRole.substring(posIdSuivant, posIdSuivant + 7);
    }

    const posIdPrecedent = posIdSuivant - 16;
    if (posIdPrecedent > 0) {
      role.idPrecedent = listIdRole.substring(posIdPrecedent, posIdPrecedent + 7);
    } else {
      role.idPrecedent = listIdRole.substring(listIdRole.length - 8, listIdRole.length - 1);
    }

    res.json(role);
  } catch (err) {
    console.log(err.message);
    res.status(500).json({ error: err.message });
  }
};

exports.saveRole = async (req, res) => {
  console.log('saveRole');
  try {
    const { id } = req.params;
    const { id_qui, id_quoi, nom, remarque } = req.body;
    const timestamp = getCurrentTimestamp();

    const { rowCount } = await db.query(
      `UPDATE role
       SET id_qui=$1, id_quoi=$2, nom=$3, remarque=$4, modifts=$5
       WHERE id=$6`,
      [id_qui, id_quoi, nom, remarque, timestamp, id]
    );
    if (rowCount === 0) {
      return res.status(404).json({ error: 'Role not found' });
    }
    res.json({ message: 'Role updated' });
  } catch (err) {
    console.log(err.message);
    res.status(500).json({ error: err.message });
  }
};

exports.createRole = async (req, res) => {
  console.log('createRole');
  try {
    const { nom, id_quoi, id_qui, remarque } = req.body;
    const parsedIdQuoi = toNumberOrNull(id_quoi);
    const parsedIdQui = toNumberOrNull(id_qui);
    const normalizedNom = typeof nom === 'string' ? nom.trim() : '';
    const normalizedRemarque = typeof remarque === 'string' ? remarque.trim() || null : null;
    const { rows: idRows } = await db.query('SELECT COALESCE(MAX(id), 0) + 1 AS id FROM role');
    const newId = idRows[0].id;
    const timestamp = getCurrentTimestamp();
    const { rows } = await db.query(
      `INSERT INTO role (id, id_quoi, id_qui, nom, remarque, modifts)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        newId,
        parsedIdQuoi,
        parsedIdQui,
        normalizedNom || 'nouveau role',
        normalizedRemarque,
        timestamp,
      ]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.log(err.message);
    res.status(500).json({ error: err.message });
  }
};

exports.deleteRole = async (req, res) => {
  console.log('deleteRole');
  try {
    const { id } = req.params;
    const { rowCount } = await db.query('DELETE FROM role WHERE id = $1', [id]);
    if (rowCount === 0) {
      return res.status(404).json({ error: 'Role not found' });
    }
    res.json({ message: 'Role deleted' });
  } catch (err) {
    console.log(err.message);
    res.status(500).json({ error: err.message });
  }
};
