#!/usr/bin/env node
//exemple: node list-tree-fileAbs C:\PARTAGE\Music C:\PARTAGE\Music\files.txt
// retourne le chemin absolu (cf. absPath)
// à utiliser pour la sauvegarde incrémentale:
// node list-tree-fileAbs C:\PARTAGE\Music C:\PARTAGE\Music\musicSource.txt
// node list-tree-fileAbs E:\Music C:\PARTAGE\Music\musicCibleOld.txt
// suite: voire compare-text-2files
// prérequis: compare-text-2dirs
const fs = require('fs').promises;
const path = require('path');

const args = process.argv.slice(2);
const [inputDir, outputFile] = args;

function normalizeRel(p) {
  return p.split(path.sep).join('/');
}

async function collectTree(rootDir, baseDir = '') {
  const entries = await fs.readdir(path.join(rootDir, baseDir), { withFileTypes: true });
  const results = [];
  //console.log("collectTree : rootDir=", rootDir, " baseDir=", baseDir);

  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const relPath = normalizeRel(path.posix.join(baseDir, entry.name));
    const absPath = path.join(rootDir, baseDir, entry.name);

    if (entry.isDirectory()) {
      const children = await collectTree(rootDir, relPath);
      results.push(...children);
    } else if (entry.isFile()) {
      results.push(absPath); // On ajoute le chemin complet au lieu de relPath
    }
  }

  return results;
}


async function main() {
  if (!inputDir || !outputFile) {
    console.log('Usage: node list-tree.js <repertoire> <fichier-sortie.txt>');
    process.exit(1);
  }

  const normalizedInputDir = inputDir.replace(/\\/g, '/');
  const rootDir = path.resolve(normalizedInputDir);
  const targetFile = path.resolve(outputFile);

  const lines = await collectTree(rootDir);
  await fs.writeFile(targetFile, `${lines.join('\n')}\n`, 'utf8');

  console.log(`Liste écrite dans ${targetFile}`);
}

main().catch((error) => {
  console.error('Erreur:', error.message);
  process.exit(1);
});
