const CourseModel = require('../models/courseModel');
const FeeModel = require('../models/feeModel');
const ClassModel = require('../models/classModel');
const { logAudit } = require('../utils/auditLogger');

const COURSE_TYPES = new Set(['certificate', 'diploma', 'degree', 'short_course', 'other']);
const FEE_PAYMENT_PLANS = new Set(['one_time', 'monthly', 'quarterly', 'yearly', 'installment', 'flexible']);

function pickAllowed(value, allowedValues, fallback) {
  const input = String(value || '').trim();
  return allowedValues.has(input) ? input : fallback;
}

const courseController = {
  getCourses: async (req, res) => {
    try {
      const role = req.session.user?.userType || req.session.user?.user_type;
      const courses = role === 'admin' || role === 'staff'
        ? await CourseModel.getAll()
        : await CourseModel.getActive();

      res.render('courses/index', { title: 'Courses', courses, role });
    } catch (error) {
      res.status(500).render('error', { message: error.message });
    }
  },

  getAddCourse: async (req, res) => {
    res.render('courses/add', { title: 'Add Course' });
  },

  postAddCourse: async (req, res) => {
    try {
      const feeAmount = Number.parseFloat(req.body.fee_amount);
      const payload = {
        course_name: req.body.course_name,
        course_code: req.body.course_code,
        course_type: pickAllowed(req.body.course_type, COURSE_TYPES, 'other'),
        fee_amount: Number.isFinite(feeAmount) && feeAmount >= 0 ? feeAmount : 0,
        fee_payment_plan: pickAllowed(req.body.fee_payment_plan, FEE_PAYMENT_PLANS, 'one_time'),
        fee_payment_description: String(req.body.fee_payment_description || '').trim() || null,
        is_active: req.body.is_active ? 1 : 0,
        created_by: req.session.user?.id || req.session.user?.user_id || null
      };

      const result = await CourseModel.create(payload);
      await logAudit(req, 'COURSE_CREATED', 'course', result.id, payload);
      res.redirect('/courses?success=Course created successfully');
    } catch (error) {
      res.status(400).render('courses/add', {
        title: 'Add Course',
        error: error.message,
        formData: req.body
      });
    }
  },

  getEditCourse: async (req, res) => {
    try {
      const course = await CourseModel.findById(req.params.id);
      if (!course) return res.status(404).render('404', { title: 'Page Not Found' });
      const allClasses = await ClassModel.getAll();
      const courseClasses = (allClasses || []).filter((c) => String(c.course_id || '') === String(course.course_id));
      const classIdSet = new Set(courseClasses.map((c) => Number(c.class_id)));
      const allFees = await FeeModel.getAll();
      const courseFees = (allFees || [])
        .filter((f) => f.class_id == null || classIdSet.has(Number(f.class_id)))
        .sort((a, b) => String(a.due_date || '').localeCompare(String(b.due_date || '')));

      res.render('courses/edit', { title: 'Edit Course', course, courseClasses, courseFees });
    } catch (error) {
      res.status(500).render('error', { message: error.message });
    }
  },

  postEditCourse: async (req, res) => {
    try {
      const feeAmount = Number.parseFloat(req.body.fee_amount);
      const updateData = {
        course_name: req.body.course_name,
        course_code: req.body.course_code,
        course_type: pickAllowed(req.body.course_type, COURSE_TYPES, 'other'),
        fee_amount: Number.isFinite(feeAmount) && feeAmount >= 0 ? feeAmount : 0,
        fee_payment_plan: pickAllowed(req.body.fee_payment_plan, FEE_PAYMENT_PLANS, 'one_time'),
        fee_payment_description: String(req.body.fee_payment_description || '').trim() || null,
        is_active: req.body.is_active ? 1 : 0
      };

      await CourseModel.update(req.params.id, updateData);
      await logAudit(req, 'COURSE_UPDATED', 'course', req.params.id, updateData);
      res.redirect('/courses?success=Course updated successfully');
    } catch (error) {
      const course = await CourseModel.findById(req.params.id);
      const allClasses = await ClassModel.getAll();
      const courseClasses = (allClasses || []).filter((c) => String(c.course_id || '') === String(req.params.id));
      const classIdSet = new Set(courseClasses.map((c) => Number(c.class_id)));
      const allFees = await FeeModel.getAll();
      const courseFees = (allFees || [])
        .filter((f) => f.class_id == null || classIdSet.has(Number(f.class_id)))
        .sort((a, b) => String(a.due_date || '').localeCompare(String(b.due_date || '')));
      res.status(400).render('courses/edit', {
        title: 'Edit Course',
        course: course || { course_id: req.params.id, ...req.body },
        courseClasses,
        courseFees,
        error: error.message
      });
    }
  },

  deleteCourse: async (req, res) => {
    try {
      await CourseModel.delete(req.params.id);
      await logAudit(req, 'COURSE_DELETED', 'course', req.params.id, {});
      res.redirect('/courses?success=Course deleted successfully');
    } catch (error) {
      res.status(500).render('error', { message: error.message });
    }
  }
};

module.exports = courseController;
