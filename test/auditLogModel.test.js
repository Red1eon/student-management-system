const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const dbPath = path.join(process.cwd(), 'test_audit.db');
if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
process.env.DB_PATH = dbPath;

const { initializeDatabase } = require('../config/database');
const AuditLogModel = require('../models/auditLogModel');

test('audit log can be inserted and listed', async () => {
  initializeDatabase();
  await new Promise((r) => setTimeout(r, 200));

  const logId = await AuditLogModel.create({
    user_id: null,
    action: 'TEST_ACTION',
    entity_type: 'test_entity',
    entity_id: '123',
    details: { ok: true },
    ip_address: '127.0.0.1'
  });

  assert.ok(logId > 0);

  const rows = await AuditLogModel.getRecent(10);
  assert.ok(Array.isArray(rows));
  assert.ok(rows.some((r) => r.action === 'TEST_ACTION' && r.entity_id === '123'));
});
