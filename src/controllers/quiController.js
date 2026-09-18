const db = require('../db')
const path = require('path')
const fs = require('fs')
console.log("quiController.js")
var listIdQui=";"
const projectRoot = path.resolve(__dirname, '..', '..');
const photosRoot = path.resolve('C:\\PARTAGE\\QQT_Data\\Photos');

const fallbackImage = path.resolve(
  projectRoot, 
  'public', 
  'img', 
  'ko.jpg');

const DEFAULT_IMAGE_VARIANT = '001'
const TRANSPARENT_PIXEL_BUFFER = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNgYGBgAAAABQABDQottAAAAABJRU5ErkJggg==',
  'base64'
)

const sanitizeVariant = (variant) => {
  if (typeof variant === 'number') {
    return String(variant).padStart(3, '0')
  }
  if (typeof variant !== 'string') {
    return DEFAULT_IMAGE_VARIANT
  }
  const digits = variant.trim().replace(/\D/g, '')
  if (!digits) {
    return DEFAULT_IMAGE_VARIANT
  }
  return digits.slice(0, 3).padStart(3, '0')
}

const buildImageFilename = (id, variant = DEFAULT_IMAGE_VARIANT) => {
  const paddedId = String(id).padStart(7, '0')
  const safeVariant = sanitizeVariant(variant)
  return `i${paddedId}-${safeVariant}.png`
}

const resolveImagePath = (id, variant = DEFAULT_IMAGE_VARIANT) => path.resolve(
  photosRoot,
  buildImageFilename(id, variant)
)

const doesFileExist = async (filePath) => {
  try {
    await fs.promises.access(filePath, fs.constants.F_OK)
    return true
  } catch (err) {
    return false
  }
}

const toSafeInteger = (value, defaultValue = 0) => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : defaultValue;
  }
  if (typeof value === 'string') {
    const parsed = parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : defaultValue;
  }
  return defaultValue;
};
 
exports.getAllQui = async (req, res) => {
  console.log("getAllQui")
  listIdQui=";"
  try {
    const {
      genre,
      domaine,
      datenaiss_aaaa_debut,
      datenaiss_aaaa_fin,
      nom_debut,
      prenom_debut,
      style_debut,
      pays_debut,
    } = req.query;
    let query = 'SELECT * FROM qui';
    const conditions = [];
    const params = [];
    
    if (genre) {
      if (String(genre).trim() === '#G') {
        params.push('G');
        conditions.push(`(genre <> $${params.length} OR genre IS NULL)`);
      } else {
        params.push(genre);
        conditions.push(`genre = $${params.length}`);
      }
    }

    if (domaine) {
      params.push(domaine);
      conditions.push(`domaine = $${params.length}`);
    }

    const nomStart = typeof nom_debut === 'string' ? nom_debut.trim() : '';
    if (nomStart) {
      params.push(`${nomStart}%`);
      conditions.push(`nom ILIKE $${params.length}`);
    }

    const prenomStart = typeof prenom_debut === 'string' ? prenom_debut.trim() : '';
    if (prenomStart) {
      params.push(`${prenomStart}%`);
      conditions.push(`prenom ILIKE $${params.length}`);
    }

    const styleStart = typeof style_debut === 'string' ? style_debut.trim() : '';
    if (styleStart) {
      params.push(`${styleStart}%`);
      conditions.push(`style ILIKE $${params.length}`);
    }

    const paysStart = typeof pays_debut === 'string' ? pays_debut.trim() : '';
    if (paysStart) {
      params.push(`${paysStart}%`);
      conditions.push(`pays ILIKE $${params.length}`);
    }

    const yearStart = Number.parseInt(datenaiss_aaaa_debut, 10);
    if (!Number.isNaN(yearStart)) {
      params.push(yearStart);
      conditions.push(`datenaiss_aaaa >= $${params.length}`);
    }

    const yearEnd = Number.parseInt(datenaiss_aaaa_fin, 10);
    if (!Number.isNaN(yearEnd)) {
      params.push(yearEnd);
      conditions.push(`datenaiss_aaaa <= $${params.length}`);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }
    query += ' ORDER BY datenaiss_aaaa DESC NULLS LAST, datenaiss_mm DESC NULLS LAST, datenaiss_jj DESC NULLS LAST, fullname';
    const { rows } = await db.query(query, params);
    rows.forEach(qui => {
      listIdQui+=qui.id.toString().padStart(7, "0")+";";
    })
    //console.log(listIdQui)
    res.json(rows);
  } catch (err) {
    console.log( err.message)
    res.status(500).json({ error: err.message });
  }
};

