#!/usr/bin/env node
//exemple : 
// cd z* cd a*
//  node list-tree-file-mp3 "C:\PARTAGE\Music" "France Rock"
const fs = require('fs').promises;
const path = require('path');

const args = process.argv.slice(2);
const [musicDir, prefix] = args;
const inputDir=musicDir+"\\"+prefix;
const outputFile=musicDir+"\\Playlists\\_"+prefix+".m3u";
console.log("inputDir:", inputDir);
console.log("prefix:", prefix);
console.log("outputFile:", outputFile);


function normalizeRel(p) {
  return p.split(path.sep).join('\\');
}

async function collectTree(rootDir, baseDir = '') {
  const entries = await fs.readdir(path.join(rootDir, baseDir), { withFileTypes: true });
  const results = [];

  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const relPath = normalizeRel(path.join(baseDir, entry.name));
    const absPath = path.join(rootDir, baseDir, entry.name);

    if (entry.isDirectory()) {
      const children = await collectTree(rootDir, relPath);
      results.push(...children);
    } else if (entry.isFile() && entry.name.endsWith('.mp3')) {
      // Filtrer uniquement les fichiers .mp3
      results.push("..\\"+prefix+"\\" + relPath.replace("/", "\\"));
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
  console.log(`Répertoire d'entrée: ${normalizedInputDir}`);
  const rootDir = path.resolve(normalizedInputDir);
  const targetFile = path.resolve(outputFile);

  const lines = await collectTree(rootDir);
  await fs.writeFile(targetFile, `${lines.join('\n')}\n`, 'utf8');

  console.log(`Liste des fichiers .mp3 écrite dans ${targetFile}`);
}

main().catch((error) => {
  console.error('Erreur:', error.message);
  process.exit(1);
});