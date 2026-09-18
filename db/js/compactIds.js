// node db/js/compactIds.js --start-at-one --execute --photos-dir "C:\PARTAGE\QQT_Data\Photos"
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const DB_CONFIG = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'fred',
  port: Number(process.env.DB_PORT || 5432),
  database: process.env.DB_NAME || 'quiquoitekdb',
};

const DEFAULT_PHOTOS_DIRECTORY = path.resolve('C:\\PARTAGE\\QQT_Data\\Photos');
const TABLE_ORDER = ['qui', 'quoi', 'role', 'theme', 'reltheme', 'poste', 'parametre'];
const IMAGE_PREFIX_BY_TABLE = {
  qui: 'i',
  quoi: 'o',
  role: 'r',
};
const EXTRA_REFERENCE_COLUMNS = {
  qui: ['id_qui_element', 'id_qui_ensemble'],
};

const quoteIdentifier = (identifier) => `"${identifier.replace(/"/g, '""')}"`;
const padId = (id) => String(id).padStart(7, '0');

const parseArgs = (argv) => {
  const options = {
    execute: false,
    photosDir: DEFAULT_PHOTOS_DIRECTORY,
    startAtOne: false,
  };

  for (let index = 2; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--execute') {
      options.execute = true;
    } else if (arg === '--dry-run') {
      options.execute = false;
    } else if (arg === '--start-at-one') {
      options.startAtOne = true;
    } else if (arg === '--photos-dir') {
      index += 1;
      if (!argv[index]) {
        throw new Error('Option --photos-dir sans valeur.');
      }
      options.photosDir = path.resolve(argv[index]);
    } else if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else {
      throw new Error(`Option inconnue: ${arg}`);
    }
  }

  return options;
};

const printHelp = () => {
  console.log(`
Usage:
  node db/js/compactIds.js [--dry-run]
  node db/js/compactIds.js --execute [--photos-dir "C:\\PARTAGE\\QQT_Data\\Photos"] [--start-at-one]

But:
  Bouche les trous dans les champs id des tables publiques, en conservant
  l'ordre ancien des ids: le premier ancien id est conserve, les suivants
  deviennent consecutifs.
  Ajouter --start-at-one pour forcer 1er ancien id -> 1, 2e ancien id -> 2, etc.

Images:
  Renomme aussi les images liees aux tables connues:
    qui  : i0000001-001.png
    quoi : o0000001-001.png
    role : r0000001-001.png

Securite:
  Par defaut le script simule seulement les changements.
  Ajouter --execute pour modifier la base et renommer les fichiers.
`);
};

const getIdTables = async (client) => {
  const { rows } = await client.query(`
    SELECT table_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND column_name = 'id'
    ORDER BY table_name
  `);
  const detected = rows.map((row) => row.table_name);
  const ordered = TABLE_ORDER.filter((table) => detected.includes(table));
  const extras = detected.filter((table) => !TABLE_ORDER.includes(table)).sort();
  return [...ordered, ...extras];
};

const getIntegerColumns = async (client, tableName) => {
  const { rows } = await client.query(
    `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = $1
        AND data_type IN ('integer', 'bigint', 'smallint')
      ORDER BY ordinal_position
    `,
    [tableName]
  );
  return rows.map((row) => row.column_name);
};

const getIdMapping = async (client, tableName, startAtOne) => {
  const sql = `SELECT id FROM public.${quoteIdentifier(tableName)} ORDER BY id`;
  const { rows } = await client.query(sql);
  const ids = rows.map((row) => Number(row.id));

  for (const id of ids) {
    if (!Number.isSafeInteger(id) || id <= 0) {
      throw new Error(`Id invalide dans ${tableName}: ${id}. Les ids doivent etre des entiers positifs.`);
    }
  }

  const firstNewId = startAtOne ? 1 : (ids[0] || 1);

  return ids.map((oldId, index) => ({
    oldId,
    newId: firstNewId + index,
  })).filter(({ oldId, newId }) => oldId !== newId);
};

const buildReferenceColumns = (tables, columnsByTable) => {
  const result = [];

  for (const tableName of tables) {
    const columns = columnsByTable.get(tableName) || [];
    for (const targetTable of tables) {
      const candidates = [`id_${targetTable}`, ...(EXTRA_REFERENCE_COLUMNS[targetTable] || [])];
      for (const columnName of candidates) {
        if (columnName !== 'id' && columns.includes(columnName)) {
          result.push({
            tableName,
            columnName,
            targetTable,
          });
        }
      }
    }
  }

  return result;
};

