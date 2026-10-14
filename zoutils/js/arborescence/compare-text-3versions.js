#!/usr/bin/env node
const fs = require('fs').promises;
const path = require('path');

const args = process.argv.slice(2);
const [fileA, fileB, fileC, outputFile] = args;

function normalizeText(text) {
  return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

function escapeCsv(value) {
  const text = String(value == null ? '' : value).replace(/"/g, '""');
  return `"${text}"`;
}

function compareVersions(textA, textB, textC) {
  const linesA = normalizeText(textA).split('\n').filter((line) => line.length > 0);
  const linesB = normalizeText(textB).split('\n').filter((line) => line.length > 0);
  const linesC = normalizeText(textC).split('\n').filter((line) => line.length > 0);

  const rows = [];
  let indexA = 0;
  let indexB = 0;
  let indexC = 0;
  let rowNumber = 1;

  // Balayage parallèle des trois fichiers
  while (indexA < linesA.length || indexB < linesB.length || indexC < linesC.length) {
    const valueA = linesA[indexA];
    const valueB = linesB[indexB];
    const valueC = linesC[indexC];

    // Déterminer les valeurs minimales
    const aLower = valueA ? valueA.toLowerCase() : null;
    const bLower = valueB ? valueB.toLowerCase() : null;
    const cLower = valueC ? valueC.toLowerCase() : null;

    // Trouver le minimum
    let min = null;
    if (aLower !== null && (min === null || aLower < min)) min = aLower;
    if (bLower !== null && (min === null || bLower < min)) min = bLower;
    if (cLower !== null && (min === null || cLower < min)) min = cLower;

    // Écrire les colonnes qui ont le minimum et avancer les pointeurs
    const rowValues = ['', '', ''];
    
    if (aLower === min) {
      rowValues[0] = valueA;
      indexA += 1;
    }
    if (bLower === min) {
      rowValues[1] = valueB;
      indexB += 1;
    }
    if (cLower === min) {
      rowValues[2] = valueC;
      indexC += 1;
    }

    rows.push([rowNumber, ...rowValues.map(escapeCsv)].join(','));
    rowNumber += 1;
  }

  return ['numero_ligne,colonne1,colonne2,colonne3', ...rows].join('\n');
}

async function main() {
  if (!fileA || !fileB || !fileC || !outputFile) {
    console.log('Usage: node compare-text-versions.js <fichier1.txt> <fichier2.txt> <fichier3.txt> <sortie.csv>');
    process.exit(1);
  }

  const [textA, textB, textC] = await Promise.all([
    fs.readFile(fileA, 'utf8'),
    fs.readFile(fileB, 'utf8'),
    fs.readFile(fileC, 'utf8'),
  ]);

  const report = compareVersions(textA, textB, textC);
  await fs.writeFile(outputFile, `${report}\n`, 'utf8');

  console.log(`Rapport écrit dans ${outputFile}`);
}

main().catch((error) => {
  console.error('Erreur:', error.message);
  process.exit(1);
});
