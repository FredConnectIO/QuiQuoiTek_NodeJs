const express = require('express');
const router = express.Router();
const quoiController = require('../controllers/quoiController');
const multer = require('multer');
const upload = multer();
const csvUpload = multer({
  limits: { fileSize: 10 * 1024 * 1024 },
});

router.get('/', quoiController.getAllQuoi);
router.get('/imgQuoi/:id/variant/:variant/exists', quoiController.checkImgQuoiVariantExists);
router.post('/imgQuoi/:id/variant/:variant/ensure', quoiController.ensureImgQuoiVariant);
router.get('/imgQuoi/:id', quoiController.getImgQuoiById);
router.post('/imgQuoi/:id', upload.single('image'), quoiController.saveImgQuoi);
router.post('/import-csv', csvUpload.single('file'), quoiController.importQuoisCsv);
router.post('/', quoiController.createQuoi);
router.get('/:id/roleCount', quoiController.getQuoiRoleCount);
router.get('/:id/relthemeCount', quoiController.getQuoiRelThemeCount);
router.get('/:id', quoiController.getQuoiById);
router.put('/:id', quoiController.updateQuoi);
router.delete('/:id', quoiController.deleteQuoi);

module.exports = router;