const buildCaseUpdate = ({ tableName, columnName, mapping }) => {
  const values = [];
  const cases = mapping.map(({ oldId, newId }, index) => {
    values.push(oldId, newId);
    return `WHEN $${index * 2 + 1} THEN $${index * 2 + 2}`;
  });
  const oldIdPlaceholders = mapping.map((_, index) => `$${mapping.length * 2 + index + 1}`);
  values.push(...mapping.map(({ oldId }) => oldId));

  return {
    sql: `
      UPDATE public.${quoteIdentifier(tableName)}
      SET ${quoteIdentifier(columnName)} = CASE ${quoteIdentifier(columnName)}
        ${cases.join('\n        ')}
        ELSE ${quoteIdentifier(columnName)}
      END
      WHERE ${quoteIdentifier(columnName)} IN (${oldIdPlaceholders.join(', ')})
    `,
    values,
  };
};

const updateReferenceColumn = async (client, reference, mapping) => {
  if (!mapping.length) {
    return 0;
  }
  const { sql, values } = buildCaseUpdate({ ...reference, mapping });
  const result = await client.query(sql, values);
  return result.rowCount;
};

const updateTableIds = async (client, tableName, mapping) => {
  if (!mapping.length) {
    return 0;
  }

  const changedOldIds = mapping.map(({ oldId }) => oldId);
  const placeholders = changedOldIds.map((_, index) => `$${index + 1}`);
  await client.query(
    `
      UPDATE public.${quoteIdentifier(tableName)}
      SET id = -id
      WHERE id IN (${placeholders.join(', ')})
    `,
    changedOldIds
  );

  const { sql, values } = buildCaseUpdate({
    tableName,
    columnName: 'id',
    mapping: mapping.map(({ oldId, newId }) => ({ oldId: -oldId, newId })),
  });
  const result = await client.query(sql, values);
  return result.rowCount;
};

const listImageRenames = async (photosDir, mappingsByTable) => {
  let entries;
  try {
    entries = await fs.promises.readdir(photosDir, { withFileTypes: true });
  } catch (err) {
    if (err.code === 'ENOENT') {
      return { renames: [], directoryExists: false };
    }
    throw err;
  }

  const renames = [];
  for (const [tableName, prefix] of Object.entries(IMAGE_PREFIX_BY_TABLE)) {
    const mapping = mappingsByTable.get(tableName) || [];
    if (!mapping.length) {
      continue;
    }
    const idByOldPadded = new Map(mapping.map(({ oldId, newId }) => [padId(oldId), padId(newId)]));
    const pattern = new RegExp(`^${prefix}(\\d{7})-(\\d{3})\\.png$`, 'i');

    for (const entry of entries) {
      if (!entry.isFile()) {
        continue;
      }
      const match = pattern.exec(entry.name);
      if (!match) {
        continue;
      }
      const newPaddedId = idByOldPadded.get(match[1]);
      if (!newPaddedId) {
        continue;
      }
      const newName = `${prefix}${newPaddedId}-${match[2]}.png`;
      if (newName.toLowerCase() === entry.name.toLowerCase()) {
        continue;
      }
      renames.push({
        tableName,
        oldName: entry.name,
        newName,
        oldPath: path.join(photosDir, entry.name),
        tempPath: path.join(photosDir, `.__compact-id-${Date.now()}-${entry.name}`),
        newPath: path.join(photosDir, newName),
      });
    }
  }

  return { renames, directoryExists: true };
};

const checkImageCollisions = async (renames) => {
  const sourceNames = new Set(renames.map((rename) => rename.oldName.toLowerCase()));
  const targetNames = new Set();

  for (const rename of renames) {
    const targetName = rename.newName.toLowerCase();
    if (targetNames.has(targetName)) {
      throw new Error(`Collision image: plusieurs fichiers veulent devenir ${rename.newName}.`);
    }
    targetNames.add(targetName);

    if (!sourceNames.has(targetName)) {
      try {
        await fs.promises.access(rename.newPath, fs.constants.F_OK);
        throw new Error(`Collision image: le fichier cible existe deja: ${rename.newPath}`);
      } catch (err) {
        if (err.code !== 'ENOENT') {
          throw err;
        }
      }
    }
  }
};

