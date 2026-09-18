const express = require('express');
const router = express.Router();
const themeController = require('../controllers/themeController');

router.get('/', themeController.getAllThemes);
router.get('/:id/relthemeCount', themeController.getThemeRelThemeCount);
router.get('/:id', themeController.getThemeById);
router.post('/', themeController.createTheme);
router.put('/:id', themeController.saveTheme);
router.delete('/:id', themeController.deleteTheme);

module.exports = router;
