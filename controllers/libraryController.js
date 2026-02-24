const BookModel = require('../models/bookModel');
const BookIssueModel = require('../models/bookIssueModel');
const BookRequestModel = require('../models/bookRequestModel');
const UserModel = require('../models/userModel');
const { logAudit } = require('../utils/auditLogger');

const MANAGER_ROLES = ['admin', 'teacher', 'staff', 'librarian'];

function isManager(userType) {
  return MANAGER_ROLES.includes(userType);
}

const libraryController = {
  getLibraryDashboard: async (req, res) => {
    try {
      const userType = req.session.user?.userType;
      if (userType === 'student') {
        return res.redirect('/library/books');
      }

      if (!isManager(userType)) {
        return res.status(403).render('error', { message: 'Access denied' });
      }

      const stats = await BookModel.getStats();
      const recentIssues = await BookIssueModel.getActiveIssues();
      const overdue = await BookIssueModel.getOverdue();
      const pendingRequests = await BookRequestModel.getPending();
      
      res.render('library/index', {
        title: 'Library Management',
        stats,
        recentIssues,
        overdue,
        pendingRequests
      });
    } catch (error) {
      res.status(500).render('error', { message: error.message });
    }
  },

  getAllBooks: async (req, res) => {
    try {
      const userType = req.session.user?.userType;
      const filters = { ...req.query };
      if (userType === 'student') {
        filters.available = true;
      }

      const books = await BookModel.getAll(filters);
      const categories = await BookModel.getCategories();
      const userRequests = userType === 'student'
        ? await BookRequestModel.getByUser(req.session.user.id)
        : [];

      res.render('library/books', {
        title: 'Books',
        books,
        categories,
        filters,
        userRequests,
        canManageLibrary: isManager(userType)
      });
    } catch (error) {
      res.status(500).render('error', { message: error.message });
    }
  },

  getAddBook: (req, res) => {
    res.render('library/add-book', { title: 'Add Book' });
  },

  postAddBook: async (req, res) => {
    try {
      await BookModel.create(req.body);
      await logAudit(req, 'BOOK_CREATED', 'book', req.body.isbn || req.body.title, req.body);
      res.redirect('/library/books?success=Book added successfully');
    } catch (error) {
      res.render('library/add-book', { title: 'Add Book', error: error.message });
    }
  },

  getIssueBook: async (req, res) => {
    try {
      const books = await BookModel.getAll({ available: true });
      const users = await UserModel.getAllByType('student');
      const pendingRequests = await BookRequestModel.getPending();
      res.render('library/issue', { title: 'Issue Book', books, users, pendingRequests });
    } catch (error) {
      res.status(500).render('error', { message: error.message });
    }
  },

  postIssueBook: async (req, res) => {
    try {
      const bookId = parseInt(req.body.book_id, 10);
      const userId = parseInt(req.body.user_id, 10);
      const issuedBy = parseInt(req.session.user?.id, 10);

      if (!bookId || !userId || !issuedBy) {
        return res.redirect('/library/issue?error=Invalid book, student, or issuer');
      }

      const [book, borrower, issuer] = await Promise.all([
        BookModel.findById(bookId),
        UserModel.findById(userId),
        UserModel.findById(issuedBy)
      ]);

      if (!book) {
        return res.redirect('/library/issue?error=Selected book not found');
      }
      if (!borrower || borrower.user_type !== 'student' || !borrower.is_active) {
        return res.redirect('/library/issue?error=Selected student is invalid or inactive');
      }
      if (!issuer || !issuer.is_active) {
        return res.redirect('/library/issue?error=Your account is inactive. Please login again');
      }
      if ((book.available_quantity || 0) <= 0) {
        return res.redirect('/library/issue?error=Book is not available right now');
      }

      const issueData = {
        book_id: bookId,
        user_id: userId,
        issue_date: req.body.issue_date,
        due_date: req.body.due_date,
        issued_by: issuedBy
      };
      
      await BookIssueModel.create(issueData);
      await logAudit(req, 'BOOK_ISSUED', 'book_issue', bookId, {
        user_id: userId,
        issue_date: issueData.issue_date,
        due_date: issueData.due_date
      });
      res.redirect('/library?success=Book issued successfully');
    } catch (error) {
      res.status(500).render('error', { message: error.message });
    }
  },

  postReturnBook: async (req, res) => {
    try {
      const { issue_id, fine_amount, remarks } = req.body;
      
      await BookIssueModel.returnBook(issue_id, {
        return_date: new Date().toISOString().split('T')[0],
        fine_amount: fine_amount || 0,
        remarks
      });
      await logAudit(req, 'BOOK_RETURNED', 'book_issue', issue_id, { fine_amount: fine_amount || 0 });
      
      res.redirect('/library?success=Book returned successfully');
    } catch (error) {
      res.status(500).render('error', { message: error.message });
    }
  },

  postBookRequest: async (req, res) => {
    try {
      const userId = req.session.user.id;
      const bookId = parseInt(req.body.book_id, 10);
      if (!bookId) {
        return res.redirect('/library/books?error=Invalid book selection');
      }

      const book = await BookModel.findById(bookId);
      if (!book) {
        return res.redirect('/library/books?error=Book not found');
      }
      if ((book.available_quantity || 0) <= 0) {
        return res.redirect('/library/books?error=Book is not available right now');
      }

      const alreadyRequested = await BookRequestModel.findPendingByUserAndBook(userId, bookId);
      if (alreadyRequested) {
        return res.redirect('/library/books?error=You already requested this book');
      }

      await BookRequestModel.create({
        book_id: bookId,
        user_id: userId,
        request_date: new Date().toISOString().split('T')[0],
        remarks: req.body.remarks
      });
      await logAudit(req, 'BOOK_REQUESTED', 'book_request', bookId, { user_id: userId });

      res.redirect('/library/books?success=Book request submitted');
    } catch (error) {
      res.status(500).render('error', { message: error.message });
    }
  },

  getBookRequests: async (req, res) => {
    try {
      const pendingRequests = await BookRequestModel.getPending();
      res.render('library/requests', { title: 'Book Requests', pendingRequests });
    } catch (error) {
      res.status(500).render('error', { message: error.message });
    }
  },

  postApproveRequest: async (req, res) => {
    try {
      const requestId = parseInt(req.params.id, 10);
      const request = await BookRequestModel.findById(requestId);
      if (!request || request.status !== 'pending') {
        return res.redirect('/library/requests?error=Request not found');
      }

      if ((request.available_quantity || 0) <= 0) {
        return res.redirect('/library/requests?error=Book is no longer available');
      }

      const issuedBy = parseInt(req.session.user?.id, 10);
      const [requester, issuer] = await Promise.all([
        UserModel.findById(request.user_id),
        UserModel.findById(issuedBy)
      ]);

      if (!requester || requester.user_type !== 'student' || !requester.is_active) {
        return res.redirect('/library/requests?error=Requesting student is invalid or inactive');
      }
      if (!issuer || !issuer.is_active) {
        return res.redirect('/library/requests?error=Your account is inactive. Please login again');
      }

      const issueDate = new Date();
      const dueDate = new Date(issueDate);
      dueDate.setDate(dueDate.getDate() + 14);

      await BookIssueModel.create({
        book_id: request.book_id,
        user_id: request.user_id,
        issue_date: issueDate.toISOString().split('T')[0],
        due_date: dueDate.toISOString().split('T')[0],
        issued_by: issuedBy
      });

      await BookRequestModel.approve(requestId, issuedBy, req.body.remarks);
      await logAudit(req, 'BOOK_REQUEST_APPROVED', 'book_request', requestId, {
        issued_by: issuedBy,
        user_id: request.user_id,
        book_id: request.book_id
      });
      res.redirect('/library/requests?success=Request approved and book issued');
    } catch (error) {
      res.status(500).render('error', { message: error.message });
    }
  },

  postRejectRequest: async (req, res) => {
    try {
      const requestId = parseInt(req.params.id, 10);
      const updated = await BookRequestModel.reject(requestId, req.session.user.id, req.body.remarks);
      if (!updated) {
        return res.redirect('/library/requests?error=Request not found or already processed');
      }
      await logAudit(req, 'BOOK_REQUEST_REJECTED', 'book_request', requestId, {
        processed_by: req.session.user.id
      });
      res.redirect('/library/requests?success=Request rejected');
    } catch (error) {
      res.status(500).render('error', { message: error.message });
    }
  },

  getUserBooks: async (req, res) => {
    try {
      const issues = await BookIssueModel.getByUser(req.session.user.id);
      const requests = await BookRequestModel.getByUser(req.session.user.id);
      res.render('library/user-books', { title: 'My Books', issues, requests });
    } catch (error) {
      res.status(500).render('error', { message: error.message });
    }
  }
};

module.exports = libraryController;