const renameImages = async (renames) => {
  const completedTemps = [];
  const completedFinals = [];

  try {
    for (const rename of renames) {
      await fs.promises.rename(rename.oldPath, rename.tempPath);
      completedTemps.push(rename);
    }
    for (const rename of renames) {
      await fs.promises.rename(rename.tempPath, rename.newPath);
      completedFinals.push(rename);
    }
  } catch (err) {
    for (const rename of completedFinals.reverse()) {
      try {
        await fs.promises.rename(rename.newPath, rename.oldPath);
      } catch (rollbackErr) {
        console.error(`Rollback image impossible ${rename.newPath} -> ${rename.oldPath}:`, rollbackErr.message);
      }
    }
    for (const rename of completedTemps.reverse()) {
      try {
        await fs.promises.rename(rename.tempPath, rename.oldPath);
      } catch (rollbackErr) {
        console.error(`Rollback image impossible ${rename.tempPath} -> ${rename.oldPath}:`, rollbackErr.message);
      }
    }
    throw err;
  }
};

const printPlan = ({ mappingsByTable, references, photosDir, photosDirExists, imageRenames }) => {
  console.log('Plan de renumerotation:');
  for (const [tableName, mapping] of mappingsByTable.entries()) {
    if (!mapping.length) {
      console.log(`- ${tableName}: aucun trou`);
      continue;
    }
    const preview = mapping.slice(0, 8).map(({ oldId, newId }) => `${oldId}->${newId}`).join(', ');
    const suffix = mapping.length > 8 ? ', ...' : '';
    console.log(`- ${tableName}: ${mapping.length} id(s) a changer (${preview}${suffix})`);
  }

  console.log('\nColonnes de reference a synchroniser:');
  for (const reference of references) {
    const mapping = mappingsByTable.get(reference.targetTable) || [];
    if (mapping.length) {
      console.log(`- ${reference.tableName}.${reference.columnName} -> ${reference.targetTable}.id`);
    }
  }

  console.log(`\nImages a renommer (${photosDir}${photosDirExists ? '' : ' introuvable'}):`);
  if (!imageRenames.length) {
    console.log('- aucune');
  } else {
    for (const rename of imageRenames.slice(0, 20)) {
      console.log(`- ${rename.oldName} -> ${rename.newName}`);
    }
    if (imageRenames.length > 20) {
      console.log(`- ... ${imageRenames.length - 20} autre(s)`);
    }
  }
};

const compactIds = async (options) => {
  const client = new Client(DB_CONFIG);
  await client.connect();

  try {
    const tables = await getIdTables(client);
    const mappingsByTable = new Map();
    const columnsByTable = new Map();

    for (const tableName of tables) {
      mappingsByTable.set(tableName, await getIdMapping(client, tableName, options.startAtOne));
      columnsByTable.set(tableName, await getIntegerColumns(client, tableName));
    }

    const references = buildReferenceColumns(tables, columnsByTable);
    const { renames: imageRenames, directoryExists: photosDirExists } =
      await listImageRenames(options.photosDir, mappingsByTable);
    await checkImageCollisions(imageRenames);

    printPlan({
      mappingsByTable,
      references,
      photosDir: options.photosDir,
      photosDirExists,
      imageRenames,
    });

    if (!options.execute) {
      console.log('\nSimulation terminee. Ajouter --execute pour appliquer ces changements.');
      return;
    }

    await client.query('BEGIN');
    try {
      for (const reference of references) {
        const mapping = mappingsByTable.get(reference.targetTable) || [];
        const rowCount = await updateReferenceColumn(client, reference, mapping);
        if (rowCount > 0) {
          console.log(`Reference maj: ${reference.tableName}.${reference.columnName} (${rowCount} ligne(s))`);
        }
      }

      for (const [tableName, mapping] of mappingsByTable.entries()) {
        const rowCount = await updateTableIds(client, tableName, mapping);
        if (rowCount > 0) {
          console.log(`Ids maj: ${tableName} (${rowCount} ligne(s))`);
        }
      }

      await renameImages(imageRenames);
      await client.query('COMMIT');
      console.log(`Images renommees: ${imageRenames.length}`);
      console.log('Renumerotation terminee avec succes.');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    }
  } finally {
    await client.end();
  }
};

const main = async () => {
  const options = parseArgs(process.argv);
  if (options.help) {
    printHelp();
    return;
  }
  await compactIds(options);
};

if (require.main === module) {
  main().catch((err) => {
    console.error('compactIds echoue:', err.message);
    process.exitCode = 1;
  });
}

module.exports = {
  compactIds,
};
