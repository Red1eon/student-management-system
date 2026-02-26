const { runQuery, allQuery, getQuery } = require('../config/database');

class AttendancePeriodModel {
  static async ensureDefaultPeriods(classId) {
    const id = parseInt(classId, 10);
    if (!id) return;
    const defaults = ['P1', 'P2', 'P3', 'P4'];
    for (let i = 0; i < defaults.length; i += 1) {
      await runQuery(
        `INSERT OR IGNORE INTO attendance_periods (class_id, period_label, sort_order, is_active)
         VALUES (?, ?, ?, 1)`,
        [id, defaults[i], i + 1]
      );
    }
  }

  static async getActivePeriodsForClass(classId) {
    const id = parseInt(classId, 10);
    if (!id) return ['P1', 'P2', 'P3', 'P4'];
    await this.ensureDefaultPeriods(id);
    const rows = await allQuery(
      `SELECT period_label
       FROM attendance_periods
       WHERE class_id = ? AND is_active = 1
       ORDER BY sort_order ASC, period_label ASC`,
      [id]
    );
    return rows.map((r) => r.period_label);
  }

  static async addPeriod(classId, periodLabel) {
    const id = parseInt(classId, 10);
    if (!id) throw new Error('Invalid class');
    const label = String(periodLabel || '').trim().toUpperCase();
    if (!label) throw new Error('Invalid period label');
    await this.ensureDefaultPeriods(id);
    const maxOrder = await getQuery(
      `SELECT COALESCE(MAX(sort_order), 0) AS max_order
       FROM attendance_periods
       WHERE class_id = ?`,
      [id]
    );
    await runQuery(
      `INSERT OR REPLACE INTO attendance_periods (class_id, period_label, sort_order, is_active)
       VALUES (?, ?, ?, 1)`,
      [id, label, Number(maxOrder?.max_order || 0) + 1]
    );
  }

  static async deletePeriod(classId, periodLabel) {
    const id = parseInt(classId, 10);
    const label = String(periodLabel || '').trim().toUpperCase();
    if (!id || !label) throw new Error('Invalid period');
    await this.ensureDefaultPeriods(id);

    const activeCount = await getQuery(
      `SELECT COUNT(*) AS count
       FROM attendance_periods
       WHERE class_id = ? AND is_active = 1`,
      [id]
    );
    if (Number(activeCount?.count || 0) <= 1) {
      throw new Error('At least one active period is required');
    }

    await runQuery(
      `UPDATE attendance_periods
       SET is_active = 0
       WHERE class_id = ? AND period_label = ?`,
      [id, label]
    );
  }

  static async bulkCreate(records) {
    const db = require('../config/database').getDatabase();
    return new Promise((resolve, reject) => {
      if (!Array.isArray(records) || records.length === 0) return resolve({ success: true, count: 0 });

      db.serialize(() => {
        db.run('BEGIN TRANSACTION', (beginErr) => {
          if (beginErr) return reject(beginErr);

          const stmt = db.prepare(
            `INSERT OR REPLACE INTO attendance_period_records
             (student_id, class_id, subject_id, date, period_label, status, remarks, marked_by)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
          );

          let pending = records.length;
          let failed = false;
          records.forEach((r) => {
            stmt.run(
              [r.student_id, r.class_id, r.subject_id || null, r.date, r.period_label, r.status, r.remarks || '', r.marked_by],
              (runErr) => {
                if (failed) return;
                if (runErr) {
                  failed = true;
                  return stmt.finalize(() => db.run('ROLLBACK', () => reject(runErr)));
                }
                pending -= 1;
                if (pending === 0) {
                  stmt.finalize((finalizeErr) => {
                    if (finalizeErr) return db.run('ROLLBACK', () => reject(finalizeErr));
                    db.run('COMMIT', (commitErr) => {
                      if (commitErr) reject(commitErr);
                      else resolve({ success: true, count: records.length });
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

  static async getByClassDatePeriod(classId, date, periodLabel) {
    return await allQuery(
      `SELECT apr.*, u.first_name, u.last_name
       FROM attendance_period_records apr
       JOIN students s ON apr.student_id = s.student_id
       JOIN users u ON s.user_id = u.user_id
       WHERE apr.class_id = ? AND apr.date = ? AND apr.period_label = ?
       ORDER BY u.last_name, u.first_name`,
      [classId, date, periodLabel]
    );
  }

  static async getByClassDate(classId, date) {
    return await allQuery(
      `SELECT apr.*, u.first_name, u.last_name
       FROM attendance_period_records apr
       JOIN students s ON apr.student_id = s.student_id
       JOIN users u ON s.user_id = u.user_id
       WHERE apr.class_id = ? AND apr.date = ?
       ORDER BY apr.period_label, u.last_name, u.first_name`,
      [classId, date]
    );
  }
}

module.exports = AttendancePeriodModel;
