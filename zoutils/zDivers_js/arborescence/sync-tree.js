#!/usr/bin/env node
/*
 * ═══════════════════════════════════════════════════════════════════════════
 * SYNC-TREE.JS
 * Génère un script batch pour synchroniser deux arborescences
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * DESCRIPTION:
 *   Compare deux arborescences et génère un fichier .bat (batch Windows) qui
 *   synchronise le dossier destination par rapport au dossier source:
 *   - Crée les répertoires manquants
 *   - Copie les fichiers manquants
 *   - Supprime les répertoires vides devenus inutiles
 * 
 * LANCEMENT:
 *   node sync-tree.js <leftDir> <rightDir> [<script.bat>]
 * 
 * ARGUMENTS:
 *   - leftDir     : Dossier source (référence)
 *   - rightDir    : Dossier destination (à mettre à jour)
 *   - script.bat  : Fichier .bat généré (défaut: sync.bat)
 * 
 * RÉSULTAT:
 *   Génère un script batch (script.bat) contenant:
 *   - mkdir pour créer les répertoires manquants
 *   - copy pour copier les fichiers manquants
 *   - rmdir pour supprimer les répertoires vides
 * 
 * UTILISATION:
 *   1. Générer le script: node sync-tree.js ./source ./dest
 *   2. Vérifier le contenu du fichier sync.bat
 *   3. Exécuter: sync.bat (depuis invite de commande)
 * 
 * EXEMPLES:
 *   node sync-tree.js ./source ./dest
 *   node sync-tree.js C:\\path\\to\\source C:\\path\\to\\dest
 *   node sync-tree.js ./source ./dest update.bat
 * 
 * ═══════════════════════════════════════════════════════════════════════════
 */

const fs = require('fs').promises;
const path = require('path');

const args = process.argv.slice(2);
let [leftDir, rightDir, batFile] = args;

if (!leftDir || !rightDir) {
  console.log('Usage: node sync-tree.js <leftDir> <rightDir> [<script.bat>]');
  process.exit(1);
}

batFile = batFile || 'sync.bat';

// Normaliser les chemins
leftDir = leftDir.split(path.sep).join('/');
rightDir = rightDir.split(path.sep).join('/');

const leftPath = path.resolve(args[0]);
const rightPath = path.resolve(args[1]);

const normalizeRel = (p) => p.split(path.sep).join('/');

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
        tree.set(childRel, {
          type: 'file',
          size: stats.size,
        });
      }
    }
  }

  return tree;
}

function diffTrees(leftTree, rightTree) {
  const result = {
    filesToCopy: [],     // fichiers à copier de left vers right
    dirsToCreate: [],    // répertoires à créer dans right
    filesToDelete: [],   // fichiers à supprimer de right (en trop)
    dirsToDelete: [],    // répertoires à supprimer de right (en trop)
  };

  const allPaths = new Set([...leftTree.keys(), ...rightTree.keys()]);

  for (const relPath of Array.from(allPaths).sort()) {
    const left = leftTree.get(relPath);
    const right = rightTree.get(relPath);

    if (!left && right) {
      // Existe uniquement dans right → marquer pour suppression
      if (right.type === 'directory') {
        result.dirsToDelete.push(relPath);
      } else if (right.type === 'file') {
        result.filesToDelete.push(relPath);
      }
    } else if (left && !right) {
      // Existe uniquement dans left → ajouter à right
      if (left.type === 'directory') {
        result.dirsToCreate.push(relPath);
      } else if (left.type === 'file') {
        result.filesToCopy.push(relPath);
      }
    }
  }

  return result;
}

