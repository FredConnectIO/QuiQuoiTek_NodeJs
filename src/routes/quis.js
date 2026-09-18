const express = require('express');
const router = express.Router();
const quiController = require('../controllers/quiController');
const multer = require('multer');
const upload = multer();

router.get('/', quiController.getAllQui);
router.get('/:id/roleCount', quiController.getQuiRoleCount);
router.get('/:id/relthemeCount', quiController.getQuiRelThemeCount);
router.get('/:id/posteCount', quiController.getQuiPosteCount);
router.get('/:id', quiController.getQuiById);
router.get('/imgQui/:id/variant/:variant/exists', quiController.checkImgQuiVariantExists);
router.post('/imgQui/:id/variant/:variant/ensure', quiController.ensureImgQuiVariant);
router.get('/imgQui/:id', quiController.getImgQuiById);
router.post('/', quiController.createQui);
router.put('/:id', quiController.saveQui);
router.delete('/:id', quiController.deleteQui);
router.post('/imgQui/:id', upload.single('image'), quiController.saveImgQui);

module.exports = router;
