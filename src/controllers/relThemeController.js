const db = require('../db');

const idCacheByQui = new Map();
const idCacheByRole = new Map();

const toNumberOrNull = (value) => {
  if (value === null || value === undefined) {
    return null;
  }
  const num = Number.parseInt(value, 10);
  return Number.isNaN(num) ? null : num;
};
const getCurrentTimestamp = () => new Date().toISOString().split('.')[0];

const padId = (value) => {
  const str = String(value ?? '').trim();
  if (!str) {
    return '';
  }
  return str.padStart(7, '0');
};

const setCacheForQui = (idQui, ids) => {
  const key = Number.parseInt(idQui, 10);
  if (Number.isNaN(key)) {
    return;
  }
  idCacheByQui.set(key, ids);
};

const clearCacheForQui = (idQui) => {
  const key = Number.parseInt(idQui, 10);
  if (Number.isNaN(key)) {
    return;
  }
  idCacheByQui.delete(key);
};

const getCachedIdsForQui = (idQui) => {
  const key = Number.parseInt(idQui, 10);
  if (Number.isNaN(key)) {
    return undefined;
  }
  return idCacheByQui.get(key);
};

const ensureIdsForQui = async (idQui) => {
  const cached = getCachedIdsForQui(idQui);
  if (cached && cached.length > 0) {
    return cached;
  }
  const { rows } = await db.query(
    'SELECT id FROM reltheme WHERE id_qui = $1 ORDER BY id',
    [idQui]
  );
  const ids = rows.map((row) => row.id);
  setCacheForQui(idQui, ids);
  return ids;
};

const setCacheForRole = (idRole, ids) => {
  const key = Number.parseInt(idRole, 10);
  if (Number.isNaN(key)) {
    return;
  }
  idCacheByRole.set(key, ids);
};

const clearCacheForRole = (idRole) => {
  const key = Number.parseInt(idRole, 10);
  if (Number.isNaN(key)) {
    return;
  }
  idCacheByRole.delete(key);
};

const getCachedIdsForRole = (idRole) => {
  const key = Number.parseInt(idRole, 10);
  if (Number.isNaN(key)) {
    return undefined;
  }
  return idCacheByRole.get(key);
};

const ensureIdsForRole = async (idRole) => {
  const cached = getCachedIdsForRole(idRole);
  if (cached && cached.length > 0) {
    return cached;
  }
  const { rows } = await db.query(
    'SELECT id FROM reltheme WHERE id_role = $1 ORDER BY id',
    [idRole]
  );
  const ids = rows.map((row) => row.id);
  setCacheForRole(idRole, ids);
  return ids;
};

const computeNavigation = (ids, currentId) => {
  if (!Array.isArray(ids) || ids.length === 0) {
    return {};
  }
  const currentIndex = ids.findIndex((id) => Number(id) === Number(currentId));
  if (currentIndex === -1) {
    return {};
  }
  const nextIndex = (currentIndex + 1) % ids.length;
  const previousIndex = (currentIndex - 1 + ids.length) % ids.length;

  if (ids.length === 1) {
    return {
      idSuivant: padId(ids[0]),
      idPrecedent: padId(ids[0]),
    };
  }

  return {
    idSuivant: padId(ids[nextIndex]),
    idPrecedent: padId(ids[previousIndex]),
  };
};

const buildRelThemeSelect = (extraWhere = '', extraParams = []) => {
  const base = `
    SELECT
      rt.id,
      rt.nom,
      rt.modifts,
      rt.id_theme,
      rt.id_qui,
      rt.id_quoi,
      rt.id_role,
      COALESCE(NULLIF(q.fullname, ''), NULLIF(CONCAT_WS(' ', q.prenom, q.nom), ''), '') AS qui_nomprenom,
      COALESCE(t.nom, '') AS theme_nom,
      COALESCE(quoi.nom, '') AS quoi_nom,
      COALESCE(r.nom, '') AS role_nom
    FROM reltheme rt
    LEFT JOIN qui q ON q.id = rt.id_qui
    LEFT JOIN theme t ON t.id = rt.id_theme
    LEFT JOIN quoi ON quoi.id = rt.id_quoi
    LEFT JOIN role r ON r.id = rt.id_role
    ${extraWhere}
  `;
  return {
    text: `${base} ORDER BY rt.id`,
    params: extraParams,
  };
};