function escapeBat(str) {
  return str.replace(/"/g, '""').replace(/%/g, '%%');
}

async function generateBat(diff, batPath, leftPath, rightPath) {
  const lines = [
    'REM Fichier de synchronisation genere automatiquement',
    `REM Synchronise ${rightDir} par rapport a ${leftDir}`,
    'REM',
    `REM Source: ${leftDir}`,
    `REM Destination: ${rightDir}`,
    '',
    'setlocal enabledelayedexpansion',
    'set "LEFT=%~dp0' + path.basename(leftPath) + '"',
    'set "RIGHT=%~dp0' + path.basename(rightPath) + '"',
    '',
    'echo ===========================================================================',
    'echo SYNCHRONISATION D\'ARBORESCENCES',
    'echo ===========================================================================',
    'echo.',
    `echo Source:      ${leftDir}`,
    `echo Destination: ${rightDir}`,
    'echo.',
    'echo Resume des modifications:',
    `echo   - Fichiers a copier:    ${diff.filesToCopy.length}`,
    `echo   - Repertoires a creer:  ${diff.dirsToCreate.length}`,
    `echo   - Fichiers a supprimer: ${diff.filesToDelete.length}`,
    `echo   - Repertoires a supprimer: ${diff.dirsToDelete.length}`,
    'echo.',
    'echo ===========================================================================',
    'echo.',
    'set /p confirmation="Etes-vous sur de continuer? (O/N): "',
    'if /i not "%confirmation%"=="O" (',
    '  echo Operation annulee.',
    '  pause',
    '  exit /b 0',
    ')',
    'echo.',
    'echo Synchronisation en cours...',
    'echo.',
    '',
  ];

  // Créer les répertoires manquants
  if (diff.dirsToCreate.length > 0) {
    lines.push('REM Creation des repertoires manquants');
    diff.dirsToCreate.forEach((relPath) => {
      const targetDir = path.join(rightPath, relPath).split('/').join('\\');
      lines.push(`if not exist "${escapeBat(targetDir)}" mkdir "${escapeBat(targetDir)}"`);
    });
    lines.push('');
  }

  // Copier les fichiers manquants
  if (diff.filesToCopy.length > 0) {
    lines.push('REM Copie des fichiers manquants');
    diff.filesToCopy.forEach((relPath) => {
      const sourceFile = path.join(leftPath, relPath).split('/').join('\\');
      const targetFile = path.join(rightPath, relPath).split('/').join('\\');
      lines.push(`copy /Y "${escapeBat(sourceFile)}" "${escapeBat(targetFile)}"`);
    });
    lines.push('');
  }

  // Supprimer les fichiers en trop
  if (diff.filesToDelete.length > 0) {
    lines.push('REM Suppression des fichiers en trop');
    diff.filesToDelete.forEach((relPath) => {
      const targetFile = path.join(rightPath, relPath).split('/').join('\\');
      lines.push(`if exist "${escapeBat(targetFile)}" del /Q "${escapeBat(targetFile)}"`);
    });
    lines.push('');
  }

  // Supprimer les répertoires en trop
  if (diff.dirsToDelete.length > 0) {
    lines.push('REM Suppression des repertoires en trop');
    // Les trier en inverse pour supprimer les sous-dossiers avant les parents
    const sortedDirs = diff.dirsToDelete.sort().reverse();
    sortedDirs.forEach((relPath) => {
      const targetDir = path.join(rightPath, relPath).split('/').join('\\');
      lines.push(`if exist "${escapeBat(targetDir)}" rmdir /s /q "${escapeBat(targetDir)}"`);
    });
    lines.push('');
  }

  lines.push('echo ===========================================================================');
  lines.push('echo Synchronisation terminee!');
  lines.push('echo ===========================================================================');
  lines.push('pause');

  const content = lines.join('\r\n') + '\r\n';
  await fs.writeFile(batPath, content, 'utf8');
  console.log(`Script .bat genere: ${batPath}`);
}

async function main() {
  try {
    console.log(`Lecture de ${leftDir}...`);
    const leftTree = await collectTree(leftPath);
    console.log(`  ${leftTree.size} éléments trouvés`);

    console.log(`Lecture de ${rightDir}...`);
    const rightTree = await collectTree(rightPath);
    console.log(`  ${rightTree.size} éléments trouvés`);

    const diff = diffTrees(leftTree, rightTree);

    console.log('\nRésumé des modifications:');
    console.log(`  - Fichiers à copier: ${diff.filesToCopy.length}`);
    console.log(`  - Répertoires à créer: ${diff.dirsToCreate.length}`);
    console.log(`  - Fichiers à supprimer: ${diff.filesToDelete.length}`);
    console.log(`  - Répertoires à supprimer: ${diff.dirsToDelete.length}`);

    if (diff.filesToCopy.length === 0 && diff.dirsToCreate.length === 0 && diff.filesToDelete.length === 0 && diff.dirsToDelete.length === 0) {
      console.log('\nLes deux arborescences sont déjà synchronisées!');
      return;
    }

    await generateBat(diff, batFile, leftPath, rightPath);
    console.log(`\nPour appliquer les changements, exécutez: ${batFile}`);
  } catch (error) {
    console.error('Erreur:', error.message);
    process.exit(1);
  }
}

main();
