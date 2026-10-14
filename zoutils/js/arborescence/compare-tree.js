#!/usr/bin/env node
/*
 * ═══════════════════════════════════════════════════════════════════════════
 * COMPARE-TREE.JS
 * Compare deux arborescences de fichiers et détecte les différences
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * DESCRIPTION:
 *   Compare récursivement deux dossiers et génère un rapport détaillé des
 *   différences: fichiers/dossiers manquants, fichiers modifiés (taille,
 *   date de modification, hash SHA256).
 * 
 * LANCEMENT:
 *   node compare-tree.js <dossier1> <dossier2> [OPTIONS]
 * 
 * OPTIONS:
 *   --hash              Comparer aussi les hash SHA256 des fichiers
 *   --json              Afficher le résultat au format JSON
 *   --csv               Exporter le résultat dans 'compare.csv'
 *   --csv=<fichier>     Exporter le résultat dans <fichier>
 * 
 * RÉSULTAT (console par défaut):
 *   - Fichiers/dossiers manquants dans le dossier 1
 *   - Fichiers/dossiers manquants dans le dossier 2
 *   - Fichiers différents (raison: taille, hash, type...)
 * 
 * EXEMPLES:
 *   node compare-tree.js ./path1 ./path2
 *   node compare-tree.js ./path1 ./path2 --hash
 *   node compare-tree.js ./path1 ./path2 --csv
 *   node compare-tree.js ./path1 ./path2 --csv=rapport.csv --hash
 *   node compare-tree.js ./path1 ./path2 --json
 * 
 * ═══════════════════════════════════════════════════════════════════════════
 */

const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

const args = process.argv.slice(2);
let [leftDir, rightDir, ...rest] = args;

// Normaliser les chemins en utilisant des forward slashes
leftDir = leftDir.split(path.sep).join('/');
rightDir = rightDir.split(path.sep).join('/');

const options = {
  hash: false,
  json: false,
  csvFile: null,
};

for (let i = 0; i < rest.length; i++) {
  const arg = rest[i];
  if (arg === '--hash') {
    options.hash = true;
  } else if (arg === '--json') {
    options.json = true;
  } else if (arg.startsWith('--csv=')) {
    options.csvFile = arg.slice('--csv='.length) || 'compare.csv';
  } else if (arg === '--csv') {
    const nextArg = rest[i + 1];
    if (!nextArg || nextArg.startsWith('--')) {
      options.csvFile = 'compare.csv';
    } else {
      options.csvFile = nextArg;
      i += 1;
    }
  }
}

const normalizeRel = (p) => p.split(path.sep).join('/');

async function fileHash(filePath) {
  const hash = crypto.createHash('sha256');
  const stream = await fs.open(filePath, 'r').then((handle) => handle.createReadStream());
  return new Promise((resolve, reject) => {
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', reject);
  });
}

async function collectTree(root) {
  const tree = new Map();
  const stack = [''];

  while (stack.length) {
    const rel = stack.pop();
    const abs = path.join(root, rel);
    let entries;
    try {
      entries = await fs.readdir(abs, { withFileTypes: true });
    } catch (error) {
      throw new Error(`Impossible de lire le dossier ${abs}: ${error.message}`);
    }

    for (const entry of entries) {
      const childRel = normalizeRel(path.join(rel, entry.name));
      const childAbs = path.join(abs, entry.name);

      if (entry.isDirectory()) {
        tree.set(childRel, { type: 'directory' });
        stack.push(path.join(rel, entry.name));
      } else if (entry.isFile()) {
        const stats = await fs.stat(childAbs);
        const record = {
          type: 'file',
          size: stats.size,
          mtime: stats.mtimeMs,
        };
        if (options.hash) {
          record.hash = await fileHash(childAbs);
        }
        tree.set(childRel, record);
      } else {
        tree.set(childRel, { type: 'other' });
      }
    }
  }

  return tree;
}

