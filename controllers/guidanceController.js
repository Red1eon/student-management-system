const GuidanceRecordModel = require('../models/guidanceRecordModel');
const StudentModel = require('../models/studentModel');
const ClassModel = require('../models/classModel');
const TeacherModel = require('../models/teacherModel');

function getRole(user) {
  return user.userType || user.user_type;
}

const guidanceController = {
  getGuidanceDashboard: async (req, res) => {
    try {
      const role = getRole(req.session.user);
      const userId = req.session.user.id || req.session.user.user_id;

      const classes = await ClassModel.getAll();
      let records = [];

      if (role === 'student') {
        records = await GuidanceRecordModel.getAll({ user_id: userId });
      } else if (role === 'parent') {
        const children = await StudentModel.getByParentUserId(userId);
        const ids = children.map((s) => s.student_id);
        records = ids.length ? await GuidanceRecordModel.getAll({ student_ids: ids }) : [];
      } else if (role === 'teacher') {
        const teacher = await TeacherModel.findByUserId(userId);
        records = await GuidanceRecordModel.getAll({
          class_id: req.query.class_id,
          teacher_id: teacher ? teacher.teacher_id : -1
        });
      } else if (role === 'admin') {
        records = await GuidanceRecordModel.getAll({ class_id: req.query.class_id });
      } else {
        return res.status(403).render('error', { message: 'Access denied' });
      }

      const students = (role === 'admin' || role === 'teacher')
        ? await StudentModel.getAll({ class_id: req.query.class_id })
        : [];

      res.render('guidance/index', {
        title: 'Guidance Records',
        records,
        classes,
        students,
        query: req.query,
        filters: req.query,
        canCreate: ['admin', 'teacher'].includes(role)
      });
    } catch (error) {
      res.status(500).render('error', { message: error.message });
    }
  },

  postCreateGuidance: async (req, res) => {
    try {
      const userId = req.session.user.id || req.session.user.user_id;
      const role = getRole(req.session.user);
      const teacher = role === 'teacher' ? await TeacherModel.findByUserId(userId) : null;

      await GuidanceRecordModel.create({
        student_id: parseInt(req.body.student_id, 10),
        teacher_id: teacher ? teacher.teacher_id : (req.body.teacher_id ? parseInt(req.body.teacher_id, 10) : null),
        guidance_date: req.body.guidance_date || new Date().toISOString().slice(0, 10),
        category: req.body.category || 'academic',
        notes: req.body.notes || '',
        follow_up: req.body.follow_up || '',
        created_by: userId
      });

      res.redirect('/guidance?success=Guidance record created');
    } catch (error) {
      res.redirect(`/guidance?error=${encodeURIComponent(error.message)}`);
    }
  },

  getStudentGuidance: async (req, res) => {
    try {
      const student = await StudentModel.findById(req.params.studentId);
      if (!student) return res.status(404).render('404', { title: 'Page Not Found' });

      const records = await GuidanceRecordModel.getAll({ student_id: req.params.studentId });
      res.render('guidance/student', {
        title: `Guidance - ${student.first_name} ${student.last_name}`,
        student,
        records
      });
    } catch (error) {
      res.status(500).render('error', { message: error.message });
    }
  }
};

module.exports = guidanceController;
