//remplacé par deplaceFilms_cmd.bat

// Déplace chaque fichier d'un dossier root dans un sous-répertoire du même nom.
// Usage : node deplaceFilms.js <root>
// Exemple : node deplaceFilms.js "D:\Videos\Comédies-Drames"
const fs = require('fs').promises; // API promesse du système de fichiers
const path = require('path'); // Outils pour manipuler les chemins

const ROOT = process.argv[2];

if (!ROOT) {
  console.error('Usage: node deplaceFilms.js <root>');
  process.exit(1);
}

const resolvedRoot = path.resolve(ROOT);

// Crée le dossier cible si nécessaire (récursif pour éviter les erreurs si parent absent)
async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
}

// Déplace un fichier dans son propre sous-dossier
async function moveFileIntoOwnFolder(entry) {
  const sourcePath = path.join(resolvedRoot, entry); // Chemin complet du fichier source
  const baseName = path.parse(entry).name; // Nom sans extension (pour nom du dossier)
  const targetDir = path.join(resolvedRoot, baseName); // Dossier cible à créer
  const targetPath = path.join(targetDir, path.basename(entry)); // Chemin complet de destination

  await ensureDir(targetDir); // Garantit que le dossier existe
  await fs.rename(sourcePath, targetPath); // Déplace le fichier
}

// Parcourt les entrées du répertoire, ne traite que les fichiers
async function main() {
  const entries = await fs.readdir(resolvedRoot, { withFileTypes: true }); // Liste avec type (fichier/dossier)
  for (const dirent of entries) {
    if (!dirent.isFile()) { // Ignore les dossiers existants
      continue;
    }

    const ext = path.extname(dirent.name).toLowerCase();
    if (ext !== '.avi' && ext !== '.mp4' && ext !== '.mkv' && ext !== '.mpg') {
      // skip non-video files
      continue;
    }

    try {
      await moveFileIntoOwnFolder(dirent.name); // Traite le fichier courant
    } catch (error) {
      console.error(`Échec déplacement de ${dirent.name}:`, error.message); // Log en cas d'erreur
    }
  }
}

// Point d'entrée : exécute main et gère les erreurs non interceptées
main().catch((error) => {
  console.error('Erreur globale:', error);
  process.exit(1);
});
