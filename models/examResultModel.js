const { runQuery, getQuery, allQuery } = require('../config/database');

class ExamResultModel {
  static async create(resultData) {
    const { exam_id, student_id, marks_obtained, grade, remarks, checked_by } = resultData;
    const result = await runQuery(
      `INSERT OR REPLACE INTO exam_results (exam_id, student_id, marks_obtained, grade, remarks, checked_by)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [exam_id, student_id, marks_obtained, grade, remarks, checked_by]
    );
    return result.id;
  }

  static async bulkCreate(results) {
    const db = require('../config/database').getDatabase();
    return new Promise((resolve, reject) => {
      if (!Array.isArray(results) || results.length === 0) {
        return resolve({ success: true, count: 0 });
      }

      db.serialize(() => {
        db.run('BEGIN TRANSACTION', (beginErr) => {
          if (beginErr) return reject(beginErr);

          const stmt = db.prepare(
            `INSERT OR REPLACE INTO exam_results (exam_id, student_id, marks_obtained, grade, remarks, checked_by)
             VALUES (?, ?, ?, ?, ?, ?)`
          );

          let pending = results.length;
          let failed = false;

          results.forEach((r) => {
            stmt.run(
              [r.exam_id, r.student_id, r.marks_obtained, r.grade, r.remarks, r.checked_by],
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
                      else resolve({ success: true, count: results.length });
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

  static async findById(resultId) {
    return await getQuery(
      `SELECT er.*, e.exam_name, e.total_marks, e.passing_marks,
        u.first_name || ' ' || u.last_name as student_name,
        c.first_name || ' ' || c.last_name as checked_by_name
       FROM exam_results er
       JOIN exams e ON er.exam_id = e.exam_id
       JOIN students s ON er.student_id = s.student_id
       JOIN users u ON s.user_id = u.user_id
       LEFT JOIN users c ON er.checked_by = c.user_id
       WHERE er.result_id = ?`,
      [resultId]
    );
  }

  static async getByStudent(studentId) {
    return await allQuery(
      `SELECT er.*, e.exam_name, e.exam_type, e.total_marks, e.exam_date,
        s.subject_name, c.class_name
       FROM exam_results er
       JOIN exams e ON er.exam_id = e.exam_id
       JOIN subjects s ON e.subject_id = s.subject_id
       JOIN classes c ON e.class_id = c.class_id
       WHERE er.student_id = ?
       ORDER BY e.exam_date DESC`,
      [studentId]
    );
  }

  static async getByExam(examId) {
    return await allQuery(
      `SELECT er.*, u.first_name || ' ' || u.last_name as student_name,
        s.admission_number
       FROM exam_results er
       JOIN students s ON er.student_id = s.student_id
       JOIN users u ON s.user_id = u.user_id
       WHERE er.exam_id = ?
       ORDER BY er.marks_obtained DESC`,
      [examId]
    );
  }

  static async getStudentRank(examId, studentId) {
    const result = await getQuery(
      `SELECT COUNT(*) + 1 as rank
       FROM exam_results
       WHERE exam_id = ? AND marks_obtained > (
         SELECT marks_obtained FROM exam_results WHERE exam_id = ? AND student_id = ?
       )`,
      [examId, examId, studentId]
    );
    return result?.rank || 1;
  }

  static async update(resultId, updateData) {
    const fields = Object.keys(updateData).map(key => `${key} = ?`).join(', ');
    const values = [...Object.values(updateData), resultId];
    const result = await runQuery(
      `UPDATE exam_results SET ${fields} WHERE result_id = ?`,
      values
    );
    return result.changes > 0;
  }

  static async delete(resultId) {
    const result = await runQuery('DELETE FROM exam_results WHERE result_id = ?', [resultId]);
    return result.changes > 0;
  }
}

module.exports = ExamResultModel;
