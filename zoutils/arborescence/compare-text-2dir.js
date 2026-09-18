#!/usr/bin/env node
/*
- prérequis:
  node list-tree-dirAbs ^
   "C:\PARTAGE\Music" ^
   "C:\PARTAGE\Music\sourceDir.txt"
  
   node list-tree-dirAbs ^
  "E:\Music" ^
  "C:\PARTAGE\Music\cibleOldDir.txt"

- exec:
 node compare-text-2dirs ^
  "C:\PARTAGE\Music\sourceDir.txt" ^
  "C:\PARTAGE\Music\cibleOldDir.txt" ^
  "C:\PARTAGE\Music\cibleNewDir.txt" ^
  "C:\PARTAGE\Music" ^
  "E:\Music"
*/
//
const fs = require('fs').promises;
const path = require('path');

const args = process.argv.slice(2);
const [fileA, fileB, outputFile, prefixA, prefixB] = args;

function normalizeText(text) {
  return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/\//g, "\\"); //g signifie "global" (toutes les occurrences).
}

function compareVersions(textA, textB) {
  const linesA = normalizeText(textA).split('\n').filter((line) => line.length > 0);
  const linesB = normalizeText(textB).split('\n').filter((line) => line.length > 0);

  const rows = [];

  const setB = new Set(linesB); // Pour une recherche rapide

  // Ajouter les lignes à copier (présentes dans A mais pas dans B)
  for (const line of linesA) {
    //console.log(" line=", line)

    if (!setB.has(line.replace(prefixA,  prefixB))) {
      //console.log(`mkdir "${line.replace(prefixA,  prefixB)}"`);
      rows.push(`mkdir "${line.replace(prefixA,  prefixB)}"`);
    }
  }

  const setA = new Set(linesA); // Pour une recherche rapide

  // Ajouter les lignes à supprimer (présentes dans B mais pas dans A)
  for (const line of linesB) {
    if (!setA.has(line.replace(prefixB,  prefixA))) {
      //console.log(`rmdir "${line}"`);
      rows.push(`rmdir "${line}"`);
    }
  }

  return [...rows].join('\n');
}


async function main() {
  if (!fileA || !fileB || !outputFile) {
    console.log('Usage: node compare-text-versions.js <fichier1.txt> <fichier2.txt> <sortie.csv>');
    process.exit(1);
  }
  console.log(`+fileA: ${fileA}`);
  console.log(`+fileB: ${fileB}`);
  console.log(`+outputFile: ${outputFile}`);
  console.log(`+prefixA: ${prefixA}`);
  console.log(`+prefixB: ${prefixB}`);

  const [textA, textB] = await Promise.all([
    fs.readFile(fileA, 'utf8'),
    fs.readFile(fileB, 'utf8'),
  ]);

  const report = compareVersions(textA, textB);
  await fs.writeFile(outputFile, `pause\n`+`${report}\n`+`pause\n`, 'utf8');

  console.log(`Rapport écrit dans ${outputFile}`);
}

main().catch((error) => {
  console.error('Erreur:', error.message);
  process.exit(1);
});
