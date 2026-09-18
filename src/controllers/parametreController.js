const db = require('../db');

let listIdParametre = ';';

const padId = (value) => value.toString().padStart(7, '0');
const getCurrentTimestamp = () => new Date().toISOString().split('.')[0];

const resetParametreCache = () => {
  listIdParametre = ';';
};

async function ensureParametreListCache() {
  if (listIdParametre.length > 1) {
    return;
  }
  const { rows } = await db.query('SELECT id FROM parametre ORDER BY id');
  listIdParametre = ';';
  rows.forEach(({ id }) => {
    listIdParametre += padId(id) + ';';
  });
}

function computeNavigation(id) {
  if (listIdParametre.length <= 1) {
    return {};
  }
  const paddedId = padId(id);
  const searchToken = `;${paddedId};`;
  let posIdSuivant = listIdParametre.indexOf(searchToken);
  if (posIdSuivant === -1) {
    return {};
  }
  posIdSuivant += 9;

  let idSuivant;
  if (posIdSuivant + 7 > listIdParametre.length) {
    idSuivant = listIdParametre.substring(1, 8);
  } else {
    idSuivant = listIdParametre.substring(posIdSuivant, posIdSuivant + 7);
  }

  const posIdPrecedent = posIdSuivant - 16;
  let idPrecedent;
  if (posIdPrecedent > 0) {
    idPrecedent = listIdParametre.substring(posIdPrecedent, posIdPrecedent + 7);
  } else {
    idPrecedent = listIdParametre.substring(
      listIdParametre.length - 8,
      listIdParametre.length - 1
    );
  }

  const navigation = {};
  if (idSuivant && idSuivant.trim()) {
    navigation.idSuivant = idSuivant;
  }
  if (idPrecedent && idPrecedent.trim()) {
    navigation.idPrecedent = idPrecedent;
  }
  return navigation;
}

exports.getAllParametres = async (_req, res) => {
  console.log('getAllParametres');
  try {
    const { rows } = await db.query('SELECT id, nom, niv1, modifts FROM parametre ORDER BY id');
    listIdParametre = ';';
    rows.forEach(({ id }) => {
      listIdParametre += padId(id) + ';';
    });
    res.json(rows);
  } catch (err) {
    console.error('Unable to fetch parametres', err);
    res.status(500).json({ error: err.message });
  }
};

exports.getParametreById = async (req, res) => {
  console.log('getParametreById');
  try {
    const { id } = req.params;
    const { rows } = await db.query(
      'SELECT id, nom, niv1, modifts FROM parametre WHERE id = $1',
      [id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Parametre not found' });
    }
    const parametre = rows[0];

    await ensureParametreListCache();
    let navigation = computeNavigation(parametre.id);
    if (!navigation.idSuivant && !navigation.idPrecedent) {
      resetParametreCache();
      await ensureParametreListCache();
      navigation = computeNavigation(parametre.id);
    }
    Object.assign(parametre, navigation);

    res.json(parametre);
  } catch (err) {
    console.error('Unable to fetch parametre by id', err);
    res.status(500).json({ error: err.message });
  }
};

exports.createParametre = async (req, res) => {
  console.log('createParametre');
  try {
    const { nom, niv1 } = req.body;
    const timestamp = getCurrentTimestamp();
    const {
      rows: idRows,
    } = await db.query('SELECT COALESCE(MAX(id), 0) + 1 AS id FROM parametre');
    const newId = idRows[0].id;
    const { rows } = await db.query(
      `INSERT INTO parametre (id, nom, niv1, modifts)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [
        newId,
        nom || 'nouveau parametre',
        niv1 || null,
        timestamp,
      ]
    );
    resetParametreCache();
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('Unable to create parametre', err);
    res.status(500).json({ error: err.message });
  }
};

exports.saveParametre = async (req, res) => {
  console.log('saveParametre');
  try {
    const { id } = req.params;
    const { nom, niv1 } = req.body;
    const timestamp = getCurrentTimestamp();
    const { rowCount } = await db.query(
      `UPDATE parametre
       SET nom=$1, niv1=$2,  modifts=$3
       WHERE id=$4`,
      [nom, niv1,timestamp, id]
    );
    if (rowCount === 0) {
      return res.status(404).json({ error: 'Parametre not found' });
    }
    resetParametreCache();
    res.json({ message: 'Parametre updated' });
  } catch (err) {
    console.error('Unable to update parametre', err);
    res.status(500).json({ error: err.message });
  }
};

exports.deleteParametre = async (req, res) => {
  console.log('deleteParametre');
  try {
    const { id } = req.params;
    const { rowCount } = await db.query(
      'DELETE FROM parametre WHERE id = $1',
      [id]
    );
    if (rowCount === 0) {
      return res.status(404).json({ error: 'Parametre not found' });
    }
    resetParametreCache();
    res.json({ message: 'Parametre deleted' });
  } catch (err) {
    console.error('Unable to delete parametre', err);
    res.status(500).json({ error: err.message });
  }
};
