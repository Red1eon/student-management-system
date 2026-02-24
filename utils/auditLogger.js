const AuditLogModel = require('../models/auditLogModel');

async function logAudit(req, action, entityType, entityId, details = {}) {
  try {
    await AuditLogModel.create({
      user_id: req.session?.user?.id || null,
      action,
      entity_type: entityType,
      entity_id: entityId ? String(entityId) : null,
      details,
      ip_address: req.ip
    });
  } catch (error) {
    console.error('Audit log error:', error.message);
  }
}

module.exports = { logAudit };
