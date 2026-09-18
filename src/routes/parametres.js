const express = require('express');
const router = express.Router();
const parametreController = require('../controllers/parametreController');

router.get('/', parametreController.getAllParametres);
router.get('/:id', parametreController.getParametreById);
router.post('/', parametreController.createParametre);
router.put('/:id', parametreController.saveParametre);
router.delete('/:id', parametreController.deleteParametre);

module.exports = router;
