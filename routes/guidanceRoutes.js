const express = require('express');
const router = express.Router();
const guidanceController = require('../controllers/guidanceController');
const { requireAuth, requireRole, requireStudentAccess } = require('../middleware/authMiddleware');

router.get('/', requireAuth, requireRole(['admin', 'teacher', 'student', 'parent']), guidanceController.getGuidanceDashboard);
router.post('/', requireAuth, requireRole(['admin', 'teacher']), guidanceController.postCreateGuidance);
router.get(
  '/student/:studentId',
  requireAuth,
  requireStudentAccess('studentId', ['admin', 'teacher']),
  guidanceController.getStudentGuidance
);

module.exports = router;
