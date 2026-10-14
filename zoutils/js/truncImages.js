/* eslint-disable no-console */
const fs = require('node:fs/promises');
const path = require('node:path');
const sharp = require('sharp');

const SOURCE_DIR = 'C:\\a';
const IMAGE_EXTENSIONS = new Set([
  '.jpg', '.jpeg', '.png', '.webp', '.gif', '.tif', '.tiff', '.avif',
]);

function showHelp() {
  console.log('Usage: node zoutils/js/truncImages.js <gauche> <droite> <haut> <bas>');
  console.log('Les quatre valeurs sont des nombres entiers de pixels, positifs ou nuls.');
  console.log('Exemple: node zoutils/js/truncImages.js 10 20 30 40');
  console.log('Source: C:\\a | Resultat: C:\\a\\trunc (memes noms de fichiers).');
  console.log('Les fichiers de sortie existants sont remplaces.');
}

async function main(argv = process.argv.slice(2), sourceDir = SOURCE_DIR) {
  if (argv.length === 1 && ['--help', '-h'].includes(argv[0])) {
    showHelp();
    return;
  }

  if (argv.length !== 4 || argv.some((arg) => !/^\d+$/.test(arg) || !Number.isSafeInteger(Number(arg)))) {
    showHelp();
    throw new Error('Indiquez exactement quatre entiers positifs ou nuls: gauche droite haut bas.');
  }

  const [left, right, top, bottom] = argv.map(Number);
  const entries = await fs.readdir(sourceDir, { withFileTypes: true });
  const images = entries.filter((entry) =>
    entry.isFile() && IMAGE_EXTENSIONS.has(path.extname(entry.name).toLowerCase())
  );
  const outputDir = path.join(sourceDir, 'trunc');
  await fs.mkdir(outputDir, { recursive: true });

  let processed = 0;
  let failed = 0;
  for (const entry of images) {
    try {
      const inputPath = path.join(sourceDir, entry.name);
      const metadata = await sharp(inputPath).metadata();
      // Les marges correspondent a l'image affichee, apres orientation EXIF.
      const swapDimensions = metadata.orientation >= 5 && metadata.orientation <= 8;
      const imageWidth = swapDimensions ? metadata.height : metadata.width;
      const imageHeight = swapDimensions ? metadata.width : metadata.height;
      const width = imageWidth - left - right;
      const height = imageHeight - top - bottom;

      if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) {
        throw new Error(`Marges trop grandes pour cette image (${imageWidth}x${imageHeight}px).`);
      }
      await sharp(inputPath)
        .rotate()
        .extract({ left, top, width, height })
        .toFile(path.join(outputDir, entry.name));
      processed += 1;
      console.log(`Tronquee: ${entry.name} -> ${width}x${height}px`);
    } catch (error) {
      failed += 1;
      console.error(`Erreur: ${entry.name}: ${error.message}`);
    }
  }

  console.log(`Sortie: ${outputDir}`);
  console.log(`Traitees: ${processed} | Erreurs: ${failed}`);
  if (failed > 0) process.exitCode = 1;
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}

module.exports = { main };
