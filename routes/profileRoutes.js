const express = require('express');
const router = express.Router();
const profileController = require('../controllers/profileController');
const { requireAuth } = require('../middleware/authMiddleware');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const uploadDir = path.join(__dirname, '..', 'public', 'uploads');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    try {
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      cb(null, uploadDir);
    } catch (error) {
      cb(error);
    }
  },
  filename: (req, file, cb) => {
    const userId = req.session?.user?.id || req.session?.user?.user_id || 'user';
    cb(null, `profile-${userId}-${Date.now()}${path.extname(file.originalname)}`);
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (extname && mimetype) return cb(null, true);
    cb(new Error('Only image files are allowed'));
  }
});

router.get('/', requireAuth, profileController.getProfile);
router.get('/edit', requireAuth, profileController.getEditProfile);
router.get('/change-password', requireAuth, profileController.getChangePassword);
router.post('/update', requireAuth, profileController.postUpdateProfile);
router.post('/change-password', requireAuth, profileController.postChangePassword);
router.post('/upload-photo', requireAuth, upload.single('photo'), profileController.postUploadPhoto);

module.exports = router;
