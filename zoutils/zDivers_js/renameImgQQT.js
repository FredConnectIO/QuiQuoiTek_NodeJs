const fs = require('fs');
const path = require('path');

const targetDir = 'C:\\PARTAGE\\QQT_Data\\Photos';

async function renameFiles() {
  let entries;
  try {
    entries = await fs.promises.readdir(targetDir);
  } catch (err) {
    console.error(`Impossible de lire le repertoire ${targetDir}:`, err.message);
    process.exitCode = 1;
    return;
  }

  const pngFiles = entries.filter(
    (file) => path.extname(file).toLowerCase() === '.png'
  );

  if (pngFiles.length === 0) {
    console.log('Aucun fichier .png trouve.');
    return;
  }

  for (const file of pngFiles) {
    const basename = path.basename(file, path.extname(file));
    const newName = `${basename}-001.png`;
    const oldPath = path.join(targetDir, file);
    const newPath = path.join(targetDir, newName);

    try {
      await fs.promises.rename(oldPath, newPath);
      console.log(`Renomme: ${file} -> ${newName}`);
    } catch (err) {
      console.error(`Erreur lors du renommage de ${file}:`, err.message);
      process.exitCode = 1;
    }
  }
}

renameFiles();