function diffTrees(leftTree, rightTree) {
  const result = {
    missingInLeft: [],
    missingInRight: [],
    changed: [],
  };

  const allPaths = new Set([...leftTree.keys(), ...rightTree.keys()]);

  for (const relPath of Array.from(allPaths).sort()) {
    const left = leftTree.get(relPath);
    const right = rightTree.get(relPath);

    if (!left) {
      result.missingInLeft.push(relPath);
      continue;
    }
    if (!right) {
      result.missingInRight.push(relPath);
      continue;
    }

    if (left.type !== right.type) {
      result.changed.push({ path: relPath, reason: `type ${left.type} → ${right.type}` });
      continue;
    }

    if (left.type === 'file') {
      if (left.size !== right.size) {
        result.changed.push({ path: relPath, reason: `size ${left.size} → ${right.size}` });
        continue;
      }
      if (options.hash && left.hash !== right.hash) {
        result.changed.push({ path: relPath, reason: 'hash diff' });
      }
    }
  }

  return result;
}

function printDiff(diff) {
  const hasAny = diff.missingInLeft.length || diff.missingInRight.length || diff.changed.length;

  if (!hasAny) {
    return console.log('Les deux arborescences sont identiques.');
  }

  if (diff.missingInLeft.length) {
    console.log('\nFichiers / dossiers manquants dans le premier arbre:');
    diff.missingInLeft.forEach((p) => console.log(`  - ${p}`));
  }
  if (diff.missingInRight.length) {
    console.log('\nFichiers / dossiers manquants dans le second arbre:');
    diff.missingInRight.forEach((p) => console.log(`  - ${p}`));
  }
  if (diff.changed.length) {
    console.log('\nFichiers différents:');
    diff.changed.forEach((item) => console.log(`  - ${item.path}: ${item.reason}`));
  }
}

function escapeCsv(value) {
  const text = String(value == null ? '' : value).replace(/"/g, '""');
  return `"${text}"`;
}

async function writeCsv(diff, csvPath, leftPath, rightPath) {
  const lines = [[leftPath, rightPath, 'description'].map(escapeCsv).join(',')];
  const rows = [];

  diff.missingInLeft.forEach((relPath) => {
    rows.push({ path: relPath, left: '', right: relPath, desc: 'absent path1', sortKey: relPath });
  });
  diff.missingInRight.forEach((relPath) => {
    rows.push({ path: relPath, left: relPath, right: '', desc: 'absent path2', sortKey: relPath });
  });
  diff.changed.forEach((item) => {
    rows.push({ path: item.path, left: item.path, right: item.path, desc: item.reason, sortKey: item.path });
  });

  rows.sort((a, b) => a.sortKey.localeCompare(b.sortKey, undefined, { numeric: true }));

  rows.forEach((row) => {
    lines.push([ row.left, row.right, row.desc ].map(escapeCsv).join(','));
  });

  await fs.writeFile(csvPath, lines.join('\n'), 'utf8');
  console.log(`Résultat CSV écrit dans ${csvPath}`);
}

async function main() {
  if (!leftDir || !rightDir) {
    console.log('Usage: node compare-tree.js <arborescence1> <arborescence2> [--hash] [--json] [--csv <fichier> | --csv=<fichier>]');
    process.exit(1);
  }

  const leftPath = path.resolve(leftDir);
  const rightPath = path.resolve(rightDir);

  const [leftTree, rightTree] = await Promise.all([collectTree(leftPath), collectTree(rightPath)]);
  const diff = diffTrees(leftTree, rightTree);

  if (options.csvFile) {
    await writeCsv(diff, path.resolve(options.csvFile), leftDir, rightDir);
  } else if (options.json) {
    console.log(JSON.stringify(diff, null, 2));
  } else {
    printDiff(diff);
  }
}

main().catch((error) => {
  console.error('Erreur:', error.message);
  process.exit(1);
});
