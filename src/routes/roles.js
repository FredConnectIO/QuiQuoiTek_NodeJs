const express = require('express');
const router = express.Router();
const roleController = require('../controllers/roleController');
const multer = require('multer');
const upload = multer();

router.get('/', roleController.getAllRoles);
router.get('/imgRole/:id/variant/:variant/exists', roleController.checkImgRoleVariantExists);
router.post('/imgRole/:id/variant/:variant/ensure', roleController.ensureImgRoleVariant);
router.get('/imgRole/:id', roleController.getImgRoleById);
router.post('/imgRole/:id', upload.single('image'), roleController.saveImgRole);
router.post('/', roleController.createRole);
router.get('/:id', roleController.getRoleById);
router.put('/:id', roleController.saveRole);
router.delete('/:id', roleController.deleteRole);

module.exports = router;
