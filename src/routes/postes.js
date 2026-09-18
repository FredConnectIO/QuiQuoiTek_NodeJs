const express = require('express');
const posteController = require('../controllers/posteController');

const router = express.Router();

router.get('/', posteController.getAllPostes);
router.post('/', posteController.createPoste);
router.get('/:id', posteController.getPosteById);
router.put('/:id', posteController.savePoste);
router.delete('/:id', posteController.deletePoste);

module.exports = router;
