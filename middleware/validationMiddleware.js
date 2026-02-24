const { body, validationResult } = require('express-validator');

const validateLogin = [
  body('username').trim().notEmpty().withMessage('Username is required'),
  body('password').notEmpty().withMessage('Password is required')
];

const validateStudentCreate = [
  body('admission_number').trim().notEmpty().withMessage('Admission number is required'),
  body('first_name').optional({ checkFalsy: true }).isLength({ max: 100 }).withMessage('First name is too long'),
  body('last_name').optional({ checkFalsy: true }).isLength({ max: 100 }).withMessage('Last name is too long'),
  body('email').optional({ checkFalsy: true }).isEmail().withMessage('Invalid email'),
  body('admission_date').trim().notEmpty().withMessage('Admission date is required')
];

const validateClassCreate = [
  body('class_name').trim().notEmpty().withMessage('Class name is required'),
  body('class_code').trim().notEmpty().withMessage('Class code is required'),
  body('academic_year').trim().notEmpty().withMessage('Academic year is required'),
  body('capacity').optional({ checkFalsy: true }).isInt({ min: 1, max: 500 }).withMessage('Capacity must be 1-500')
];

const validateSubjectCreate = [
  body('subject_name').trim().notEmpty().withMessage('Subject name is required'),
  body('subject_code').trim().notEmpty().withMessage('Subject code is required'),
  body('credits').optional({ checkFalsy: true }).isInt({ min: 1, max: 20 }).withMessage('Credits must be 1-20')
];

const validateLibraryIssue = [
  body('user_id').notEmpty().withMessage('Student is required').isInt({ min: 1 }).withMessage('Invalid student'),
  body('book_id').notEmpty().withMessage('Book is required').isInt({ min: 1 }).withMessage('Invalid book'),
  body('issue_date').notEmpty().withMessage('Issue date is required').isISO8601().withMessage('Invalid issue date'),
  body('due_date').notEmpty().withMessage('Due date is required').isISO8601().withMessage('Invalid due date')
];

const validateBookRequest = [
  body('book_id').notEmpty().withMessage('Book is required').isInt({ min: 1 }).withMessage('Invalid book')
];

function handleValidationErrors(req, res, next) {
  const result = validationResult(req);
  if (result.isEmpty()) return next();
  const error = result.array()[0].msg;
  return res.status(400).render('error', { message: error });
}

module.exports = {
  validateLogin,
  validateStudentCreate,
  validateClassCreate,
  validateSubjectCreate,
  validateLibraryIssue,
  validateBookRequest,
  handleValidationErrors
};
