/* exemple: "updateDirCibleNew.txt"

node updateDirCibleNewJs ^
  "C:\PARTAGE\GitHub\bibliothequeDemo\zoutils\arborescence\updateDirCibleNew.txt" ^
  "C:\PARTAGE\GitHub\bibliothequeDemo\zoutils\arborescence\updateDirCibleNewLog.txt" 
  
*/

const fs = require('fs').promises;
const path = require('path');

const args = process.argv.slice(2);
const [fileA, outputFile] = args;

function normalizeText(text) {
  return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/\//g, "\\"); //g signifie "global" (toutes les occurrences).
}

async function createDirectory(arg1) {

  try {
    await fs.mkdir(arg1, { recursive: true });
    console.log(`Répertoire créé : ${arg1}`);
  } catch (err) {
    console.error(`Erreur création répertoire : ${err.message}`);
  }
}

async function deleteNonEmptyDir(arg1) {
  try {
    await fs.rm(arg1, { recursive: true, force: true });
    console.log('Répertoire et son contenu supprimés avec succès.');
  } catch (err) {
    console.error('Erreur lors de la suppression :', err.message);
  }
}

function manip(textA) {
  const linesA = normalizeText(textA).split('\n').filter((line) => line.length > 0);

  const rows = [];

  // Ajouter les lignes à copier (présentes dans A mais pas dans B)
  for (const line of linesA) {

    const cmd=line.substring(0, 5);
    const arg1=line.substring(6).replace(/"/g, '');

    if (cmd=='mkdir') {
      rows.push(`mmm "${line}"`);
      createDirectory(arg1)
    }
    if (cmd=='rmdir') {
      rows.push(`rrr "${line}"`);
      deleteNonEmptyDir(arg1);
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
