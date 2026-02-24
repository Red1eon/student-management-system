const { runQuery, getQuery, allQuery } = require('../config/database');

class EventModel {
  static async create(eventData) {
    const {
      event_name, event_type, description, start_date,
      end_date, location, organizer_id, is_mandatory
    } = eventData;
    
    const result = await runQuery(
      `INSERT INTO events (event_name, event_type, description, start_date, end_date, location, organizer_id, is_mandatory)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [event_name, event_type, description, start_date, end_date, location, organizer_id, is_mandatory]
    );
    return result.id;
  }

  static async findById(eventId) {
    return await getQuery(
      `SELECT e.*, u.first_name || ' ' || u.last_name as organizer_name
       FROM events e
       LEFT JOIN users u ON e.organizer_id = u.user_id
       WHERE e.event_id = ?`,
      [eventId]
    );
  }

  static async getAll(filters = {}) {
    let sql = `
      SELECT e.*, u.first_name || ' ' || u.last_name as organizer_name
      FROM events e
      LEFT JOIN users u ON e.organizer_id = u.user_id
      WHERE 1=1
    `;
    const params = [];
    
    if (filters.event_type) {
      sql += ' AND e.event_type = ?';
      params.push(filters.event_type);
    }
    if (filters.upcoming) {
      sql += ' AND e.start_date >= date(\'now\')';
    }
    if (filters.ongoing) {
      sql += ' AND e.start_date <= date(\'now\') AND e.end_date >= date(\'now\')';
    }
    
    sql += ' ORDER BY e.start_date DESC';
    return await allQuery(sql, params);
  }

  static async getUpcoming(limit = 5) {
    return await allQuery(
      `SELECT e.*, u.first_name || ' ' || u.last_name as organizer_name
       FROM events e
       LEFT JOIN users u ON e.organizer_id = u.user_id
       WHERE e.start_date >= date('now')
       ORDER BY e.start_date ASC
       LIMIT ?`,
      [limit]
    );
  }

  static async update(eventId, updateData) {
    const fields = Object.keys(updateData).map(key => `${key} = ?`).join(', ');
    const values = [...Object.values(updateData), eventId];
    const result = await runQuery(
      `UPDATE events SET ${fields} WHERE event_id = ?`,
      values
    );
    return result.changes > 0;
  }

  static async delete(eventId) {
    const result = await runQuery('DELETE FROM events WHERE event_id = ?', [eventId]);
    return result.changes > 0;
  }

  static async getByDateRange(startDate, endDate) {
    return await allQuery(
      `SELECT * FROM events 
       WHERE (start_date BETWEEN ? AND ?) OR (end_date BETWEEN ? AND ?)
       ORDER BY start_date`,
      [startDate, endDate, startDate, endDate]
    );
  }

  static async getCalendarData(month, year) {
    return await allQuery(
      `SELECT event_id, event_name, event_type, start_date, end_date
       FROM events 
       WHERE strftime('%m', start_date) = ? AND strftime('%Y', start_date) = ?
       ORDER BY start_date`,
      [month, year]
    );
  }
}

module.exports = EventModel;