const { runQuery, getQuery, allQuery } = require('../config/database');

class AttendanceModel {
  static async create(attendanceData) {
    const { student_id, class_id, date, status, remarks, marked_by } = attendanceData;
    const result = await runQuery(
      `INSERT OR REPLACE INTO attendance (student_id, class_id, date, status, remarks, marked_by)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [student_id, class_id, date, status, remarks, marked_by]
    );
    return result.id;
  }

  static async bulkCreate(attendanceRecords) {
    const db = require('../config/database').getDatabase();
    return new Promise((resolve, reject) => {
      if (!Array.isArray(attendanceRecords) || attendanceRecords.length === 0) {
        return resolve({ success: true, count: 0 });
      }

      db.serialize(() => {
        db.run('BEGIN TRANSACTION', (beginErr) => {
          if (beginErr) return reject(beginErr);

          const stmt = db.prepare(
            `INSERT OR REPLACE INTO attendance (student_id, class_id, date, status, remarks, marked_by)
             VALUES (?, ?, ?, ?, ?, ?)`
          );

          let pending = attendanceRecords.length;
          let failed = false;

          attendanceRecords.forEach((record) => {
            stmt.run(
              [
                record.student_id, record.class_id, record.date,
                record.status, record.remarks, record.marked_by
              ],
              (runErr) => {
                if (failed) return;
                if (runErr) {
                  failed = true;
                  return stmt.finalize(() => {
                    db.run('ROLLBACK', () => reject(runErr));
                  });
                }

                pending -= 1;
                if (pending === 0) {
                  stmt.finalize((finalizeErr) => {
                    if (finalizeErr) {
                      return db.run('ROLLBACK', () => reject(finalizeErr));
                    }
                    db.run('COMMIT', (commitErr) => {
                      if (commitErr) reject(commitErr);
                      else resolve({ success: true, count: attendanceRecords.length });
                    });
                  });
                }
              }
            );
          });
        });
      });
    });
  }

  static async findById(attendanceId) {
    return await getQuery(
      `SELECT a.*, u.first_name || ' ' || u.last_name as student_name,
        c.class_name, c.section, m.first_name || ' ' || m.last_name as marked_by_name
       FROM attendance a
       JOIN students s ON a.student_id = s.student_id
       JOIN users u ON s.user_id = u.user_id
       JOIN classes c ON a.class_id = c.class_id
       LEFT JOIN users m ON a.marked_by = m.user_id
       WHERE a.attendance_id = ?`,
      [attendanceId]
    );
  }

  static async getByStudent(studentId, month, year) {
    return await allQuery(
      `SELECT * FROM attendance 
       WHERE student_id = ? AND strftime('%m', date) = ? AND strftime('%Y', date) = ?
       ORDER BY date DESC`,
      [studentId, month, year]
    );
  }

  // Updated: Simplified query to return first_name and last_name separately
  static async getByClass(classId, date) {
    return await allQuery(
      `SELECT a.*, u.first_name, u.last_name
       FROM attendance a
       JOIN students s ON a.student_id = s.student_id
       JOIN users u ON s.user_id = u.user_id
       WHERE a.class_id = ? AND a.date = ?
       ORDER BY u.last_name, u.first_name`,
      [classId, date]
    );
  }

  // New: Get attendance records marked by a specific teacher
  static async getByTeacher(teacherUserId, limit = 10) {
    return await allQuery(
      `SELECT a.*, c.class_name, u.first_name || ' ' || u.last_name as student_name
       FROM attendance a
       JOIN classes c ON a.class_id = c.class_id
       JOIN students s ON a.student_id = s.student_id
       JOIN users u ON s.user_id = u.user_id
       WHERE a.marked_by = ?
       ORDER BY a.created_at DESC
       LIMIT ?`,
      [teacherUserId, limit]
    );
  }

  static async getDailyStats(classId, date) {
    return await allQuery(
      `SELECT status, COUNT(*) as count 
       FROM attendance 
       WHERE class_id = ? AND date = ?
       GROUP BY status`,
      [classId, date]
    );
  }

  // Updated: Added proper formatting for month and year parameters
  static async getMonthlyStats(studentId, month, year) {
    return await allQuery(
      `SELECT status, COUNT(*) as count 
       FROM attendance 
       WHERE student_id = ? AND strftime('%m', date) = ? AND strftime('%Y', date) = ?
       GROUP BY status`,
      [studentId, month.padStart(2, '0'), year.toString()]
    );
  }

  static async update(attendanceId, updateData) {
    const fields = Object.keys(updateData).map(key => `${key} = ?`).join(', ');
    const values = [...Object.values(updateData), attendanceId];
    const result = await runQuery(
      `UPDATE attendance SET ${fields} WHERE attendance_id = ?`,
      values
    );
    return result.changes > 0;
  }

  static async delete(attendanceId) {
    const result = await runQuery('DELETE FROM attendance WHERE attendance_id = ?', [attendanceId]);
    return result.changes > 0;
  }

  static async checkExisting(studentId, classId, date) {
    return await getQuery(
      'SELECT * FROM attendance WHERE student_id = ? AND class_id = ? AND date = ?',
      [studentId, classId, date]
    );
  }
}

module.exports = AttendanceModel;
