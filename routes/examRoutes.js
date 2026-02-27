const express = require('express');
const router = express.Router();
const examController = require('../controllers/examController');
const { requireAuth, requireRole, requireStudentAccess, requirePermission } = require('../middleware/authMiddleware');

router.get('/', requireAuth, examController.getAllExams);
router.get('/create', requireAuth, requireRole(['admin', 'teacher', 'staff']), examController.getCreateExam);
router.post('/create', requireAuth, requireRole(['admin', 'teacher', 'staff']), examController.postCreateExam);
router.get('/export/csv', requireAuth, requirePermission('exams.export', ['admin', 'teacher', 'staff']), examController.exportResultsCsv);
router.get('/student/:studentId/results', requireAuth, requireStudentAccess('studentId', ['admin', 'staff', 'teacher']), examController.getStudentResults);
router.get('/student/:studentId/progress/export', requireAuth, requirePermission('reports.export', ['admin', 'staff', 'teacher']), requireStudentAccess('studentId', ['admin', 'staff', 'teacher']), examController.exportStudentProgressCsv);
router.get('/:id', requireAuth, examController.getExamDetail);
router.post('/:id/results', requireAuth, requireRole(['admin', 'teacher']), examController.postEnterResults);

module.exports = router;
