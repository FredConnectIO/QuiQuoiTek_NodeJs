const fs = require('fs').promises;
const path = require('path');
const { URL } = require('url');

const DEFAULT_PHOTOS_DIRECTORY =  path.resolve('C:\\PARTAGE\\QQT_Data\\Photos');
const DEFAULT_PHOTOS_PARENT_DIRECTORY = path.dirname(DEFAULT_PHOTOS_DIRECTORY);
const FALLBACK_IMAGE = path.resolve(__dirname, '..', '..', 'public', 'img', 'ko.jpg');

const isImageFile = (filename) => /\.(png|jpe?g|gif|bmp|webp)$/i.test(filename);

const stripWrappingQuotes = (value = '') => value.replace(/^['"]+|['"]+$/g, '');

const sanitizeFolderName = (value = '') => {
  const trimmed = stripWrappingQuotes(value).trim();
  if (!trimmed) {
    return '';
  }
  const folderName = path.basename(trimmed);
  if (!folderName || folderName === '.' || folderName === '..') {
    return '';
  }
  return folderName;
};

const resolveRequestedDirectory = (rawDir, rawFolder) => {
  const sanitizedDirInput = stripWrappingQuotes(rawDir || '').trim();
  if (sanitizedDirInput) {
    const resolvedDir = path.resolve(sanitizedDirInput);
    return { directoryPath: resolvedDir, responseQuery: { dir: resolvedDir } };
  }

  const folderName = sanitizeFolderName(rawFolder);
  if (folderName) {
    const resolvedDir = path.join(DEFAULT_PHOTOS_PARENT_DIRECTORY, folderName);
    return { directoryPath: resolvedDir, responseQuery: { folder: folderName } };
  }

  return { directoryPath: DEFAULT_PHOTOS_DIRECTORY, responseQuery: null };
};

const buildPhotoUrl = (filename, params) => {
  const url = new URL(`/photos/${encodeURIComponent(filename)}`, 'http://localhost');
  if (params && params.dir) {
    url.searchParams.set('dir', params.dir);
  } else if (params && params.folder) {
    url.searchParams.set('folder', params.folder);
  }
  return `${url.pathname}${url.search}`;
};

exports.listPhotos = async (req, res) => {
  const rawDirectoryParam = req.query.dir;
  const rawFolderParam = req.query.folder;
  const { directoryPath, responseQuery } = resolveRequestedDirectory(rawDirectoryParam, rawFolderParam);

  try {
    const entries = await fs.readdir(directoryPath, { withFileTypes: true });
    const photos = entries
      .filter((entry) => entry.isFile() && isImageFile(entry.name))
      .map((entry) => entry.name)
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }))
      .map((filename) => ({
        filename,
        url: buildPhotoUrl(filename, responseQuery),
      }));

    res.json(photos);
  } catch (error) {
    if (error.code === 'ENOENT') {
      return res.json([]);
    }
    console.error('Error while listing photos:', error);
    res.status(500).json({ error: 'Unable to list photos' });
  }
};

exports.getPhoto = async (req, res) => {
  const sanitizedName = path.basename(req.params.filename);
  const rawDirectoryParam = req.query.dir;
  const rawFolderParam = req.query.folder;
  const { directoryPath } = resolveRequestedDirectory(rawDirectoryParam, rawFolderParam);
  const photoPath = path.join(directoryPath, sanitizedName);

  try {
    await fs.access(photoPath);
    res.sendFile(photoPath);
  } catch (error) {
    if (error.code === 'ENOENT') {
      return res.sendFile(FALLBACK_IMAGE);
    }
    console.error('Error while serving photo:', error);
    res.status(500).send('Unable to retrieve photo');
  }
};
