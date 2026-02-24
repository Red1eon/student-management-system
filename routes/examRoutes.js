const express = require('express');
const router = express.Router();
const examController = require('../controllers/examController');
const { requireAuth, requireRole } = require('../middleware/authMiddleware');

router.get('/', requireAuth, examController.getAllExams);
router.get('/create', requireAuth, requireRole(['admin', 'teacher', 'staff']), examController.getCreateExam);
router.post('/create', requireAuth, requireRole(['admin', 'teacher', 'staff']), examController.postCreateExam);
router.get('/:id', requireAuth, examController.getExamDetail);
router.post('/:id/results', requireAuth, requireRole(['admin', 'teacher']), examController.postEnterResults);
router.get('/student/:studentId/results', requireAuth, examController.getStudentResults);

module.exports = router;