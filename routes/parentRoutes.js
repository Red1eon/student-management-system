const express = require('express');
const router = express.Router();
const parentController = require('../controllers/parentController');
const { requireAuth, requireRole } = require('../middleware/authMiddleware');

router.use(requireAuth, requireRole(['parent']));

router.get('/dashboard', parentController.getDashboard);
router.get('/my-children', parentController.getMyChildren);
router.get('/attendance', parentController.getAttendance);
router.get('/results', parentController.getResults);
router.get('/fees', parentController.getFees);

module.exports = router;
