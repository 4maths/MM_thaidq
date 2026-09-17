const { pool, one } = require('../db');

/** Sinh mã đối tượng theo năm: SC-2026-001, BBNT-2026-001, PA-2026-001 */
async function nextCode(prefix, table, column = 'code') {
  const year = new Date().getFullYear();
  const like = `${prefix}-${year}-%`;
  const row = await one(
    `SELECT ${column} AS last_code FROM ${table} WHERE ${column} LIKE $1 ORDER BY id DESC LIMIT 1`,
    [like]
  );
  const lastSeq = row ? parseInt(row.last_code.split('-').pop(), 10) : 0;
  const seq = String(lastSeq + 1).padStart(3, '0');
  return `${prefix}-${year}-${seq}`;
}

/** Gửi thông báo trong hệ thống cho một người dùng */
async function notify(userId, { title, body, type, link }) {
  await pool.query(
    `INSERT INTO notifications (user_id, title, body, type, link) VALUES ($1, $2, $3, $4, $5)`,
    [userId, title, body || null, type || 'HE_THONG', link || null]
  );
}

/** Gửi thông báo tới toàn bộ người dùng của một vai trò */
async function notifyRole(roleCode, { title, body, type, link }) {
  const { rows } = await pool.query(
    `SELECT id FROM users WHERE is_active = TRUE
       AND role_id = (SELECT id FROM roles WHERE code = $1)`,
    [roleCode]
  );
  for (const u of rows) {
    await notify(u.id, { title, body, type, link });
  }
}

module.exports = { nextCode, notify, notifyRole };
