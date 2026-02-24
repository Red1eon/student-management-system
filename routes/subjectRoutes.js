const express = require('express');
const router = express.Router();
const subjectController = require('../controllers/subjectController');
const { requireAuth, requireRole } = require('../middleware/authMiddleware');
const { validateSubjectCreate, handleValidationErrors } = require('../middleware/validationMiddleware');

router.get('/', requireAuth, requireRole(['admin', 'staff']), subjectController.getAllSubjects);
router.get('/add', requireAuth, requireRole(['admin', 'staff']), subjectController.getAddSubject);
router.post('/add', requireAuth, requireRole(['admin', 'staff']), validateSubjectCreate, handleValidationErrors, subjectController.postAddSubject);
router.get('/:id/edit', requireAuth, requireRole(['admin', 'staff']), subjectController.getEditSubject);
router.post('/:id/edit', requireAuth, requireRole(['admin', 'staff']), validateSubjectCreate, handleValidationErrors, subjectController.postEditSubject);
router.delete('/:id', requireAuth, requireRole(['admin', 'staff']), subjectController.deleteSubject);

module.exports = router;
