const StudentModel = require('../models/studentModel');
const UserModel = require('../models/userModel');
const ClassModel = require('../models/classModel');
const NotificationModel = require('../models/notificationModel');
const { logAudit } = require('../utils/auditLogger');

const NONE_VALUES = new Set(['none', 'nashi', 'なし', 'ãªã—', 'n/a', 'na', 'null', '-']);

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

function getActorUserId(req) {
  const raw = req?.session?.user?.user_id ?? req?.session?.user?.id;
  const parsed = Number.parseInt(raw, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function getClassDisplayName(classData) {
  return `${classData?.class_name || ''} ${classData?.section || ''}`.trim() || 'the selected class';
}

async function resolveClassId(classInput) {
  const classId = toNullableId(classInput);
  if (classId !== null) {
    const classExists = await ClassModel.findById(classId);
    if (!classExists) throw new Error('Selected class does not exist');
    return classId;
  }

  const classText = toNullableText(classInput);
  if (!classText) return null;

  const classes = await ClassModel.getAll();
  const normalized = classText.toLowerCase();
  const existing = classes.find((c) => {
    const byName = String(c.class_name || '').toLowerCase() === normalized;
    const byFull = `${c.class_name || ''} ${c.section || ''}`.trim().toLowerCase() === normalized;
    return byName || byFull;
  });

  if (existing) return existing.class_id;

  const codePrefix = classText.replace(/[^a-z0-9]/gi, '').toUpperCase().slice(0, 5) || 'CLASS';
  const classCode = `${codePrefix}${Date.now().toString().slice(-5)}`;
  const year = String(new Date().getFullYear());

  return await ClassModel.create({
    class_name: classText,
    class_code: classCode,
    section: 'A',
    academic_year: year,
    class_teacher_id: null,
    capacity: 30,
    room_number: null
  });
}

const studentController = {
  getAllStudents: async (req, res) => {
    try {
      const { class: classFilter, search } = req.query;
      const students = await StudentModel.getAll({ 
        class_id: classFilter, 
        search 
      });
      const classes = await ClassModel.getAll();
      
      res.render('students/index', {
        title: 'Students',
        students,
        classes,
        filters: { classFilter, search }
      });
    } catch (error) {
      res.status(500).render('error', { message: error.message });
    }
  },

  getStudentDetail: async (req, res) => {
    try {
      const student = await StudentModel.findById(req.params.id);
      if (!student) {
        // Pass title even in 404
        return res.status(404).render('404', { title: 'Page Not Found' });
      }
      
      const attendance = await StudentModel.getAttendanceStats(
        req.params.id, 
        new Date().getMonth() + 1, 
        new Date().getFullYear()
      );
      
      const fees = await StudentModel.getFeeBalance(req.params.id);
      
      // ? MAKE SURE title IS PASSED HERE
      res.render('students/detail', {
        title: `${student.first_name} ${student.last_name}`,  // <-- This line must exist
        student,
        attendance,
        fees
      });
    } catch (error) {
      // Pass title in error render too
      res.status(500).render('error', { 
        title: 'Error',  // <-- Add this
        message: error.message 
      });
    }
  },

  getAddStudent: async (req, res) => {
    const classes = await ClassModel.getAll();
    res.render('students/add', { title: 'Add Student', classes });
  },

  postAddStudent: async (req, res) => {
    try {
      const classIdInput = pickInputValue(req.body.class_id_text, req.body.class_id);
      const classId = await resolveClassId(classIdInput);

      const parentId = toNullableId(req.body.parent_id);
      if (parentId !== null) {
        const parentExists = await UserModel.findById(parentId);
        if (!parentExists) {
          throw new Error('Selected parent does not exist');
        }
      }

      const admissionNumber = toNullableText(req.body.admission_number);
      if (!admissionNumber) throw new Error('Admission number is required');

      const firstName = toNullableText(req.body.first_name) || 'なし';
      const lastName = toNullableText(req.body.last_name) || 'なし';
      const email = toNullableText(req.body.email) || `${admissionNumber.toLowerCase()}@school.local`;
      const dateOfBirth = toNullableText(req.body.date_of_birth);
      const admissionDate = toNullableText(req.body.admission_date);
      if (!admissionDate) throw new Error('Admission date is required');

      // Create user first
      const userData = {
        username: admissionNumber,
        password: dateOfBirth || admissionNumber, // Default password
        email,
        first_name: firstName,
        last_name: lastName,
        phone: toNullableText(req.body.phone),
        address: toNullableText(req.body.address),
        date_of_birth: dateOfBirth,
        gender: toNullableText(req.body.gender),
        user_type: 'student'
      };
      
      const userId = await UserModel.create(userData);
      
      // Create student record
      const studentData = {
        user_id: userId,
        admission_number: admissionNumber,
        admission_date: admissionDate,
        current_class_id: classId,
        roll_number: toNullableText(req.body.roll_number),
        parent_id: parentId,
        emergency_contact_name: toNullableText(req.body.emergency_contact_name),
        emergency_contact_phone: toNullableText(req.body.emergency_contact_phone),
        medical_conditions: toNullableText(req.body.medical_conditions)
      };
      
      await StudentModel.create(studentData);
      await logAudit(req, 'STUDENT_CREATED', 'student', admissionNumber, {
        admission_number: admissionNumber,
        class_id: classId
      });
      
      res.redirect('/students?success=Student added successfully');
    } catch (error) {
      const classes = await ClassModel.getAll();
      res.render('students/add', { 
        title: 'Add Student', 
        classes,
        error: error.message,
        formData: req.body 
      });
    }
  },

  getEditStudent: async (req, res) => {
    try {
      const student = await StudentModel.findById(req.params.id);
      if (!student) return res.status(404).render('404', { title: 'Page Not Found' });
      const classes = await ClassModel.getAll();
      res.render('students/edit', { title: 'Edit Student', student, classes });
    } catch (error) {
      res.status(500).render('error', { message: error.message });
    }
  },

  postEditStudent: async (req, res) => {
    try {
      const existingStudent = await StudentModel.findById(req.params.id);
      if (!existingStudent) {
        return res.status(404).render('404', { title: 'Page Not Found' });
      }

      const classIdInput = pickInputValue(req.body.class_id_text, req.body.current_class_id);
      const classId = await resolveClassId(classIdInput);

      const parentId = toNullableId(req.body.parent_id);
      if (parentId !== null) {
        const parentExists = await UserModel.findById(parentId);
        if (!parentExists) {
          throw new Error('Selected parent does not exist');
        }
      }

      const updateData = {
        current_class_id: classId,
        roll_number: toNullableText(req.body.roll_number),
        parent_id: parentId,
        emergency_contact_name: toNullableText(req.body.emergency_contact_name),
        emergency_contact_phone: toNullableText(req.body.emergency_contact_phone),
        medical_conditions: toNullableText(req.body.medical_conditions)
      };

      await StudentModel.update(req.params.id, updateData);
      await logAudit(req, 'STUDENT_UPDATED', 'student', req.params.id, updateData);

      const previousClassId = Number(existingStudent.current_class_id) || null;
      const currentClassId = Number(classId) || null;
      if (previousClassId && currentClassId && previousClassId !== currentClassId) {
        const targetClass = await ClassModel.findById(currentClassId);
        if (targetClass) {
          const actorUserId = getActorUserId(req);
          const studentName = `${existingStudent.first_name || ''} ${existingStudent.last_name || ''}`.trim() || `Student #${existingStudent.student_id}`;
          const targetClassName = getClassDisplayName(targetClass);
          const targetTeacherUserId = Number.isInteger(Number(targetClass.class_teacher_id))
            ? Number(targetClass.class_teacher_id)
            : null;

          if (existingStudent.user_id) {
            await NotificationModel.createForUserIds({
              title: 'Class Transfer Successful',
              message: `You have been transferred to ${targetClassName}.`,
              notification_type: 'academic',
              sent_by: actorUserId,
              userIds: [existingStudent.user_id]
            });
          }

          if (targetTeacherUserId) {
            await NotificationModel.createForUserIds({
              title: 'New Student Transfer',
              message: `${studentName} has been transferred to your class.`,
              notification_type: 'academic',
              sent_by: actorUserId,
              userIds: [targetTeacherUserId]
            });
          }

          req.session.messages = req.session.messages || [];
          req.session.messages.push({
            type: 'success',
            text: `Transfer successful: ${studentName} moved to ${targetClassName}.`
          });
        }
      }

      return req.session.save(() => {
        res.redirect(`/students/${req.params.id}?success=Updated successfully`);
      });
    } catch (error) {
      try {
        const student = await StudentModel.findById(req.params.id);
        const classes = await ClassModel.getAll();
        if (!student) return res.status(404).render('404', { title: 'Page Not Found' });
        return res.status(400).render('students/edit', {
          title: 'Edit Student',
          student,
          classes,
          error: error.message
        });
      } catch (renderError) {
        return res.status(500).render('error', { message: renderError.message });
      }
    }
  },

  deleteStudent: async (req, res) => {
    try {
      const student = await StudentModel.findById(req.params.id);
      if (!student) {
        return res.status(404).render('404', { title: 'Page Not Found' });
      }

      await UserModel.delete(student.user_id);
      await logAudit(req, 'STUDENT_DELETED', 'student', req.params.id, {
        user_id: student.user_id
      });
      res.redirect('/students?success=Student deleted');
    } catch (error) {
      res.status(500).render('error', { message: error.message });
    }
  }
};

module.exports = studentController;
