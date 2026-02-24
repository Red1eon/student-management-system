const express = require('express');
const router = express.Router();
const libraryController = require('../controllers/libraryController');
const { requireAuth, requireRole } = require('../middleware/authMiddleware');
const {
  validateLibraryIssue,
  validateBookRequest,
  handleValidationErrors
} = require('../middleware/validationMiddleware');

router.get('/', requireAuth, libraryController.getLibraryDashboard);
router.get('/books', requireAuth, libraryController.getAllBooks);
router.get('/books/add', requireAuth, requireRole(['admin', 'teacher', 'staff', 'librarian']), libraryController.getAddBook);
router.post('/books/add', requireAuth, requireRole(['admin', 'teacher', 'staff', 'librarian']), libraryController.postAddBook);
router.get('/issue', requireAuth, requireRole(['admin', 'teacher', 'staff', 'librarian']), libraryController.getIssueBook);
router.post('/issue', requireAuth, requireRole(['admin', 'teacher', 'staff', 'librarian']), validateLibraryIssue, handleValidationErrors, libraryController.postIssueBook);
router.post('/return', requireAuth, requireRole(['admin', 'teacher', 'staff', 'librarian']), libraryController.postReturnBook);
router.get('/requests', requireAuth, requireRole(['admin', 'teacher', 'staff', 'librarian']), libraryController.getBookRequests);
router.post('/requests/:id/approve', requireAuth, requireRole(['admin', 'teacher', 'staff', 'librarian']), libraryController.postApproveRequest);
router.post('/requests/:id/reject', requireAuth, requireRole(['admin', 'teacher', 'staff', 'librarian']), libraryController.postRejectRequest);
router.post('/request', requireAuth, requireRole(['student']), validateBookRequest, handleValidationErrors, libraryController.postBookRequest);
router.get('/my-books', requireAuth, libraryController.getUserBooks);

module.exports = router;
