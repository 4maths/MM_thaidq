const { query } = require('../db');

/**
 * Audit trail (ISO 9001:2015 — kiểm soát tài liệu, traceability).
 * Ghi một dòng vào audit_logs — bảng append-only, không UPDATE/DELETE.
 */
async function logAudit({ userId, action, entityType, entityId, oldValues, newValues, ip }) {
  try {
    await query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, old_values, new_values, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [userId || null, action, entityType, entityId || null,
        oldValues ? JSON.stringify(oldValues) : null,
        newValues ? JSON.stringify(newValues) : null,
        ip || null]
    );
  } catch (err) {
    // Không để audit log làm hỏng nghiệp vụ, nhưng phải bám vết lỗi
    console.error('[audit] ghi nhật ký thất bại:', err.message);
  }
}

/** Middleware: gắn helper req.audit() để route gọi nhanh sau khi thay đổi dữ liệu. */
function attachAudit(req, res, next) {
  req.audit = ({ action, entityType, entityId, oldValues, newValues }) =>
    logAudit({ userId: req.user?.id, action, entityType, entityId, oldValues, newValues, ip: req.ip });
  next();
}

module.exports = { logAudit, attachAudit };
