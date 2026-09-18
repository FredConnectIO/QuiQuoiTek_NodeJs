/* eslint-disable no-console */
const fs = require("node:fs/promises");
const path = require("node:path");
const sharp = require("sharp");

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
  const options = {
    src: "C:\\a",
    out: null,
    height: 800,
    width: 1200,
    overwrite: false,
  };

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
    } else if (arg === "--help" || arg === "-h") {
      options.help = true;
    }
  }

  return options;
}

async function walkFiles(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walkFiles(fullPath)));
    } else if (entry.isFile()) {
      files.push(fullPath);
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
  console.log("Resize images to max box (default: 200x120) with preserved ratio.");
  console.log("");
  console.log("Usage:");
  console.log("  node zoutils/resizeImages120.js [--src <dir>] [--out <dir>] [--height <px>] [--width <px>] [--overwrite]");
  console.log("");
  console.log("Defaults:");
  console.log("  --src C:\\a");
  console.log("  --out <src>\\resized");
  console.log("  --width 200");
  console.log("  --height 120");
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

  const allFiles = await walkFiles(srcDir);
  const inputImages = allFiles.filter((filePath) =>
    IMAGE_EXTENSIONS.has(path.extname(filePath).toLowerCase())
  );

  let resized = 0;
  let skipped = 0;
  let failed = 0;

  for (const inputPath of inputImages) {
    const relativePath = path.relative(srcDir, inputPath);

    // Avoid processing already generated outputs if out dir is inside src dir.
    if (!options.overwrite && relativePath.startsWith("resized\\")) {
      skipped += 1;
      continue;
    }

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
