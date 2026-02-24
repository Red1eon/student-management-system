const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { createLoginRateLimiter } = require('../middleware/securityMiddleware');
const { validateLogin, handleValidationErrors } = require('../middleware/validationMiddleware');

router.get('/login', authController.getLogin);
router.post('/login', createLoginRateLimiter(), validateLogin, handleValidationErrors, authController.postLogin);
router.get('/register', authController.getRegister);
router.post('/register', authController.postRegister);
router.get('/logout', authController.logout);

module.exports = router;