exports.getRelThemesByQui = async (req, res) => {
  console.log('getRelThemesByQui');
  try {
    const { idQui } = req.params;
    const query = buildRelThemeSelect('WHERE rt.id_qui = $1', [idQui]);
    const { rows } = await db.query(query.text, query.params);
    setCacheForQui(idQui, rows.map((row) => row.id));
    res.json(rows);
  } catch (error) {
    console.error('Unable to fetch reltheme by qui', error);
    res.status(500).json({ error: error.message });
  }
};

exports.getAllRelThemes = async (_req, res) => {
  console.log('getAllRelThemes');
  try {
    const query = buildRelThemeSelect();
    const { rows } = await db.query(query.text, query.params);
    res.json(rows);
  } catch (error) {
    console.error('Unable to fetch relthemes', error);
    res.status(500).json({ error: error.message });
  }
};

exports.getRelThemesByTheme = async (req, res) => {
  console.log('getRelThemesByTheme');
  try {
    const { idTheme } = req.params;
    const query = buildRelThemeSelect('WHERE rt.id_theme = $1', [idTheme]);
    const { rows } = await db.query(query.text, query.params);
    rows.forEach((row) => {
      if (row?.id_qui) {
        const cache = getCachedIdsForQui(row.id_qui);
        if (!cache) {
          setCacheForQui(row.id_qui, []);
        }
      }
      if (row?.id_role) {
        const cacheRole = getCachedIdsForRole(row.id_role);
        if (!cacheRole) {
          setCacheForRole(row.id_role, []);
        }
      }
    });
    res.json(rows);
  } catch (error) {
    console.error('Unable to fetch reltheme by theme', error);
    res.status(500).json({ error: error.message });
  }
};

exports.getRelThemesByQuoi = async (req, res) => {
  console.log('getRelThemesByQuoi');
  try {
    const { idQuoi } = req.params;
    const query = buildRelThemeSelect('WHERE rt.id_quoi = $1', [idQuoi]);
    const { rows } = await db.query(query.text, query.params);
    res.json(rows);
  } catch (error) {
    console.error('Unable to fetch reltheme by quoi', error);
    res.status(500).json({ error: error.message });
  }
};

exports.getRelThemesByRole = async (req, res) => {
  console.log('getRelThemesByRole');
  try {
    const { idRole } = req.params;
    const query = buildRelThemeSelect('WHERE rt.id_role = $1', [idRole]);
    const { rows } = await db.query(query.text, query.params);
    setCacheForRole(idRole, rows.map((row) => row.id));
    res.json(rows);
  } catch (error) {
    console.error('Unable to fetch reltheme by role', error);
    res.status(500).json({ error: error.message });
  }
};

exports.getRelThemeById = async (req, res) => {
  console.log('getRelThemeById');
  try {
    const { id } = req.params;
    const query = buildRelThemeSelect('WHERE rt.id = $1', [id]);
    const { rows } = await db.query(query.text, query.params);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'RelTheme not found' });
    }
    const relTheme = rows[0];
    let ids = [];
    if (relTheme.id_role) {
      ids = await ensureIdsForRole(relTheme.id_role);
    } else if (relTheme.id_qui) {
      ids = await ensureIdsForQui(relTheme.id_qui);
    }
    if (ids && ids.length) {
      const navigation = computeNavigation(ids, relTheme.id);
      Object.assign(relTheme, navigation);
    }
    res.json(relTheme);
  } catch (error) {
    console.error('Unable to fetch reltheme by id', error);
    res.status(500).json({ error: error.message });
  }
};

