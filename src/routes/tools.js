const express = require('express');
const fs = require('fs');
const path = require('path');

const router = express.Router();
const { exportAllTables } = require('../../db/export/exportAllTables');
const childProcess = require('child_process');
const os = require('os');

router.post('/export-all-tables', async (_req, res) => {
  try {
    const result = await exportAllTables();
    const responsePayload = {
      success: true,
      tables: (result && result.tables) || [],
      outputDir: (result && result.outputDir) || '',
    };
    res.json(responsePayload);
  } catch (error) {
    console.error('Unable to export all tables', error);
    res.status(500).json({ success: false, error: 'Export des tables impossible.' });
  }
});

// Run arborescence scripts and return generated file content (HTML or text)
router.get('/arborescence/:name', async (req, res) => {
  const allowed = new Set([
    'list-tree-dir',
    'list-tree-dir-2niv',
    'list-tree-dir-3niv',
    'list-tree-file',
  ]);
  const name = String(req.params.name || '').trim();
  if (!allowed.has(name)) {
    return res.status(404).send('Script not found');
  }

  const rawInputDir = typeof req.query.dir === 'string' && req.query.dir.trim() ? req.query.dir.trim() : process.cwd();
  const inputDir = path.normalize(rawInputDir.replace(/\//g, path.sep));
  // choose default extension: html for dir scripts, txt for file list
  const defaultExt = name === 'list-tree-file' ? '.txt' : '.html';
  const requestedFormat = req.query.format === 'txt' || req.query.format === 'html'
    ? req.query.format
    : defaultExt.slice(1);
  const outputExt = `.${requestedFormat}`;

  const providedOutput = typeof req.query.output === 'string' && req.query.output.trim() ? req.query.output.trim() : null;
  let outPath;
  let cleanup = true;
  if (providedOutput) {
    // sanitize filename and apply the selected format
    const providedFilename = path.basename(providedOutput);
    const currentExt = path.extname(providedFilename);
    const filename = `${currentExt ? providedFilename.slice(0, -currentExt.length) : providedFilename}${outputExt}`;
    // write into C:\PARTAGE by default
    outPath = path.join('C:\\PARTAGE', filename);
    cleanup = false; // keep user-specified output
  } else {
    const tmpName = `arbo-${Date.now()}-${Math.floor(Math.random() * 100000)}${outputExt}`;
    outPath = path.join(os.tmpdir(), tmpName);
    cleanup = true;
  }

  const scriptDirectory = name === 'list-tree-dir-3niv'
    ? path.resolve(__dirname, '..', '..', 'zoutils', 'arborescence')
    : path.resolve(__dirname, '..', '..', 'public', 'js', 'arborescence');
  const scriptPath = path.join(scriptDirectory, `${name}.js`);

  try {
    await new Promise((resolve, reject) => {
      const scriptArgs = [scriptPath, inputDir, outPath];
      if (name === 'list-tree-dir-3niv' && requestedFormat === 'txt') {
        const withIntermediateLevels = req.query.niveauxIntermediaires !== 'n';
        scriptArgs.push(withIntermediateLevels ? 'avec-intermediaires' : 'sans-intermediaires');
      }
      const child = childProcess.spawn(process.execPath, scriptArgs, { windowsHide: true });
      let stderr = '';
      child.stderr.on('data', (chunk) => { stderr += String(chunk); });
      child.on('error', reject);
      child.on('close', (code) => {
        if (code === 0) return resolve();
        const err = new Error(`Script exited with code ${code}: ${stderr}`);
        return reject(err);
      });
    });

    if (!fs.existsSync(outPath)) {
      return res.status(500).send('Le script n\'a pas généré de sortie.');
    }

    const content = fs.readFileSync(outPath, 'utf8');
    // set content type based on extension
    if (outputExt === '.html') {
      res.set('Content-Type', 'text/html; charset=utf-8');
    } else {
      res.set('Content-Type', 'text/plain; charset=utf-8');
    }
    res.send(content);
  } catch (error) {
    console.error('Arborescence script failed', error);
    res.status(500).send(`Erreur lors de l\'exécution du script: ${error.message}`);
  } finally {
    try {
      if (cleanup && fs.existsSync(outPath)) {
        fs.unlinkSync(outPath);
      }
    } catch (e) {
      /* ignore cleanup errors */
    }
  }
});

router.get('/open-file', (req, res) => {
  const target = typeof req.query.target === 'string' ? req.query.target.trim() : '';
  if (!target) {
    return res.status(400).send('Missing target URL');
  }
  return res.redirect(target);
});

router.get('/open-file-local', (req, res) => {
  console.log('req: /open-file-local');
  const target = typeof req.query.target === 'string' ? req.query.target.trim() : '';
  if (!target) {
    return res.status(400).send('Missing target path');
  }
  let filePath = target;
  if (/^file:\/\//i.test(target)) {
    try {
      const url = new URL(target);
      filePath = decodeURIComponent(url.pathname || '');
      if (/^\/[a-zA-Z]:/.test(filePath)) {
        filePath = filePath.slice(1);
      }
    } catch (error) {
      return res.status(400).send('Invalid file URL');
    }
  } else {
    try {
      filePath = decodeURIComponent(filePath);
    } catch (error) {
      // keep raw value if decoding fails
    }
  }
  filePath = filePath.replace(/\//g, '\\');
  filePath = filePath.replace(/^"(.*)"$/, '$1');
  if (!/^[a-zA-Z]:\\$/.test(filePath)) {
    filePath = filePath.replace(/\\+$/, '');
  }
  const resolveExistingFolder = (targetPath) => {
    if (!targetPath) {
      return targetPath;
    }
    try {
      if (fs.existsSync(targetPath) && fs.statSync(targetPath).isDirectory()) {
        return targetPath;
      }
    } catch (error) {
      // ignore stat failures
    }
    let dir = path.dirname(targetPath);
    if (fs.existsSync(dir)) {
      return dir;
    }
    const parent = path.dirname(dir);
    if (parent !== dir && fs.existsSync(parent)) {
      return parent;
    }
    const grandParent = path.dirname(parent);
    if (grandParent !== parent && fs.existsSync(grandParent)) {
      return grandParent;
    }
    return targetPath;
  };
  filePath = resolveExistingFolder(filePath);
  console.log('filePath=[' + filePath + ']');
  if (!filePath) {
    return res.status(400).send('Invalid target path');
  }
  try {
    require('child_process').spawn('explorer.exe', [filePath], {
      detached: true,
      stdio: 'ignore',
    }).unref();
    return res.send(`<!DOCTYPE html>
<html lang="fr">
  <head><meta charset="UTF-8"><title>Ouverture</title></head>
  <body>
    <p>Ouverture demand&eacute;e.</p>
    <script>window.close();</script>
  </body>
</html>`);
  } catch (error) {
    console.error('Unable to open local path', error);
    return res.status(500).send('Open failed');
  }
});

module.exports = router;
