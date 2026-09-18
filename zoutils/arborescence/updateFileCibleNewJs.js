/* exemple: 
node updateFileCibleNewJs ^
  "C:\PARTAGE\GitHub\bibliothequeDemo\zoutils\arborescence\updateFileCibleNew.txt" ^
  "C:\PARTAGE\GitHub\bibliothequeDemo\zoutils\arborescence\updateFileCibleNewLog.txt" 

*/

const fs = require('fs').promises;
const path = require('path');

const args = process.argv.slice(2);
const [fileA, outputFile] = args;

function normalizeText(text) {
  return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/\//g, "\\"); //g signifie "global" (toutes les occurrences).
}

async function deleteFile(fileToDelete) {

  try {
    await fs.unlink(fileToDelete);
    console.log(`Fichier supprimé : ${fileToDelete}`);
  } catch (err) {
    console.error('Erreur lors de la suppression :', err.message);
  }
}

async function copyFile(sourceFile, destFile) {
  // Créer le répertoire de destination si nécessaire
  const destDir = path.dirname(destFile);

  try {
    await fs.copyFile(sourceFile, destFile);
    console.log(`Fichier copié : ${sourceFile} -> ${destFile}`);
  } catch (err) {
    console.error('Erreur lors de la copie :', err.message);
  }
}


function manip(textA) {
  const linesA = normalizeText(textA).split('\n').filter((line) => line.length > 0);

  const rows = [];

  // Ajouter les lignes à copier (présentes dans A mais pas dans B)
  for (const line of linesA) {

    // Séparer la chaîne en utilisant les guillemets doubles comme délimiteur
	  const parts = line.split(/"/).filter(part => part.trim() !== '');

    if (parts[0].trim()=='copy') {
      copyFile(parts[1],parts[2]);
      rows.push(`ccc "${line}"`);
    }
    if (parts[0].trim()=='del') {
      deleteFile(parts[1]);
      rows.push(`ddd "${line}"`);
    }
  }
  return [...rows].join('\n');
}

async function main() {
  if (!fileA  || !outputFile) {
    console.log('Usage: node compare-text-versions.js <fichier1.txt> <sortie.csv>');
    process.exit(1);
  }

  const [textA] = await Promise.all([
    fs.readFile(fileA, 'utf8'),
  ]);

  const report = manip(textA);
  await fs.writeFile(outputFile, `${report}\n`, 'utf8');

  console.log(`Rapport écrit dans ${outputFile}`);
}

main().catch((error) => {
  console.error('Erreur:', error.message);
  process.exit(1);
});
