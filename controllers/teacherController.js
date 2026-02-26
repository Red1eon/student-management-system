const TeacherModel = require('../models/teacherModel');
const UserModel = require('../models/userModel');
const DepartmentModel = require('../models/departmentModel');
const ClassModel = require('../models/classModel');
const SubjectModel = require('../models/subjectModel');

const NONE_VALUES = new Set(['none', 'なし', 'n/a', 'na', 'null', '-']);

function isNoneValue(value) {
  if (value === undefined || value === null) return true;
  return NONE_VALUES.has(String(value).trim().toLowerCase());
}

function toNullableText(value) {
  if (isNoneValue(value)) return null;
  const trimmed = String(value).trim();
  return trimmed.length ? trimmed : null;
}

function toNullableId(value) {
  if (isNoneValue(value)) return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function pickInputValue(primary, secondary) {
  const first = toNullableText(primary);
  if (first !== null) return first;
  return secondary;
}

const teacherController = {
  getAllTeachers: async (req, res) => {
    try {
      const teachers = await TeacherModel.getAll();
      res.render('teachers/index', { title: 'Teachers', teachers });
    } catch (error) {
      res.status(500).render('error', { message: error.message });
    }
  },

  getTeacherDetail: async (req, res) => {
    try {
      const teacher = await TeacherModel.findById(req.params.id);
      if (!teacher) return res.status(404).render('404', { title: 'Page Not Found' });
      
      const [subjects, classes, allSubjects] = await Promise.all([
        TeacherModel.getSubjects(req.params.id),
        ClassModel.getAll(),
        SubjectModel.getAll()
      ]);
      res.render('teachers/detail', {
        title: teacher.first_name + ' ' + teacher.last_name,
        teacher,
        subjects,
        classes,
        allSubjects
      });
    } catch (error) {
      res.status(500).render('error', { message: error.message });
    }
  },

  getAddTeacher: async (req, res) => {
    const departments = await DepartmentModel.getAll();
    res.render('teachers/add', { title: 'Add Teacher', departments });
  },

  postAddTeacher: async (req, res) => {
    try {
      const employeeNumber = toNullableText(req.body.employee_number);
      if (!employeeNumber) throw new Error('Employee number is required');

      const hireDate = toNullableText(req.body.hire_date) || new Date().toISOString().split('T')[0];
      const departmentInput = pickInputValue(req.body.department_id_text, req.body.department_id);
      const departmentId = toNullableId(departmentInput);

      const userData = {
        username: employeeNumber,
        password: hireDate,
        email: toNullableText(req.body.email) || `${employeeNumber.toLowerCase()}@school.local`,
        first_name: toNullableText(req.body.first_name) || 'なし',
        last_name: toNullableText(req.body.last_name) || 'なし',
        phone: toNullableText(req.body.phone),
        user_type: 'teacher'
      };
      
      const userId = await UserModel.create(userData);
      
      const teacherData = {
        user_id: userId,
        employee_number: employeeNumber,
        hire_date: hireDate,
        qualification: toNullableText(req.body.qualification),
        specialization: toNullableText(req.body.specialization),
        department_id: departmentId
      };
      
      await TeacherModel.create(teacherData);
      res.redirect('/teachers?success=Teacher added successfully');
    } catch (error) {
      const departments = await DepartmentModel.getAll();
      res.render('teachers/add', { title: 'Add Teacher', departments, error: error.message, formData: req.body });
    }
  },

  assignSubject: async (req, res) => {
    try {
      await TeacherModel.assignSubject(
        req.params.id,
        req.body.subject_id,
        req.body.class_id,
        req.body.academic_year
      );
      res.redirect(`/teachers/${req.params.id}?success=Subject assigned`);
    } catch (error) {
      res.status(500).render('error', { message: error.message });
    }
  }
};

module.exports = teacherController;
