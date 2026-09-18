const fs = require('fs').promises;
const path = require('path');

const mode = process.argv[2];
const sourceArg = process.argv[3];
const targetArg = process.argv[4];
const reportArg = process.argv[5];

function printUsage() {
  console.log('Usage: node sauvegardeIterative.js <simu|MAJ> <source> <cible> [rapport.txt]');
  console.log('Exemple simu: node sauvegardeIterative.js simu D:\\Source E:\\Backup');
  console.log('Exemple MAJ : node sauvegardeIterative.js MAJ D:\\Source E:\\Backup');
}

function timestamp() {
  const now = new Date();
  const parts = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
    '_',
    String(now.getHours()).padStart(2, '0'),
    String(now.getMinutes()).padStart(2, '0'),
    String(now.getSeconds()).padStart(2, '0'),
  ];
  return parts.join('');
}

async function pathExists(inputPath) {
  try {
    await fs.access(inputPath);
    return true;
  } catch {
    return false;
  }
}

async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
}

async function collectFiles(rootDir, currentDir = rootDir) {
  const entries = await fs.readdir(currentDir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const absolutePath = path.join(currentDir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await collectFiles(rootDir, absolutePath));
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    const relativePath = path.relative(rootDir, absolutePath);
    files.push(relativePath);
  }

  return files;
}

async function analyzeCopy(sourcePath, targetPath) {
  const sourceStat = await fs.stat(sourcePath);

  try {
    const targetStat = await fs.stat(targetPath);
    const reasons = [];

    if (sourceStat.size !== targetStat.size) {
      reasons.push('taille');
    }

    if (sourceStat.mtimeMs > targetStat.mtimeMs) {
      reasons.push('date');
    }

    if (reasons.length === 0) {
      return null;
    }

    return {
      action: 'remplacer',
      reasons,
    };
  } catch (error) {
    if (error.code === 'ENOENT') {
      return {
        action: 'creer',
        reasons: ['absence'],
      };
    }
    throw error;
  }
}

async function buildActions(sourceDir, targetDir) {
  const relativeFiles = await collectFiles(sourceDir);
  const actions = [];

  for (const relativePath of relativeFiles) {
    const sourcePath = path.join(sourceDir, relativePath);
    const targetPath = path.join(targetDir, relativePath);

    const decision = await analyzeCopy(sourcePath, targetPath);
    if (decision) {
      actions.push({
        relativePath,
        sourcePath,
        targetPath,
        action: decision.action,
        reasons: decision.reasons,
      });
    }
  }

  return actions;
}

async function writeSimulationReport(actions, sourceDir, targetDir) {
  const reportPath = reportArg
    ? path.resolve(reportArg)
    : path.join(__dirname, `sauvegarde_iterative_${timestamp()}.txt`);

  const lines = [
    `Mode: simulation`,
    `Source: ${sourceDir}`,
    `Cible: ${targetDir}`,
    `Fichiers a sauvegarder: ${actions.length}`,
    '',
  ];

  for (const action of actions) {
    lines.push(`${action.relativePath} | action=${action.action} | motif=${action.reasons.join('+')}`);
  }

  await fs.writeFile(reportPath, lines.join('\n'), 'utf8');
  return reportPath;
}

async function executeBackup(actions) {
  for (const action of actions) {
    await ensureDir(path.dirname(action.targetPath));
    await fs.copyFile(action.sourcePath, action.targetPath);
    console.log(`Copie: ${action.relativePath}`);
  }
}

async function main() {
  if (!mode || !sourceArg || !targetArg) {
    printUsage();
    process.exit(1);
  }

  if (mode !== 'simu' && mode !== 'MAJ') {
    console.error('Le premier argument doit etre "simu" ou "MAJ".');
    printUsage();
    process.exit(1);
  }

  const sourceDir = path.resolve(sourceArg);
  const targetDir = path.resolve(targetArg);

  if (!await pathExists(sourceDir)) {
    console.error(`Repertoire source introuvable: ${sourceDir}`);
    process.exit(1);
  }

  const sourceStat = await fs.stat(sourceDir);
  if (!sourceStat.isDirectory()) {
    console.error(`La source n'est pas un repertoire: ${sourceDir}`);
    process.exit(1);
  }

  await ensureDir(targetDir);
  const actions = await buildActions(sourceDir, targetDir);

  if (mode === 'simu') {
    const reportPath = await writeSimulationReport(actions, sourceDir, targetDir);
    console.log(`Simulation terminee. Rapport: ${reportPath}`);
    console.log(`Fichiers a sauvegarder: ${actions.length}`);
    return;
  }

  await executeBackup(actions);
  console.log(`Sauvegarde terminee. Fichiers copies: ${actions.length}`);
}

main().catch((error) => {
  console.error('Erreur globale:', error.message);
  process.exit(1);
});
