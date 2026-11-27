/* eslint-disable no-console */
/**
 * Redimensionne en lot les images d'un dossier.
 * Après correction de l'orientation EXIF, chaque image tient dans les
 * dimensions maximales demandées. Les proportions sont conservées et
 * les petites images gardent leur taille.
 *
 * Depuis la racine du projet, avec Node.js et la dépendance sharp installés
 *   node zoutils/js/resizeImages.js [--src <dossier>] [--out <dossier>] [--width <px>] [--height <px>] [--overwrite] [--ssrep]
 *
 * Valeurs par défaut
 *   --src        C:\a
 *   --out        C:\a\resized (sous-dossier resized de la source choisie)
 *   --width      1200 px de largeur maximale
 *   --height     800 px de hauteur maximale
 *   --overwrite  Désactivé. Les fichiers de sortie existants sont ignorés.
 *   --ssrep      Désactivé. Seules les images à la racine de la source sont traitées.
 *
 * Avec --ssrep, le script parcourt aussi les sous-dossiers,
 * en excluant le dossier de sortie. Les noms et l'arborescence sont conservés.
 * Utiliser --help ou -h pour afficher l'aide.
 *
 * Exemple pour limiter les images de C:\a à 200 × 120 px
 *   node zoutils/js/resizeImages.js --width 200 --height 120
 * Ajouter --ssrep pour appliquer ces dimensions aux sous-dossiers.
 *
 * Le script sélectionne les extensions .jpg, .jpeg, .png, .gif, .bmp,
 * .tif, .tiff et .webp. Il affiche le nombre d'images traitées, ignorées
 * ou en erreur.
 */
const fs = require("node:fs/promises");
const path = require("node:path");
const sharp = require("sharp");

const DEFAULT_OPTIONS = {
  src: "C:\\a",
  out: null,
  height: 800,
  width: 1200,
  overwrite: false,
  recursive: false,
};

const IMAGE_EXTENSIONS = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".gif",
  ".bmp",
  ".tif",
  ".tiff",
  ".webp",
]);

function parseArgs(argv) {
  const options = { ...DEFAULT_OPTIONS };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--src" && i + 1 < argv.length) {
      options.src = argv[i + 1];
      i += 1;
    } else if (arg === "--out" && i + 1 < argv.length) {
      options.out = argv[i + 1];
      i += 1;
    } else if (arg === "--height" && i + 1 < argv.length) {
      options.height = Number(argv[i + 1]);
      i += 1;
    } else if (arg === "--width" && i + 1 < argv.length) {
      options.width = Number(argv[i + 1]);
      i += 1;
    } else if (arg === "--overwrite") {
      options.overwrite = true;
    } else if (arg === "--ssrep") {
      options.recursive = true;
    } else if (arg === "--help" || arg === "-h") {
      options.help = true;
    }
  }

  return options;
}

async function walkFiles(dir, recursive, outDir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isFile()) {
      files.push(fullPath);
    } else if (recursive && entry.isDirectory() && path.relative(outDir, fullPath) !== "") {
      files.push(...(await walkFiles(fullPath, recursive, outDir)));
    }
  }

  return files;
}

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function showHelp() {
  console.log("Redimensionne les images en conservant leurs proportions.");
  console.log("");
  console.log("Utilisation");
  console.log("  node zoutils/js/resizeImages.js [--src <dossier>] [--out <dossier>] [--width <px>] [--height <px>] [--overwrite] [--ssrep]");
  console.log("");
  console.log("Valeurs par défaut");
  console.log(`  --src ${DEFAULT_OPTIONS.src}`);
  console.log(`  --out ${path.join(DEFAULT_OPTIONS.src, "resized")} (sous-dossier resized de la source choisie)`);
  console.log(`  --width ${DEFAULT_OPTIONS.width} px de largeur maximale`);
  console.log(`  --height ${DEFAULT_OPTIONS.height} px de hauteur maximale`);
  console.log("  --overwrite Désactivé. Les fichiers de sortie existants sont ignorés.");
  console.log("  --ssrep Désactivé. Active le parcours des sous-dossiers, sauf celui de sortie.");
}

async function main() {
  const options = parseArgs(process.argv.slice(2));

  if (options.help) {
    showHelp();
    return;
  }

  if (!Number.isFinite(options.height) || options.height <= 0) {
    throw new Error("--height doit etre un entier positif.");
  }
  if (!Number.isFinite(options.width) || options.width <= 0) {
    throw new Error("--width doit etre un entier positif.");
  }

  const srcDir = path.resolve(options.src);
  const outDir = options.out
    ? path.resolve(options.out)
    : path.join(srcDir, "resized");

  const srcStat = await fs.stat(srcDir).catch(() => null);
  if (!srcStat || !srcStat.isDirectory()) {
    throw new Error(`Dossier source introuvable: ${srcDir}`);
  }

  await fs.mkdir(outDir, { recursive: true });

  const allFiles = await walkFiles(srcDir, options.recursive, outDir);
  const inputImages = allFiles.filter((filePath) =>
    IMAGE_EXTENSIONS.has(path.extname(filePath).toLowerCase())
  );

  let resized = 0;
  let skipped = 0;
  let failed = 0;

  for (const inputPath of inputImages) {
    const relativePath = path.relative(srcDir, inputPath);

    const outputPath = path.join(outDir, relativePath);
    await fs.mkdir(path.dirname(outputPath), { recursive: true });

    if (!options.overwrite && (await fileExists(outputPath))) {
      skipped += 1;
      continue;
    }

    try {
      await sharp(inputPath)
        .rotate()
        .resize({
          width: options.width,
          height: options.height,
          fit: "inside",
          withoutEnlargement: true,
        })
        .toFile(outputPath);
      resized += 1;
    } catch (error) {
      failed += 1;
      console.error(`Echec: ${inputPath}`);
      console.error(`  ${error.message}`);
    }
  }

  console.log(`Source: ${srcDir}`);
  console.log(`Sortie: ${outDir}`);
  console.log(`Boite max: ${options.width}x${options.height}px`);
  console.log(`Traitees: ${resized}`);
  console.log(`Ignorees: ${skipped}`);
  console.log(`Erreurs: ${failed}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
