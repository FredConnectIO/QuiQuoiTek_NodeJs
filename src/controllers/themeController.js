const db = require('../db');

let listIdTheme = ';';

const padId = (value) => value.toString().padStart(7, '0');
const getCurrentTimestamp = () => new Date().toISOString().split('.')[0];

const resetThemeCache = () => {
  listIdTheme = ';';
};

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

async function ensureThemeListCache() {
  if (listIdTheme.length > 1) {
    return;
  }
  const { rows } = await db.query('SELECT id FROM theme ORDER BY id');
  listIdTheme = ';';
  rows.forEach(({ id }) => {
    listIdTheme += padId(id) + ';';
  });
}

function computeNavigation(id) {
  if (listIdTheme.length <= 1) {
    return {};
  }
  const paddedId = padId(id);
  const searchToken = `;${paddedId};`;
  let posIdSuivant = listIdTheme.indexOf(searchToken);
  if (posIdSuivant === -1) {
    return {};
  }
  posIdSuivant += 9;

  let idSuivant;
  if (posIdSuivant + 7 > listIdTheme.length) {
    idSuivant = listIdTheme.substring(1, 8);
  } else {
    idSuivant = listIdTheme.substring(posIdSuivant, posIdSuivant + 7);
  }

  const posIdPrecedent = posIdSuivant - 16;
  let idPrecedent;
  if (posIdPrecedent > 0) {
    idPrecedent = listIdTheme.substring(posIdPrecedent, posIdPrecedent + 7);
  } else {
    idPrecedent = listIdTheme.substring(listIdTheme.length - 8, listIdTheme.length - 1);
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

exports.getAllThemes = async (_req, res) => {
  console.log('getAllThemes');
  try {
    const { rows } = await db.query('SELECT id, nom, modifts FROM theme ORDER BY id');
    listIdTheme = ';';
  rows.forEach(({ id }) => {
    listIdTheme += padId(id) + ';';
  });
  res.json(rows);
} catch (err) {
    console.error('Unable to fetch themes', err);
    res.status(500).json({ error: err.message });
  }
};

exports.getThemeById = async (req, res) => {
  console.log('getThemeById');
  try {
    const { id } = req.params;
    const { rows } = await db.query('SELECT id, nom, modifts FROM theme WHERE id = $1', [id]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Theme not found' });
    }
    const theme = rows[0];

    await ensureThemeListCache();
    let navigation = computeNavigation(theme.id);
    if (!navigation.idSuivant && !navigation.idPrecedent) {
      resetThemeCache();
      await ensureThemeListCache();
      navigation = computeNavigation(theme.id);
    }
    Object.assign(theme, navigation);

    res.json(theme);
  } catch (err) {
    console.error('Unable to fetch theme by id', err);
    res.status(500).json({ error: err.message });
  }
};

const fetchRelThemeCountForTheme = async (themeId) => {
  if (!themeId) {
    return 0;
  }
  const { rows } = await db.query(
    'SELECT COUNT(*)::int AS count FROM reltheme WHERE id_theme = $1',
    [themeId]
  );
  const row = rows && rows[0] ? rows[0] : null;
  return row && row.count !== undefined && row.count !== null
    ? toSafeInteger(row.count)
    : 0;
};

exports.getThemeRelThemeCount = async (req, res) => {
  console.log('getThemeRelThemeCount');
  try {
    const { id } = req.params;
    const count = await fetchRelThemeCountForTheme(id);
    res.json({ count });
  } catch (err) {
    console.error('Unable to count relthemes for theme', err);
    res.status(500).json({ error: err.message });
  }
};

exports.createTheme = async (req, res) => {
  console.log('createTheme');
  try {
    const { nom } = req.body;
    const {
      rows: idRows,
    } = await db.query('SELECT COALESCE(MAX(id), 0) + 1 AS id FROM theme');
    const newId = idRows[0].id;
    const timestamp = getCurrentTimestamp();
    const { rows } = await db.query(
      'INSERT INTO theme (id, nom, modifts) VALUES ($1, $2, $3) RETURNING *',
      [newId, nom || 'nouveau theme', timestamp]
    );
    resetThemeCache();
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('Unable to create theme', err);
    res.status(500).json({ error: err.message });
  }
};

exports.saveTheme = async (req, res) => {
  console.log('saveTheme');
  try {
    const { id } = req.params;
    const { nom } = req.body;
    const timestamp = getCurrentTimestamp();
    const { rowCount } = await db.query('UPDATE theme SET nom=$1, modifts=$2 WHERE id=$3', [
      nom,
      timestamp,
      id,
    ]);
    if (rowCount === 0) {
      return res.status(404).json({ error: 'Theme not found' });
    }
    resetThemeCache();
    res.json({ message: 'Theme updated' });
  } catch (err) {
    console.error('Unable to update theme', err);
    res.status(500).json({ error: err.message });
  }
};

exports.deleteTheme = async (req, res) => {
  console.log('deleteTheme');
  try {
    const { id } = req.params;
    const relThemeCount = await fetchRelThemeCountForTheme(id);
    if (relThemeCount > 0) {
      return res.status(409).json({
        error: 'Theme linked to reltheme',
        relThemeCount,
      });
    }
    const { rowCount } = await db.query('DELETE FROM theme WHERE id = $1', [id]);
    if (rowCount === 0) {
      return res.status(404).json({ error: 'Theme not found' });
    }
    resetThemeCache();
    res.json({ message: 'Theme deleted' });
  } catch (err) {
    console.error('Unable to delete theme', err);
    res.status(500).json({ error: err.message });
  }
};
