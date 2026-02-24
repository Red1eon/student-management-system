const AttendanceModel = require('../models/AttendanceModel');
const ClassModel = require('../models/ClassModel');
const StudentModel = require('../models/studentModel');

const attendanceController = {
  getAttendanceDashboard: async (req, res) => {
    try {
      const classes = await ClassModel.getAll();
      res.render('attendance/index', { title: 'Attendance', classes });
    } catch (error) {
      res.status(500).render('error', { message: error.message });
    }
  },

  getMarkAttendance: async (req, res) => {
    try {
      const { class_id, date } = req.query;
      const classes = await ClassModel.getAll();
      
      let students = [];
      let existingAttendance = [];
      
      if (class_id && date) {
        students = await StudentModel.getAll({ class_id });
        existingAttendance = await AttendanceModel.getByClass(class_id, date);
      }
      
      res.render('attendance/mark', {
        title: 'Mark Attendance',
        classes,
        students,
        existingAttendance,
        selectedClass: class_id,
        selectedDate: date
      });
    } catch (error) {
      res.status(500).render('error', { message: error.message });
    }
  },

  postMarkAttendance: async (req, res) => {
    try {
      const { class_id, date, attendance } = req.body;
      const records = Object.entries(attendance).map(([student_id, data]) => ({
        student_id: parseInt(student_id),
        class_id: parseInt(class_id),
        date,
        status: data.status,
        remarks: data.remarks || '',
        marked_by: req.session.user.id
      }));
      
      await AttendanceModel.bulkCreate(records);
      res.redirect(`/attendance/mark?class_id=${class_id}&date=${date}&success=Attendance saved`);
    } catch (error) {
      res.status(500).render('error', { message: error.message });
    }
  },

  getStudentAttendance: async (req, res) => {
    try {
      const student = await StudentModel.findById(req.params.studentId);
      const month = req.query.month || new Date().getMonth() + 1;
      const year = req.query.year || new Date().getFullYear();
      
      const attendance = await AttendanceModel.getByStudent(req.params.studentId, month, year);
      const stats = await AttendanceModel.getMonthlyStats(req.params.studentId, month, year);
      
      res.render('attendance/student', {
        title: 'Student Attendance',
        student,
        attendance,
        stats,
        month,
        year
      });
    } catch (error) {
      res.status(500).render('error', { message: error.message });
    }
  },

  getAttendanceReport: async (req, res) => {
    try {
      const { class_id, month, year } = req.query;
      const classes = await ClassModel.getAll();
      
      let report = null;
      if (class_id && month && year) {
        const students = await StudentModel.getAll({ class_id });
        report = await Promise.all(students.map(async (s) => {
          const stats = await AttendanceModel.getMonthlyStats(s.student_id, month, year);
          return { ...s, stats };
        }));
      }
      
      res.render('attendance/report', {
        title: 'Attendance Report',
        classes,
        report,
        filters: { class_id, month, year }
      });
    } catch (error) {
      res.status(500).render('error', { message: error.message });
    }
  }
};

module.exports = attendanceController;