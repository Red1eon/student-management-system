const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const dbPath = path.join(process.cwd(), 'test_promotion.db');
if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
process.env.DB_PATH = dbPath;

const { initializeDatabase, runQuery, getQuery } = require('../config/database');
const ClassModel = require('../models/classModel');

test('promoteStudents moves students to target class', async () => {
  initializeDatabase();
  await new Promise((r) => setTimeout(r, 250));

  const fromClass = await ClassModel.create({
    class_name: 'Grade 8',
    class_code: 'G8A',
    section: 'A',
    academic_year: '2026',
    class_teacher_id: null,
    capacity: 30,
    room_number: '101'
  });
  const toClass = await ClassModel.create({
    class_name: 'Grade 9',
    class_code: 'G9A',
    section: 'A',
    academic_year: '2026',
    class_teacher_id: null,
    capacity: 30,
    room_number: '102'
  });

  const u1 = await runQuery(
    `INSERT INTO users (username, password_hash, email, first_name, last_name, user_type, is_active)
     VALUES (?, ?, ?, ?, ?, 'student', 1)`,
    ['stuA', 'hash', 'stua@example.com', 'Stu', 'A']
  );
  const u2 = await runQuery(
    `INSERT INTO users (username, password_hash, email, first_name, last_name, user_type, is_active)
     VALUES (?, ?, ?, ?, ?, 'student', 1)`,
    ['stuB', 'hash', 'stub@example.com', 'Stu', 'B']
  );

  await runQuery(
    `INSERT INTO students (user_id, admission_number, admission_date, current_class_id, roll_number)
     VALUES (?, ?, date('now'), ?, ?)`,
    [u1.id, 'ADM9001', fromClass, '01']
  );
  await runQuery(
    `INSERT INTO students (user_id, admission_number, admission_date, current_class_id, roll_number)
     VALUES (?, ?, date('now'), ?, ?)`,
    [u2.id, 'ADM9002', fromClass, '02']
  );

  const result = await ClassModel.promoteStudents(fromClass, toClass, '2026');
  assert.equal(result.moved, 2);

  const count = await getQuery('SELECT COUNT(*) as count FROM students WHERE current_class_id = ?', [toClass]);
  assert.equal(count.count, 2);
});
