#!/usr/bin/env node
// retourne le chemin absolu (cf. absPath)
// à utiliser pour la sauvegarde incrémentale:
/*
  node list-tree-dirAbs ^
   "C:\PARTAGE\Music" ^
   "C:\PARTAGE\Music\sourceDir.txt"
*/

const fs = require('fs').promises;
const path = require('path');

const args = process.argv.slice(2);
const [inputDir, outputFile] = args;

function normalizeRel(p) {
  return p.split(path.sep).join('/');
}

async function collectTree(rootDir, baseDir, level) {

  //pour test : console.log(`collectTree :  level=${level} ; rootDir=${rootDir} ; baseDir=${baseDir}`);

  const dirPath = path.join(rootDir, baseDir);
  let entries;

  try {
    entries = await fs.readdir(dirPath, { withFileTypes: true });
  } catch (error) {
    if (error.code === 'EPERM' || error.code === 'EACCES') {
      console.error(`Ignoré : accès refusé à ${dirPath}`);
      return [];
    }
    throw error;
  }

  const results = [];

  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    if (!entry.isDirectory()) {
      continue;
    }

    if (entry.name.toUpperCase() === '$RECYCLE.BIN') {
      console.error(`Ignoré : dossier système ${entry.name}`);
      continue;
    }

    const relPath = normalizeRel(path.posix.join(baseDir, entry.name));

    const absPath =  normalizeRel(path.posix.join(rootDir,baseDir, entry.name));
    //console.log("absPath : " +absPath);

    const children = await collectTree(rootDir, relPath, level + 1);

    if (/\.(mp3|wma)\.files$/.test(entry.name)) {
      // ne pas sélectrionner si entry.name se termine par ".mp3.files" OU ".wma.files"
      //pour test : console.log(`Ignoré : dossier spécial ${entry.name}`);
      continue;
    }

    results.push({ name: entry.name, path: relPath, children, absPath: absPath });
  }

  return results;
}

function flattenTree(nodes, lines = []) {
  for (const node of nodes) {
    lines.push(node.absPath);
    flattenTree(node.children, lines);
  }
  return lines;
}

async function main() {
  if (!inputDir || !outputFile) {
    console.log('Usage: node list-tree.js <repertoire> <fichier-sortie.txt>' );
    process.exit(1);
  }

  const normalizedInputDir = inputDir.replace(/\\/g, '/');
  const rootDir = path.resolve(normalizedInputDir);
  const targetFile = path.resolve(outputFile);

  const tree = await collectTree(rootDir, '', 1);
  const ext = path.extname(targetFile).toLowerCase();

  const lines = flattenTree(tree);
  await fs.writeFile(targetFile, `${lines.join('\n')}\n`, 'utf8');

  console.log(`Liste écrite dans ${targetFile}`);
}

main().catch((error) => {
  console.error('Erreur:', error.message);
  process.exit(1);
});
