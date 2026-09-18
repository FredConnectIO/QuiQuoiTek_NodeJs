const db = require('../db');

let listIdPoste = ';';

const padId = (value) => value.toString().padStart(7, '0');
const getCurrentTimestamp = () => new Date().toISOString().split('.')[0];

const buildFullname = (nom, prenom) => {
  const parts = [];
  if (prenom) {
    parts.push(prenom.trim());
  }
  if (nom) {
    parts.push(nom.trim());
  }
  if (!parts.length) {
    return '';
  }
  return parts.join(' ').trim();
};

const enrichPosteRow = (row) => {
  if (!row) {
    return row;
  }
  return {
    ...row,
    qui_fullname: buildFullname(row.qui_nom, row.qui_prenom),
    quiensemble_fullname: buildFullname(row.quiensemble_nom, row.quiensemble_prenom),
  };
};

const rebuildPosteListCache = (rows) => {
  listIdPoste = ';';
  rows.forEach((poste) => {
    listIdPoste += padId(poste.id) + ';';
  });
};

const ensurePosteListCache = async () => {
  if (listIdPoste.length > 1) {
    return;
  }
  const { rows } = await db.query('SELECT id FROM poste ORDER BY id');
  rebuildPosteListCache(rows);
};

exports.getAllPostes = async (req, res) => {
  console.log('getAllPostes');
  try {
    const { rows } = await db.query(
      `SELECT
         poste.*,
         q.nom AS qui_nom,
         q.prenom AS qui_prenom,
         q.domaine AS qui_domaine,
         q.genre AS qui_genre,
         qg.nom AS quiensemble_nom,
         qg.prenom AS quiensemble_prenom,
         qg.domaine AS quiensemble_domaine,
         qg.genre AS quiensemble_genre
       FROM poste
       LEFT JOIN qui q ON poste.id_qui_element = q.id
       LEFT JOIN qui qg ON poste.id_qui_ensemble = qg.id
       ORDER BY poste.id`
    );
    rebuildPosteListCache(rows);
    res.json(rows.map(enrichPosteRow));
  } catch (err) {
    console.error('Unable to list postes', err);
    res.status(500).json({ error: err.message });
  }
};

exports.getPosteById = async (req, res) => {
  console.log('getPosteById');
  try {
    const { id } = req.params;
    const { rows } = await db.query(
      `SELECT
         poste.*,
         q.nom AS qui_nom,
         q.prenom AS qui_prenom,
         q.domaine AS qui_domaine,
         q.genre AS qui_genre,
         q.modifts AS qui_modifts,
         qg.nom AS quiensemble_nom,
         qg.prenom AS quiensemble_prenom,
         qg.domaine AS quiensemble_domaine,
         qg.genre AS quiensemble_genre,
         qg.modifts AS quiensemble_modifts
       FROM poste
       LEFT JOIN qui q ON poste.id_qui_element = q.id
       LEFT JOIN qui qg ON poste.id_qui_ensemble = qg.id
       WHERE poste.id = $1`,
      [id]
    );
    if (!rows.length) {
      return res.status(404).json({ error: 'Poste not found' });
    }
    await ensurePosteListCache();
    const poste = enrichPosteRow(rows[0]);
    if (listIdPoste.length > 1) {
      const searchToken = ';' + padId(id) + ';';
      const posIdSuivant = listIdPoste.indexOf(searchToken) + 9;
      if (posIdSuivant + 7 > listIdPoste.length) {
        poste.idSuivant = listIdPoste.substring(1, 8);
      } else {
        poste.idSuivant = listIdPoste.substring(posIdSuivant, posIdSuivant + 7);
      }
      const posIdPrecedent = posIdSuivant - 16;
      if (posIdPrecedent > 0) {
        poste.idPrecedent = listIdPoste.substring(posIdPrecedent, posIdPrecedent + 7);
      } else {
        poste.idPrecedent = listIdPoste.substring(
          listIdPoste.length - 8,
          listIdPoste.length - 1
        );
      }
    }
    res.json(poste);
  } catch (err) {
    console.error('Unable to fetch poste', err);
    res.status(500).json({ error: err.message });
  }
};

exports.createPoste = async (req, res) => {
  console.log('createPoste');
  try {
    const { descr } = req.body;
    const { rows: idRows } = await db.query('SELECT COALESCE(MAX(id), 0) + 1 AS id FROM poste');
    const newId = idRows[0].id;
    const timestamp = getCurrentTimestamp();
    const { rows } = await db.query(
      `INSERT INTO poste (id, descr, modifts)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [newId, descr || 'nouveau poste', timestamp]
    );
    listIdPoste = ';';
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('Unable to create poste', err);
    res.status(500).json({ error: err.message });
  }
};

exports.savePoste = async (req, res) => {
  console.log('savePoste');
  try {
    const { id } = req.params;
    const { descr, id_qui_element, id_qui_ensemble } = req.body;
    const timestamp = getCurrentTimestamp();

    const { rowCount } = await db.query(
      `UPDATE poste
       SET descr = $1,
           modifts = $2,
           id_qui_element = $3,
           id_qui_ensemble = $4
       WHERE id = $5`,
      [descr, timestamp, id_qui_element, id_qui_ensemble, id]
    );
    if (!rowCount) {
      return res.status(404).json({ error: 'Poste not found' });
    }
    listIdPoste = ';';
    res.json({ message: 'Poste updated' });
  } catch (err) {
    console.error('Unable to save poste', err);
    res.status(500).json({ error: err.message });
  }
};

exports.deletePoste = async (req, res) => {
  console.log('deletePoste');
  try {
    const { id } = req.params;
    const { rowCount } = await db.query('DELETE FROM poste WHERE id = $1', [id]);
    if (!rowCount) {
      return res.status(404).json({ error: 'Poste not found' });
    }
    listIdPoste = ';';
    res.json({ message: 'Poste deleted' });
  } catch (err) {
    console.error('Unable to delete poste', err);
    res.status(500).json({ error: err.message });
  }
};
