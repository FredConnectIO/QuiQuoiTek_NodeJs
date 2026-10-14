#!/usr/bin/env node
//exemple: node compare-text-2versions C:\PARTAGE\Music\source.txt C:\PARTAGE\Music\cibleOld.txt C:\PARTAGE\Music\cibleNew.txt
//
const fs = require('fs').promises;
const path = require('path');

const args = process.argv.slice(2);
const [fileA, fileB, outputFile, prefixA, prefixB] = args;

function normalizeText(text) {
  return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

function escapeCsv(value) {
  const text = String(value == null ? '' : value).replace(/"/g, '""');
  return `"${text}"`;
}

function compareVersions(textA, textB) {
  const linesA = normalizeText(textA).split('\n').filter((line) => line.length > 0);
  const linesB = normalizeText(textB).split('\n').filter((line) => line.length > 0);

  const rows = [];
  const setB = new Set(linesB); // Pour une recherche rapide

  // Ajouter les lignes à copier (présentes dans A mais pas dans B)
  for (const line of linesA) {
    if (!setB.has(line.replace(prefixA,  prefixB))) {
      rows.push(`copy  ${escapeCsv(line)} ${escapeCsv(line.replace(prefixA,  prefixB))}`);
    }
  }

  const setA = new Set(linesA); // Pour une recherche rapide

  // Ajouter les lignes à supprimer (présentes dans B mais pas dans A)
  for (const line of linesB) {
    if (!setA.has(line.replace(prefixB,  prefixA))) {
      rows.push(`del ${escapeCsv(line)}`);
    }
  }

  rows.push(`pause`);
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
  await fs.writeFile(outputFile, `${report}\n`, 'utf8');

  console.log(`Rapport écrit dans ${outputFile}`);
}

main().catch((error) => {
  console.error('Erreur:', error.message);
  process.exit(1);
});
