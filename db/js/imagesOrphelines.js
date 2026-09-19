// Liste : node db/js/imagesOrphelines.js
// Supprime : node db/js/imagesOrphelines.js exec
const fs = require('fs').promises;
const path = require('path');
const { Client } = require('pg');

const DEFAULT_PHOTOS_DIRECTORY = 'C:\\PARTAGE\\QQT_Data\\Photos';
const TABLE_BY_PREFIX = { i: 'qui', o: 'quoi', r: 'role' };
const IMAGE_EXTENSION = /\.(png|jpe?g|gif|bmp|webp|tiff?|svg|avif|heic|heif|ico)$/i;

function parseArgs(args) {
  const options = { execute: false, photosDir: DEFAULT_PHOTOS_DIRECTORY };
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === 'exec') options.execute = true;
    else if (arg === '--help' || arg === '-h') options.help = true;
    else if (arg === '--photos-dir') {
      const value = args[++index];
      if (!value || value.startsWith('--')) throw new Error('--photos-dir exige un chemin.');
      options.photosDir = value;
    } else throw new Error(`Argument inconnu : ${arg}`);
  }
  options.photosDir = path.resolve(options.photosDir);
  return options;
}

function orphanReason(filename, ids) {
  const match = /^([ior])(\d{7,})-(\d{3})\.[^.]+$/i.exec(filename);
  if (!match) return 'nom sans lien qui/quoi/role reconnu';
  const table = TABLE_BY_PREFIX[match[1].toLowerCase()];
  const id = BigInt(match[2]).toString();
  return ids[table].has(id) ? null : `${table} #${id} absent`;
}

async function imagesOrphelines(options, client = new Client({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'fred',
  port: Number(process.env.DB_PORT || 5432),
  database: process.env.DB_NAME || 'quiquoitekdb',
  connectionTimeoutMillis: 10000,
})) {
  const directory = await fs.realpath(options.photosDir);
  // Pas de parcours des sous-dossiers ni de suivi des liens symboliques.
  const entries = await fs.readdir(directory, { withFileTypes: true });
  let transaction = false;
  let deleted = 0;
  try {
    await client.connect();
    await client.query('BEGIN');
    transaction = true;
    // Empeche la creation ou la renumerotation d'un proprietaire pendant la suppression.
    if (options.execute) {
      await client.query("SET LOCAL lock_timeout = '10s'");
      await client.query('LOCK TABLE public.qui, public.quoi, public.role IN SHARE MODE');
    }
    const { rows } = await client.query(`
      SELECT 'qui' AS entity, id::text AS id FROM public.qui
      UNION ALL SELECT 'quoi', id::text FROM public.quoi
      UNION ALL SELECT 'role', id::text FROM public.role
    `);
    const ids = { qui: new Set(), quoi: new Set(), role: new Set() };
    for (const row of rows) ids[row.entity].add(row.id);
    const orphans = entries
      .filter(entry => entry.isFile() && IMAGE_EXTENSION.test(entry.name))
      .map(entry => ({ filename: entry.name, reason: orphanReason(entry.name, ids) }))
      .filter(entry => entry.reason)
      .sort((a, b) => a.filename.localeCompare(b.filename, 'fr', { numeric: true }));

    console.log(`Dossier : ${directory}`);
    console.log(`${orphans.length} image(s) orpheline(s) :`);
    for (const orphan of orphans) {
      const filePath = path.join(directory, orphan.filename);
      console.log(`${filePath} (${orphan.reason})`);
      if (options.execute) {
        const stat = await fs.lstat(filePath);
        if (!stat.isFile() || stat.isSymbolicLink()) {
          throw new Error(`Le fichier a change de type : ${filePath}`);
        }
        await fs.unlink(filePath);
        deleted += 1;
      }
    }
    await client.query('COMMIT');
    transaction = false;
    console.log(options.execute
      ? `${deleted} image(s) supprimee(s).`
      : 'Aucune suppression. Ajouter exec pour supprimer ces images.');
    return { orphans, deleted };
  } catch (error) {
    if (transaction) await client.query('ROLLBACK').catch(() => {});
    if (options.execute) console.error(`${deleted} image(s) deja supprimee(s) avant l'erreur.`);
    throw error;
  } finally {
    await client.end();
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    console.log(`Usage : node db/js/imagesOrphelines.js [exec] [--photos-dir "chemin"]
Par defaut : ${DEFAULT_PHOTOS_DIRECTORY}
Liste les chemins des images sans proprietaire dans qui, quoi ou role.
Les prefixes i/o/r et l'identifiant du nom determinent le proprietaire.
Les images dont le nom ne suit pas cette convention sont aussi orphelines.
Sous-dossiers, liens symboliques et fichiers non images ignores.
exec : suppression definitive des images listees. Aucune modification en base.
Connexion : DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME (comme compactIds.js).`);
    return;
  }
  await imagesOrphelines(options);
}

if (require.main === module) {
  main().catch(error => {
    console.error('imagesOrphelines :', error.message);
    process.exitCode = 1;
  });
}

module.exports = { parseArgs, orphanReason, imagesOrphelines };