exports.getImgQuiById = async (req, res) => {
  const num = req.params.id;
  const variant = sanitizeVariant(req.query.variant);
  const requestedImage = resolveImagePath(num, variant);
  console.log("getImgQuiById "+requestedImage)
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

exports.saveImgQui = async (req, res) => {
  const id = req.params.id;
  const variant = sanitizeVariant(req.query.variant);
  const nomFic = buildImageFilename(id, variant);
  const destDir = photosRoot;
  const dest = path.join(photosRoot, nomFic);
  console.log("saveImgQui "+dest);

  try {
    await fs.promises.access(destDir, fs.constants.F_OK | fs.constants.W_OK);
  } catch (err) {
    console.error('Directory check failed:', err);
    return res.status(500).json({ error: "Dossier cible introuvable ou inaccessible" });
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

exports.checkImgQuiVariantExists = async (req, res) => {
  const { id, variant: variantParam } = req.params;
  const variant = sanitizeVariant(variantParam);
  const filePath = resolveImagePath(id, variant);
  try {
    const exists = await doesFileExist(filePath);
    res.json({ exists });
  } catch (err) {
    console.error('Unable to check image existence', err);
    res.status(500).json({ error: err.message });
  }
};

exports.ensureImgQuiVariant = async (req, res) => {
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
    console.error('Unable to check image existence', err);
    return res.status(500).json({ error: err.message });
  }

  try {
    await fs.promises.writeFile(filePath, TRANSPARENT_PIXEL_BUFFER);
    res.status(201).json({ created: true });
  } catch (err) {
    console.error('Unable to create empty image', err);
    res.status(500).json({ error: err.message });
  }
};

exports.getQuiById = async (req, res) => {
  console.log("getQuiById")
  try {
    const { id } = req.params;
    const { rows } = await db.query('SELECT * FROM qui WHERE id = $1', [id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Qui not found' });
    var row0=rows[0];
    //position du id Suivant:
    const posIdSuivant =listIdQui.indexOf(';'+id.padStart(7, "0")+";")+9 //debut du suivant
    if (posIdSuivant+7>listIdQui.length) {
      row0.idSuivant=listIdQui.substring(1,1+7);
    } else {
      row0.idSuivant=listIdQui.substring(posIdSuivant,posIdSuivant+7);
    }

    //position du id precedent:
    const posIdPrecedent=posIdSuivant - 16
    if (posIdPrecedent>0) {
      row0.idPrecedent=listIdQui.substring(posIdPrecedent,posIdPrecedent+7);
    } else {
      row0.idPrecedent=listIdQui.substring(listIdQui.length-8,listIdQui.length-1);
    }

    res.json(row0);
    //res.json(rows[0]);
  } catch (err) {
    console.log( err.message)
    res.status(500).json({ error: err.message });
  }
};


const getCurrentTimestamp = () => new Date().toISOString().split('.')[0];

exports.saveQui = async (req, res) => {
  console.log("saveQui")
  try {
    const { id } = req.params;
    const {
      nom,
      prenom,
      fullname,
      genre,
      domaine,
      pays,
      style,
      remarque,
      lienDisk,
      lienWeb,
      liendisk,
      lienweb,
      datenaiss_aaaa,
      datenaiss_mm,
      datenaiss_jj,
      datedeces_aaaa,
      datedeces_mm,
      datedeces_jj,
    } = req.body;
    const timestamp = getCurrentTimestamp();

    const normalizedLienDisk = lienDisk ?? liendisk;
    const normalizedLienWeb = lienWeb ?? lienweb;
    const { rowCount } = await db.query(
      `UPDATE qui SET nom=$1, prenom=$2, fullname=$3, genre=$4, domaine=$5, pays=$6, style=$7, remarque=$8, lienDisk=$9, lienWeb=$10, modifts=$11, datenaiss_aaaa=$12, datenaiss_mm=$13, datenaiss_jj=$14, datedeces_aaaa=$15 , datedeces_mm=$16 , datedeces_jj=$17 WHERE id=$18`,
      [
        nom,
        prenom,
        fullname,
        genre,
        domaine,
        pays,
        style,
        remarque,
        normalizedLienDisk,
        normalizedLienWeb,
        timestamp,
        Number(datenaiss_aaaa),
        Number(datenaiss_mm),
        Number(datenaiss_jj),
        Number(datedeces_aaaa),
        Number(datedeces_mm),
        Number(datedeces_jj),
        id
      ]
    );
    if (rowCount === 0) return res.status(404).json({ error: 'Qui not found' });
    res.json({ message: 'Qui updated' });
  } catch (err) {
    console.log(err.message);
    res.status(500).json({ error: err.message });
  }
};

exports.createQui = async (req, res) => {
  console.log("createQui")
  try {
    const { nom } = req.body;
    console.log("nom="+nom)

    // Compute next id as MAX(id) + 1 from the "qui" table
    const { rows: idRows } = await db.query('SELECT COALESCE(MAX(id), 0) + 1 AS id FROM qui');
    const newId = idRows[0].id;

    const timestamp = getCurrentTimestamp();
    const { rows } = await db.query('INSERT INTO qui (nom, id, modifts) VALUES ($1, $2, $3) RETURNING *', [nom || 'nouveau qui', newId, timestamp]);
    res.status(201).json(rows[0]);
  } catch (err) {
    console.log(err.message)
    res.status(500).json({ error: err.message });
  }
};

const fetchQuiRoleCount = async (quiId) => {
  if (!quiId) {
    return 0;
  }
  const { rows } = await db.query('SELECT COUNT(*)::int AS count FROM role WHERE id_qui = $1', [quiId]);
  const row = rows && rows[0] ? rows[0] : null;
  return row && row.count !== undefined && row.count !== null
    ? toSafeInteger(row.count)
    : 0;
};

const fetchRelThemeCountForQui = async (quiId) => {
  if (!quiId) {
    return 0;
  }
  try {
    const { rows } = await db.query(
      'SELECT COUNT(*)::int AS count FROM reltheme WHERE id_qui = $1 OR id_qui_ensemble = $1',
      [quiId]
    );
    const row = rows && rows[0] ? rows[0] : null;
    if (row && row.count !== undefined && row.count !== null) {
      return toSafeInteger(row.count);
    }
  } catch (err) {
    // fallback if column id_qui_ensemble is absent
    const { rows } = await db.query(
      'SELECT COUNT(*)::int AS count FROM reltheme WHERE id_qui = $1',
      [quiId]
    );
    const row = rows && rows[0] ? rows[0] : null;
    if (row && row.count !== undefined && row.count !== null) {
      return toSafeInteger(row.count);
    }
  }
  return 0;
};

const fetchPosteCountForQui = async (quiId) => {
  if (!quiId) {
    return 0;
  }
  const { rows } = await db.query(
    'SELECT COUNT(*)::int AS count FROM poste WHERE id_qui_element = $1 OR id_qui_ensemble = $1',
    [quiId]
  );
  const row = rows && rows[0] ? rows[0] : null;
  return row && row.count !== undefined && row.count !== null
    ? toSafeInteger(row.count)
    : 0;
};

exports.getQuiRoleCount = async (req, res) => {
  console.log('getQuiRoleCount');
  try {
    const { id } = req.params;
    const count = await fetchQuiRoleCount(id);
    res.json({ count });
  } catch (err) {
    console.log(err.message);
    res.status(500).json({ error: err.message });
  }
};

exports.getQuiRelThemeCount = async (req, res) => {
  console.log('getQuiRelThemeCount');
  try {
    const { id } = req.params;
    const count = await fetchRelThemeCountForQui(id);
    res.json({ count });
  } catch (err) {
    console.log(err.message);
    res.status(500).json({ error: err.message });
  }
};

exports.getQuiPosteCount = async (req, res) => {
  console.log('getQuiPosteCount');
  try {
    const { id } = req.params;
    const count = await fetchPosteCountForQui(id);
    res.json({ count });
  } catch (err) {
    console.log(err.message);
    res.status(500).json({ error: err.message });
  }
};

exports.updateQui = async (req, res) => {
  console.log("updateQui, ID = "+req.params)
  try {
    const { id } = req.params;

    // Build dynamic SET clause for all fields provided in the request body,
    // excluding the primary key "id".
    const allowedFields = [
      'nom','prenom','fullname','genre','domaine','pays','style','remarque',
      'lienDisk','lienWeb','liendisk','lienweb','modifts',
      'datenaiss_aaaa','datenaiss_mm','datenaiss_jj',
      'datedeces_aaaa','datedeces_mm','datedeces_jj'
    ];

    const setClauses = [];
    const values = [];
    let index = 1;
    for (const field of allowedFields) {
      if (Object.prototype.hasOwnProperty.call(req.body, field)) {
        setClauses.push(`${field}=$${index}`);
        values.push(req.body[field]);
        index++;
      }
    }

    if (setClauses.length === 0) {
      return res.status(400).json({ error: 'No fields provided for update' });
    }

    values.push(id); // add id for WHERE clause
    const query = `UPDATE qui SET ${setClauses.join(', ')} WHERE id=$${index}`;
    const { rowCount } = await db.query(query, values);

    if (rowCount === 0) return res.status(404).json({ error: 'Qui not found' });
    res.json({ message: 'Qui updated' });
  } catch (err) {
    console.log( err.message)
    res.status(500).json({ error: err.message });
  }
};

exports.deleteQui = async (req, res) => {
  console.log("deleteQui")
  try {
    const { id } = req.params;
    console.log("id="+id)
    const roleCount = await fetchQuiRoleCount(id);
    const relThemeCount = await fetchRelThemeCountForQui(id);
    const posteCount = await fetchPosteCountForQui(id);
    if (roleCount > 0 || relThemeCount > 0 || posteCount > 0) {
      return res.status(409).json({
        error: 'Qui linked to other records',
        roleCount,
        relThemeCount,
        posteCount,
      });
    }
    const { rowCount } = await db.query('DELETE FROM qui  WHERE id=$1', [id]);
    if (rowCount === 0) return res.status(404).json({ error: 'Qui not found' });
    res.json({ message: 'Qui deleted' });
  } catch (err) {
    console.log( err.message)
    res.status(500).json({ error: err.message });
  }
};