exports.createRelTheme = async (req, res) => {
  try {
    const { nom, id_theme, id_qui, id_quoi, id_role } = req.body;
      console.log('createRelTheme nom='+nom);
    const parsedIdQui = toNumberOrNull(id_qui);
    const parsedIdQuoi = toNumberOrNull(id_quoi);
    const parsedIdRole = toNumberOrNull(id_role);
    if (!Number.isInteger(parsedIdQui) && !Number.isInteger(parsedIdQuoi) && !Number.isInteger(parsedIdRole)) {
      return res.status(400).json({ error: 'id_qui, id_quoi ou id_role requis' });
    }
    const { rows: idRows } = await db.query(
      'SELECT COALESCE(MAX(id), 0) + 1 AS id FROM reltheme'
    );
    const newId = idRows[0].id;
    const timestamp = getCurrentTimestamp();
    const fields = [
      newId,
      nom || null,
      timestamp,
      toNumberOrNull(id_theme),
      parsedIdQui,
      parsedIdQuoi,
      parsedIdRole,
    ];
    const { rows } = await db.query(
      `INSERT INTO reltheme (
        id,
        nom,
        modifts,
        id_theme,
        id_qui,
        id_quoi,
        id_role
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id, nom, modifts, id_theme, id_qui, id_quoi, id_role`,
      fields
    );
    if (Number.isInteger(parsedIdQui)) {
      clearCacheForQui(parsedIdQui);
    }
    if (Number.isInteger(parsedIdRole)) {
      clearCacheForRole(parsedIdRole);
    }
    res.status(201).json(rows[0]);
  } catch (error) {
    console.error('Unable to create reltheme', error);
    res.status(500).json({ error: error.message });
  }
};

exports.updateRelTheme = async (req, res) => {
  console.log('updateRelTheme');
  try {
    const { id } = req.params;
    const { nom, id_theme, id_qui, id_quoi, id_role } = req.body;

    const { rows: existingRows } = await db.query(
      'SELECT id_qui, id_role FROM reltheme WHERE id = $1',
      [id]
    );
    if (existingRows.length === 0) {
      return res.status(404).json({ error: 'RelTheme not found' });
    }
    const currentIdQui = existingRows[0].id_qui;
    const currentIdRole = existingRows[0].id_role;
    const parsedIdQui = toNumberOrNull(id_qui) ?? currentIdQui;
    const parsedIdRole = toNumberOrNull(id_role) ?? currentIdRole;

    const timestamp = getCurrentTimestamp();
    const result = await db.query(
      `UPDATE reltheme
       SET nom=$1,
           modifts=$2,
           id_theme=$3,
           id_qui=$4,
           id_quoi=$5,
           id_role=$6
       WHERE id=$7`,
      [
        nom || null,
        timestamp,
        toNumberOrNull(id_theme),
        parsedIdQui,
        toNumberOrNull(id_quoi),
        parsedIdRole,
        id,
      ]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'RelTheme not found' });
    }
    clearCacheForQui(currentIdQui);
    if (parsedIdQui !== currentIdQui) {
      clearCacheForQui(parsedIdQui);
    }
    clearCacheForRole(currentIdRole);
    if (parsedIdRole !== currentIdRole) {
      clearCacheForRole(parsedIdRole);
    }
    res.json({ message: 'RelTheme updated' });
  } catch (error) {
    console.error('Unable to update reltheme', error);
    res.status(500).json({ error: error.message });
  }
};

exports.deleteRelTheme = async (req, res) => {
  console.log('deleteRelTheme');
  try {
    const { id } = req.params;
    const { rows: existingRows } = await db.query(
      'SELECT id_qui FROM reltheme WHERE id = $1',
      [id]
    );
    if (existingRows.length === 0) {
      return res.status(404).json({ error: 'RelTheme not found' });
    }
    const idQui = existingRows[0].id_qui;
    const { rowCount } = await db.query(
      'DELETE FROM reltheme WHERE id = $1',
      [id]
    );
    if (rowCount === 0) {
      return res.status(404).json({ error: 'RelTheme not found' });
    }
    clearCacheForQui(idQui);
    res.json({ message: 'RelTheme deleted' });
  } catch (error) {
    console.error('Unable to delete reltheme', error);
    res.status(500).json({ error: error.message });
  }
};
