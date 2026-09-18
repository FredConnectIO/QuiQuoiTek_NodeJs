const express = require('express');
const router = express.Router();
const relThemeController = require('../controllers/relThemeController');

router.get('/', relThemeController.getAllRelThemes);
router.get('/qui/:idQui', relThemeController.getRelThemesByQui);
router.get('/quoi/:idQuoi', relThemeController.getRelThemesByQuoi);
router.get('/role/:idRole', relThemeController.getRelThemesByRole);
router.get('/theme/:idTheme', relThemeController.getRelThemesByTheme);
router.get('/:id', relThemeController.getRelThemeById);
router.post('/', relThemeController.createRelTheme);
router.put('/:id', relThemeController.updateRelTheme);
router.delete('/:id', relThemeController.deleteRelTheme);

module.exports = router;
