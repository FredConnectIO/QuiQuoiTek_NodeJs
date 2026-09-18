#!/usr/bin/env node
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

  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const relPath = normalizeRel(path.posix.join(baseDir, entry.name));
    const absPath = path.join(rootDir, baseDir, entry.name);

    if (entry.isDirectory()) {
      const children = await collectTree(rootDir, relPath);
      results.push(...children);
    } else if (entry.isFile()) {
      results.push(relPath);
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
