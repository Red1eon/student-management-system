const ClassModel = require('../models/classModel');
const TeacherModel = require('../models/teacherModel');
const StudentModel = require('../models/studentModel');
const TimetableModel = require('../models/timetableModel');
const SubjectModel = require('../models/subjectModel');
const CourseModel = require('../models/courseModel');
const NotificationModel = require('../models/notificationModel');
const { logAudit } = require('../utils/auditLogger');

const NONE_VALUES = new Set(['none', 'nashi', 'なし', 'n/a', 'na', 'null', '-']);

function toNullableText(value) {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  if (!text) return null;
  return NONE_VALUES.has(text.toLowerCase()) ? null : text;
}

const COURSE_TYPES = new Set(['certificate', 'diploma', 'degree', 'short_course', 'other']);
const FEE_PAYMENT_PLANS = new Set(['one_time', 'monthly', 'quarterly', 'yearly', 'installment', 'flexible']);

function pickAllowed(value, allowedValues, fallback) {
  const input = String(value || '').trim();
  return allowedValues.has(input) ? input : fallback;
}

function getActorUserId(req) {
  const raw = req?.session?.user?.user_id ?? req?.session?.user?.id;
  const parsed = Number.parseInt(raw, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function getClassDisplayName(classData) {
  return `${classData?.class_name || ''} ${classData?.section || ''}`.trim() || 'the selected class';
}

async function resolveSelectedCourse(courseIdInput) {
  const courseId = Number.parseInt(courseIdInput, 10);
  if (!Number.isInteger(courseId) || courseId <= 0) {
    return { courseId: null, course: null };
  }
  const course = await CourseModel.findById(courseId);
  if (!course) {
    return { courseId: null, course: null };
  }
  return { courseId, course };
}

async function createSubjectIfProvided(subjectNameInput, subjectCodeInput, className) {
  const subjectName = toNullableText(subjectNameInput);
  if (!subjectName) return;

  const subjects = await SubjectModel.getAll();
  const normalized = subjectName.toLowerCase();
  const existing = subjects.find((s) => String(s.subject_name || '').toLowerCase() === normalized);
  if (existing) return;

  let subjectCode = toNullableText(subjectCodeInput);
  if (!subjectCode) {
    const prefix = subjectName.replace(/[^a-z0-9]/gi, '').toUpperCase().slice(0, 5) || 'SUBJ';
    subjectCode = `${prefix}${Date.now().toString().slice(-5)}`;
  } else {
    subjectCode = subjectCode.toUpperCase();
  }

  while (await SubjectModel.findByCode(subjectCode)) {
    subjectCode = `${subjectCode.replace(/\d+$/, '')}${Math.floor(10000 + Math.random() * 90000)}`;
  }

  await SubjectModel.create({
    subject_name: subjectName,
    subject_code: subjectCode,
    description: className ? `Created while adding class ${className}` : null,
    credits: 3,
    department_id: null
  });
}

const classController = {
  getAllClasses: async (req, res) => {
    try {
      const classes = await ClassModel.getAll();
      res.render('classes/index', { title: 'Classes', classes });
    } catch (error) {
      res.status(500).render('error', { message: error.message });
    }
  },

  getClassDetail: async (req, res) => {
    try {
      const classData = await ClassModel.findById(req.params.id);
      if (!classData) return res.status(404).render('404', { title: 'Page Not Found' });
      
      const students = await StudentModel.getAll({ class_id: req.params.id });
      const timetable = await TimetableModel.getByClass(req.params.id, new Date().getFullYear());
      const classes = await ClassModel.getAll();
      const subjects = await SubjectModel.getAll();
      const teachers = await TeacherModel.getAll();
      
      res.render('classes/detail', { 
        title: classData.class_name + ' ' + classData.section,
        classData,
        students,
        timetable,
        classes,
        subjects,
        teachers
      });
    } catch (error) {
      res.status(500).render('error', { message: error.message });
    }
  },

  getAddClass: async (req, res) => {
    const teachers = await TeacherModel.getAll();
    const courses = await CourseModel.getActive();
    res.render('classes/add', { title: 'Add Class', teachers, courses });
  },

  postAddClass: async (req, res) => {
    try {
      const { courseId, course } = await resolveSelectedCourse(req.body.course_id);
      const courseFee = Number.parseFloat(req.body.course_fee);
      const fallbackCourseFee = Number.parseFloat(course?.fee_amount);
      const payload = {
        ...req.body,
        class_teacher_id: req.body.class_teacher_id ? parseInt(req.body.class_teacher_id, 10) : null,
        course_id: courseId,
        course_type: pickAllowed(req.body.course_type || course?.course_type, COURSE_TYPES, 'other'),
        course_fee: Number.isFinite(courseFee) && courseFee >= 0
          ? courseFee
          : (Number.isFinite(fallbackCourseFee) && fallbackCourseFee >= 0 ? fallbackCourseFee : 0),
        fee_payment_plan: pickAllowed(req.body.fee_payment_plan || course?.fee_payment_plan, FEE_PAYMENT_PLANS, 'one_time')
      };
      await ClassModel.create(payload);
      await createSubjectIfProvided(req.body.subject_name, req.body.subject_code, req.body.class_name);
      await logAudit(req, 'CLASS_CREATED', 'class', payload.class_code, payload);
      res.redirect('/classes?success=Class created successfully');
    } catch (error) {
      const teachers = await TeacherModel.getAll();
      const courses = await CourseModel.getActive();
      res.render('classes/add', { title: 'Add Class', teachers, courses, error: error.message, formData: req.body });
    }
  },

  getEditClass: async (req, res) => {
    try {
      const classData = await ClassModel.findById(req.params.id);
      if (!classData) return res.status(404).render('404', { title: 'Page Not Found' });

      const teachers = await TeacherModel.getAll();
      const courses = await CourseModel.getAll();
      res.render('classes/edit', { title: 'Edit Class', classData, teachers, courses });
    } catch (error) {
      res.status(500).render('error', { message: error.message });
    }
  },

  postEditClass: async (req, res) => {
    try {
      const { courseId, course } = await resolveSelectedCourse(req.body.course_id);
      const courseFee = Number.parseFloat(req.body.course_fee);
      const fallbackCourseFee = Number.parseFloat(course?.fee_amount);
      const updateData = {
        class_name: req.body.class_name,
        class_code: req.body.class_code,
        section: req.body.section || null,
        academic_year: req.body.academic_year,
        class_teacher_id: req.body.class_teacher_id ? parseInt(req.body.class_teacher_id, 10) : null,
        course_id: courseId,
        capacity: req.body.capacity || 30,
        room_number: req.body.room_number || null,
        course_type: pickAllowed(req.body.course_type || course?.course_type, COURSE_TYPES, 'other'),
        course_fee: Number.isFinite(courseFee) && courseFee >= 0
          ? courseFee
          : (Number.isFinite(fallbackCourseFee) && fallbackCourseFee >= 0 ? fallbackCourseFee : 0),
        fee_payment_plan: pickAllowed(req.body.fee_payment_plan || course?.fee_payment_plan, FEE_PAYMENT_PLANS, 'one_time')
      };
      await ClassModel.update(req.params.id, updateData);
      await logAudit(req, 'CLASS_UPDATED', 'class', req.params.id, updateData);
      res.redirect(`/classes/${req.params.id}?success=Class updated successfully`);
    } catch (error) {
      const classData = await ClassModel.findById(req.params.id);
      const teachers = await TeacherModel.getAll();
      const courses = await CourseModel.getAll();
      res.render('classes/edit', { title: 'Edit Class', classData, teachers, courses, error: error.message });
    }
  },

  postPromoteStudents: async (req, res) => {
    try {
      const fromClassId = parseInt(req.params.id, 10);
      const toClassId = parseInt(req.body.target_class_id, 10);
      const academicYear = String(req.body.academic_year || new Date().getFullYear());

      if (!fromClassId || !toClassId) {
        return res.redirect(`/classes/${req.params.id}?error=Invalid class selection`);
      }
      if (fromClassId === toClassId) {
        return res.redirect(`/classes/${req.params.id}?error=Source and target class cannot be same`);
      }

      const targetClass = await ClassModel.findById(toClassId);
      if (!targetClass) {
        return res.redirect(`/classes/${req.params.id}?error=Target class not found`);
      }

      const sourceClass = await ClassModel.findById(fromClassId);
      const movingStudents = await StudentModel.getAll({ class_id: fromClassId });
      const result = await ClassModel.promoteStudents(fromClassId, toClassId, academicYear);

      if (result.moved > 0 && movingStudents.length > 0) {
        const actorUserId = getActorUserId(req);
        const targetClassName = getClassDisplayName(targetClass);
        const sourceClassName = getClassDisplayName(sourceClass);
        const targetTeacherUserId = Number.isInteger(Number(targetClass.class_teacher_id))
          ? Number(targetClass.class_teacher_id)
          : null;

        for (const student of movingStudents) {
          const studentName = `${student.first_name || ''} ${student.last_name || ''}`.trim() || `Student #${student.student_id}`;

          if (student.user_id) {
            await NotificationModel.createForUserIds({
              title: 'Class Transfer Successful',
              message: `You have been transferred to ${targetClassName}.`,
              notification_type: 'academic',
              sent_by: actorUserId,
              userIds: [student.user_id]
            });
          }

          if (targetTeacherUserId) {
            await NotificationModel.createForUserIds({
              title: 'New Student Transfer',
              message: `${studentName} has been transferred to your class from ${sourceClassName}.`,
              notification_type: 'academic',
              sent_by: actorUserId,
              userIds: [targetTeacherUserId]
            });
          }
        }
      }

      await logAudit(req, 'CLASS_PROMOTION', 'class', fromClassId, {
        target_class_id: toClassId,
        academic_year: academicYear,
        moved: result.moved
      });

      req.session.messages = req.session.messages || [];
      req.session.messages.push({
        type: 'success',
        text: `Transfer successful: ${result.moved} student(s) moved to ${getClassDisplayName(targetClass)}.`
      });
      return req.session.save(() => {
        res.redirect(`/classes/${req.params.id}?success=Promoted ${result.moved} student(s)`);
      });
    } catch (error) {
      res.redirect(`/classes/${req.params.id}?error=${encodeURIComponent(error.message)}`);
    }
  },

  postAddTimetable: async (req, res) => {
    try {
      const classId = parseInt(req.params.id, 10);
      const teacherId = parseInt(req.body.teacher_id, 10);
      const subjectId = parseInt(req.body.subject_id, 10);
      if (!classId || !teacherId || !subjectId) {
        return res.redirect(`/classes/${req.params.id}?error=Invalid timetable data`);
      }

      const conflict = await TimetableModel.checkConflict(
        classId,
        teacherId,
        req.body.day_of_week,
        req.body.start_time,
        req.body.end_time
      );
      if (conflict) {
        return res.redirect(`/classes/${req.params.id}?error=Timetable conflict detected`);
      }

      await TimetableModel.create({
        class_id: classId,
        subject_id: subjectId,
        teacher_id: teacherId,
        day_of_week: req.body.day_of_week,
        start_time: req.body.start_time,
        end_time: req.body.end_time,
        room_number: req.body.room_number || null,
        academic_year: req.body.academic_year || String(new Date().getFullYear())
      });
      await logAudit(req, 'TIMETABLE_CREATED', 'class', classId, {
        subject_id: subjectId,
        teacher_id: teacherId,
        day_of_week: req.body.day_of_week,
        start_time: req.body.start_time,
        end_time: req.body.end_time
      });
      res.redirect(`/classes/${req.params.id}?success=Timetable entry added`);
    } catch (error) {
      res.redirect(`/classes/${req.params.id}?error=${encodeURIComponent(error.message)}`);
    }
  },

  deleteTimetable: async (req, res) => {
    try {
      await TimetableModel.delete(req.params.timetableId);
      await logAudit(req, 'TIMETABLE_DELETED', 'timetable', req.params.timetableId, {
        class_id: req.params.id
      });
      res.redirect(`/classes/${req.params.id}?success=Timetable entry removed`);
    } catch (error) {
      res.redirect(`/classes/${req.params.id}?error=${encodeURIComponent(error.message)}`);
    }
  },

  deleteClass: async (req, res) => {
    try {
      await ClassModel.delete(req.params.id);
      await logAudit(req, 'CLASS_DELETED', 'class', req.params.id, {});
      res.redirect('/classes?success=Class deleted');
    } catch (error) {
      res.status(500).render('error', { message: error.message });
    }
  }
};

module.exports = classController;

