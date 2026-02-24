const { runQuery, getQuery, allQuery } = require('../config/database');

class ClassModel {
  static async create(classData) {
    const {
      class_name, class_code, section, academic_year,
      class_teacher_id, capacity, room_number
    } = classData;
    
    const result = await runQuery(
      `INSERT INTO classes (class_name, class_code, section, academic_year, class_teacher_id, capacity, room_number)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [class_name, class_code, section, academic_year, class_teacher_id, capacity || 30, room_number]
    );
    return result.id;
  }

  static async findById(classId) {
    return await getQuery(
      `SELECT c.*, u.first_name || ' ' || u.last_name as teacher_name
       FROM classes c
       LEFT JOIN users u ON c.class_teacher_id = u.user_id
       WHERE c.class_id = ?`,
      [classId]
    );
  }

  static async findByCode(classCode) {
    return await getQuery('SELECT * FROM classes WHERE class_code = ?', [classCode]);
  }

  // ? THIS WAS MISSING - ADD IT
  static async getAll() {
    return await allQuery(
      `SELECT c.*, u.first_name || ' ' || u.last_name as teacher_name
       FROM classes c
       LEFT JOIN users u ON c.class_teacher_id = u.user_id
       ORDER BY c.class_name, c.section`
    );
  }

  static async getByTeacher(teacherId) {
    return await allQuery(
      `SELECT * FROM classes WHERE class_teacher_id = ?`,
      [teacherId]
    );
  }

  static async update(classId, updateData) {
    const fields = Object.keys(updateData).map(key => `${key} = ?`).join(', ');
    const values = [...Object.values(updateData), classId];
    const result = await runQuery(
      `UPDATE classes SET ${fields} WHERE class_id = ?`,
      values
    );
    return result.changes > 0;
  }

  static async delete(classId) {
    const result = await runQuery('DELETE FROM classes WHERE class_id = ?', [classId]);
    return result.changes > 0;
  }

  static async promoteStudents(fromClassId, toClassId, academicYear) {
    const students = await allQuery(
      `SELECT student_id FROM students WHERE current_class_id = ?`,
      [fromClassId]
    );

    if (!students.length) {
      return { moved: 0 };
    }

    const db = require('../config/database').getDatabase();
    const enrollmentDate = new Date().toISOString().split('T')[0];

    return new Promise((resolve, reject) => {
      db.serialize(() => {
        db.run('BEGIN TRANSACTION', (beginErr) => {
          if (beginErr) return reject(beginErr);

          const updateStmt = db.prepare(
            'UPDATE students SET current_class_id = ? WHERE student_id = ?'
          );
          const enrollStmt = db.prepare(
            `INSERT OR IGNORE INTO student_enrollment (student_id, class_id, academic_year, enrollment_date, status)
             VALUES (?, ?, ?, ?, 'active')`
          );

          let pending = students.length;
          let failed = false;

          students.forEach((s) => {
            if (failed) return;
            updateStmt.run([toClassId, s.student_id], (updateErr) => {
              if (failed) return;
              if (updateErr) {
                failed = true;
                return finalizeWithRollback(updateErr);
              }

              enrollStmt.run([s.student_id, toClassId, academicYear, enrollmentDate], (enrollErr) => {
                if (failed) return;
                if (enrollErr) {
                  failed = true;
                  return finalizeWithRollback(enrollErr);
                }

                pending -= 1;
                if (pending === 0) {
                  updateStmt.finalize((uErr) => {
                    if (uErr) return db.run('ROLLBACK', () => reject(uErr));
                    enrollStmt.finalize((eErr) => {
                      if (eErr) return db.run('ROLLBACK', () => reject(eErr));
                      db.run('COMMIT', (commitErr) => {
                        if (commitErr) reject(commitErr);
                        else resolve({ moved: students.length });
                      });
                    });
                  });
                }
              });
            });
          });

          function finalizeWithRollback(error) {
            updateStmt.finalize(() => {
              enrollStmt.finalize(() => {
                db.run('ROLLBACK', () => reject(error));
              });
            });
          }
        });
      });
    });
  }

  static async getStudents(classId) {
    return await allQuery(
      `SELECT s.*, u.first_name, u.last_name, u.email
       FROM students s
       JOIN users u ON s.user_id = u.user_id
       WHERE s.current_class_id = ? AND u.is_active = 1`,
      [classId]
    );
  }

  static async countStudents(classId) {
    const result = await getQuery(
      `SELECT COUNT(*) as count FROM students WHERE current_class_id = ?`,
      [classId]
    );
    return result?.count || 0;
  }
}

module.exports = ClassModel;
