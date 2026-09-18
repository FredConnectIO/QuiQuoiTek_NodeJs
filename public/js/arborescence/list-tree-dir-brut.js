#!/usr/bin/env node
//
//exemple:  node list-tree-dir-brut "e:\" "e:\f.txt"
//
const fs = require('fs').promises;
const path = require('path');

const args = process.argv.slice(2);
const [inputDir, outputFile] = args;

function normalizeRel(p) {
  return p.split(path.sep).join('/');
}

async function collectTree(rootDir, baseDir = '', level = 1) {
  if (level > 3) {
    return [];
  }

  const dirPath = path.join(rootDir, baseDir);
  let entries;

  try {
    entries = await fs.readdir(dirPath, { withFileTypes: true });
  } catch (error) {
    if (error.code === 'EPERM' || error.code === 'EACCES') {
      console.error(`Ignoré : accès refusé à ${dirPath}`);
      return [];
    }
    throw error;
  }

  const results = [];

  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    if (entry.isDirectory() && entry.name.toUpperCase() === '$RECYCLE.BIN') {
      console.error(`Ignoré : dossier système ${entry.name}`);
      continue;
    }

    if (!entry.isDirectory()) {
      continue;
    }

    const relPath = normalizeRel(path.posix.join(baseDir, entry.name));
    const children = await collectTree(rootDir, relPath, level + 1);
    results.push({ name: entry.name, path: relPath, children });
  }

  return results;
}

function flattenTree(nodes, lines = []) {
  for (const node of nodes) {
    lines.push(node.path);
    flattenTree(node.children, lines);
  }
  return lines;
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildTable(values) {
  let html = '<table>\n<tbody>\n';
  for (let i = 0; i < values.length; i += 3) {
    html += '  <tr>';
    for (let j = 0; j < 3; j += 1) {
      const value = values[i + j] || '';
      html += `<td>${escapeHtml(value)}</td>`;
    }
    html += '</tr>\n';
  }
  html += '</tbody>\n</table>\n';
  return html;
}

function buildHtml(tree, title) {
  let html = '<!DOCTYPE html>\n<html lang="fr">\n<head>\n';
  html += '  <meta charset="UTF-8">\n';
  html += `  <title>${escapeHtml(title)}</title>\n`;
  html += '  <style>\n';
  html += '    body { font-family: Arial, sans-serif; line-height: 1.4; margin: 1rem; }\n';
  html += '    h1 { margin-top: 1.5rem; }\n';
  html += '    h2 { margin-top: 1rem; }\n';
  html += '    table { border-collapse: collapse; width: 100%; margin-top: 0.5rem; }\n';
  html += '    td { border: 1px solid #999; padding: 0.4rem; vertical-align: top; }\n';
  html += '  </style>\n';
  html += '</head>\n<body>\n';

  if (tree.length === 0) {
    html += '  <p>Aucun dossier trouvé.</p>\n';
  }

  for (const level1 of tree) {
    html += `  <h1>${escapeHtml(level1.name)}</h1>\n`;

    for (const level2 of level1.children) {
      html += `  <h2>${escapeHtml(level2.name)}</h2>\n`;
      if (level2.children.length > 0) {
        const rowValues = level2.children.map((child) => child.name);
        html += buildTable(rowValues);
      }
    }
  }

  html += '</body>\n</html>\n';
  return html;
}

async function main() {
  if (!inputDir || !outputFile) {
    console.log('Usage: node list-tree.js <repertoire> <fichier-sortie.(txt|html)>' );
    process.exit(1);
  }

  const normalizedInputDir = inputDir.replace(/\\/g, '/');
  const rootDir = path.resolve(normalizedInputDir);
  const targetFile = path.resolve(outputFile);

  const tree = await collectTree(rootDir);
  const ext = path.extname(targetFile).toLowerCase();

  if (ext === '.html' || ext === '.htm') {
    const title = path.basename(rootDir) || normalizedInputDir;
    const html = buildHtml(tree, title);
    await fs.writeFile(targetFile, html, 'utf8');
  } else {
    const lines = flattenTree(tree);
    await fs.writeFile(targetFile, `${lines.join('\n')}\n`, 'utf8');
  }

  console.log(`Liste écrite dans ${targetFile}`);
}

main().catch((error) => {
  console.error('Erreur:', error.message);
  process.exit(1);
});
