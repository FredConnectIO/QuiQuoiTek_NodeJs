const express = require('express');
const router = express.Router();
const photoController = require('../controllers/photoController');

router.get('/', photoController.listPhotos);
router.get('/:filename', photoController.getPhoto);

module.exports = router;
