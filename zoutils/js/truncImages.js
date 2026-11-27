/* eslint-disable no-console */
/**
 * Recadre en lot les images placées directement dans C:\a.
 *
 * Depuis la racine du projet, avec Node.js et la dépendance sharp installés
 *   node zoutils/js/truncImages.js <gauche> <droite> <haut> <bas>
 *
 * Chaque valeur indique le nombre entier de pixels à retirer du bord
 * correspondant, après application de l'orientation EXIF. Utiliser 0
 * pour conserver un bord. Le recadrage doit laisser au moins un pixel
 * en largeur et en hauteur.
 *
 * Exemple
 *   node zoutils/js/truncImages.js 10 20 30 40
 * Retire 10 pixels à gauche, 20 à droite, 30 en haut et 40 en bas.
 * Utiliser --help ou -h pour afficher l'aide.
 *
 * Extensions reconnues .jpg, .jpeg, .png, .webp, .gif, .tif, .tiff et .avif.
 * Les résultats sont enregistrés dans C:\a\trunc sous les noms d'origine.
 * Les originaux sont conservés et les fichiers de sortie existants sont
 * remplacés. Si une image échoue, le script poursuit avec les suivantes
 * et renvoie un code de sortie 1 à la fin du traitement.
 */
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
