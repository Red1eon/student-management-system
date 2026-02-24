const { runQuery, getQuery, allQuery } = require('../config/database');

class TimetableModel {
  static async create(entryData) {
    const {
      class_id, subject_id, teacher_id, day_of_week,
      start_time, end_time, room_number, academic_year
    } = entryData;
    
    const result = await runQuery(
      `INSERT INTO timetable (class_id, subject_id, teacher_id, day_of_week, start_time, end_time, room_number, academic_year)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [class_id, subject_id, teacher_id, day_of_week, start_time, end_time, room_number, academic_year]
    );
    return result.id;
  }

  static async findById(timetableId) {
    return await getQuery(
      `SELECT t.*, c.class_name, c.section, s.subject_name, s.subject_code,
        u.first_name || ' ' || u.last_name as teacher_name
       FROM timetable t
       JOIN classes c ON t.class_id = c.class_id
       JOIN subjects s ON t.subject_id = s.subject_id
       JOIN teachers te ON t.teacher_id = te.teacher_id
       JOIN users u ON te.user_id = u.user_id
       WHERE t.timetable_id = ?`,
      [timetableId]
    );
  }

  static async getByClass(classId, academicYear = null) {
    // ? FIX: Make academicYear optional
    const year = academicYear || new Date().getFullYear().toString();
    
    return await allQuery(
      `SELECT t.*, s.subject_name, s.subject_code,
        u.first_name || ' ' || u.last_name as teacher_name
       FROM timetable t
       JOIN subjects s ON t.subject_id = s.subject_id
       JOIN teachers te ON t.teacher_id = te.teacher_id
       JOIN users u ON te.user_id = u.user_id
       WHERE t.class_id = ? AND t.academic_year = ? AND t.is_active = 1
       ORDER BY 
         CASE t.day_of_week
           WHEN 'Monday' THEN 1
           WHEN 'Tuesday' THEN 2
           WHEN 'Wednesday' THEN 3
           WHEN 'Thursday' THEN 4
           WHEN 'Friday' THEN 5
           WHEN 'Saturday' THEN 6
         END, t.start_time`,
      [classId, year]
    );
  }

  // ? FIX: Make academicYear optional with default
  static async getByTeacher(teacherId, academicYear = null) {
    const year = academicYear || new Date().getFullYear().toString();
    
    return await allQuery(
      `SELECT t.*, c.class_name, c.section, s.subject_name
       FROM timetable t
       JOIN classes c ON t.class_id = c.class_id
       JOIN subjects s ON t.subject_id = s.subject_id
       WHERE t.teacher_id = ? AND t.academic_year = ? AND t.is_active = 1
       ORDER BY 
         CASE t.day_of_week
           WHEN 'Monday' THEN 1
           WHEN 'Tuesday' THEN 2
           WHEN 'Wednesday' THEN 3
           WHEN 'Thursday' THEN 4
           WHEN 'Friday' THEN 5
           WHEN 'Saturday' THEN 6
         END, t.start_time`,
      [teacherId, year]
    );
  }

  static async checkConflict(classId, teacherId, dayOfWeek, startTime, endTime, excludeId = null) {
    let sql = `
      SELECT * FROM timetable 
      WHERE day_of_week = ? AND is_active = 1
      AND ((class_id = ? OR teacher_id = ?))
      AND ((start_time <= ? AND end_time > ?) OR (start_time < ? AND end_time >= ?))
    `;
    const params = [dayOfWeek, classId, teacherId, startTime, startTime, endTime, endTime];
    
    if (excludeId) {
      sql += ' AND timetable_id != ?';
      params.push(excludeId);
    }
    
    return await getQuery(sql, params);
  }

  static async update(timetableId, updateData) {
    const fields = Object.keys(updateData).map(key => `${key} = ?`).join(', ');
    const values = [...Object.values(updateData), timetableId];
    const result = await runQuery(
      `UPDATE timetable SET ${fields} WHERE timetable_id = ?`,
      values
    );
    return result.changes > 0;
  }

  static async delete(timetableId) {
    const result = await runQuery('UPDATE timetable SET is_active = 0 WHERE timetable_id = ?', [timetableId]);
    return result.changes > 0;
  }

  static async getCurrentSession(classId) {
    const now = new Date();
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const currentDay = days[now.getDay()];
    const currentTime = now.toTimeString().slice(0, 5);
    
    return await getQuery(
      `SELECT t.*, s.subject_name, u.first_name || ' ' || u.last_name as teacher_name
       FROM timetable t
       JOIN subjects s ON t.subject_id = s.subject_id
       JOIN teachers te ON t.teacher_id = te.teacher_id
       JOIN users u ON te.user_id = u.user_id
       WHERE t.class_id = ? AND t.day_of_week = ? 
       AND t.start_time <= ? AND t.end_time > ?
       AND t.is_active = 1`,
      [classId, currentDay, currentTime, currentTime]
    );
  }
}

module.exports = TimetableModel;