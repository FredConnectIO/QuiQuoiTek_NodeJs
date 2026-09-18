/* eslint-disable no-console */
const fs = require("node:fs/promises");
const path = require("node:path");
const sharp = require("sharp");

function parseArgs(argv) {
  const options = {
    src: "C:\\a",
    out: null,
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
  console.log("Convertit les fichiers WEBP en PNG.");
  console.log("");
  console.log("Usage:");
  console.log("  node zoutils/webpToPng.js [--src <dir>] [--out <dir>] [--overwrite]");
  console.log("");
  console.log("Defaults:");
  console.log("  --src C:\\a");
  console.log("  --out <src>\\png");
}

async function main() {
  const options = parseArgs(process.argv.slice(2));

  if (options.help) {
    showHelp();
    return;
  }

  const srcDir = path.resolve(options.src);
  const outDir = options.out ? path.resolve(options.out) : path.join(srcDir, "png");

  const srcStat = await fs.stat(srcDir).catch(() => null);
  if (!srcStat || !srcStat.isDirectory()) {
    throw new Error(`Dossier source introuvable: ${srcDir}`);
  }

  await fs.mkdir(outDir, { recursive: true });

  const allFiles = await walkFiles(srcDir);
  const inputWebp = allFiles.filter(
    (filePath) => path.extname(filePath).toLowerCase() === ".webp"
  );

  let converted = 0;
  let skipped = 0;
  let failed = 0;

  for (const inputPath of inputWebp) {
    const relativePath = path.relative(srcDir, inputPath);

    // Avoid processing generated output if output folder is under source folder.
    if (relativePath.startsWith("png\\")) {
      skipped += 1;
      continue;
    }

    const pngRelative = relativePath.replace(/\.webp$/i, ".png");
    const outputPath = path.join(outDir, pngRelative);
    await fs.mkdir(path.dirname(outputPath), { recursive: true });

    if (!options.overwrite && (await fileExists(outputPath))) {
      skipped += 1;
      continue;
    }

    try {
      await sharp(inputPath).png().toFile(outputPath);
      converted += 1;
    } catch (error) {
      failed += 1;
      console.error(`Echec: ${inputPath}`);
      console.error(`  ${error.message}`);
    }
  }

  console.log(`Source: ${srcDir}`);
  console.log(`Sortie: ${outDir}`);
  console.log(`Convertis: ${converted}`);
  console.log(`Ignores: ${skipped}`);
  console.log(`Erreurs: ${failed}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
