const crypto = require('crypto');
const { pool, one } = require('../db');

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PHONE_REGEX = /^(\+84|0)(3[2-9]|5[6|8|9]|7[0|6-9]|8[1-9]|9[0-9])[0-9]{7}$/;

/** Kiểm tra chuỗi có phải UUID hợp lệ không */
function isValidUuid(val) {
  if (!val || typeof val !== 'string') return false;
  return UUID_REGEX.test(val.trim());
}

/** Kiểm tra số điện thoại Việt Nam hợp lệ (10 số) */
function isValidPhone(val) {
  if (!val || typeof val !== 'string') return false;
  const cleaned = val.trim().replace(/\s+/g, '');
  return PHONE_REGEX.test(cleaned);
}

/** Chuẩn hóa nhóm sự cố sang ENUM chuẩn hệ thống */
function normalizeIssueType(raw) {
  if (!raw || typeof raw !== 'string') return 'KHAC';
  const val = raw.trim().toUpperCase();
  const map = {
    'NGUON_DIEN': 'NGUON_DIEN',
    'NGUỒN ĐIỆN': 'NGUON_DIEN',
    'DIEN': 'NGUON_DIEN',
    'ĐIỆN': 'NGUON_DIEN',
    'MAN_HINH': 'MAN_HINH',
    'MÀN HÌNH': 'MAN_HINH',
    'CO_KHI': 'CO_KHI',
    'CƠ KHÍ': 'CO_KHI',
    'KẸT GIẤY': 'CO_KHI',
    'KET_GIAY': 'CO_KHI',
    'PHAN_MEM': 'PHAN_MEM',
    'PHẦN MỀM': 'PHAN_MEM',
    'KHAC': 'KHAC',
    'KHÁC': 'KHAC',
  };
  return map[val] || map[raw.trim()] || 'KHAC';
}

/** Sinh mã tra cứu khó đoán (lookup_code) cho người dân theo dõi */
function generateLookupCode() {
  return 'TK-' + crypto.randomBytes(4).toString('hex').toUpperCase();
}

/** Tính mã tiếp theo từ mã trước đó (thuần túy không phụ thuộc DB) */
function formatNextSequence(prefix, year, lastCode) {
  if (!prefix || typeof prefix !== 'string') prefix = 'SC';
  const targetYear = parseInt(year, 10) || new Date().getFullYear();
  let lastSeq = 0;
  if (lastCode && typeof lastCode === 'string') {
    // Chỉ chấp nhận định dạng chuẩn [PREFIX]-[YEAR]-[NUMBER]
    const match = lastCode.trim().match(/^[A-Za-z0-9]+-\d{4}-(\d+)$/);
    if (match) {
      const parsed = parseInt(match[1], 10);
      if (!isNaN(parsed) && parsed >= 0) {
        lastSeq = parsed;
      }
    }
  }
  const seq = String(lastSeq + 1).padStart(3, '0');
  return `${prefix.trim().toUpperCase()}-${targetYear}-${seq}`;
}

/**
 * Kiểm tra xem thiết bị có đủ điều kiện tự động phục hồi về HOAT_DONG không (Mục 3.4.1)
 * Điều kiện:
 *  - Số sự cố mở còn lại = 0
 *  - Trạng thái hiện tại KHÔNG PHẢI là NGUNG_SU_DUNG hoặc THANH_LY
 */
function canRestoreEquipmentStatus(currentStatus, openIncidentCount) {
  const count = parseInt(openIncidentCount, 10);
  if (isNaN(count) || count !== 0) return false;
  if (['NGUNG_SU_DUNG', 'THANH_LY'].includes(currentStatus)) return false;
  return true;
}

/** Sinh mã đối tượng theo năm: SC-2026-001, BBNT-2026-001, PA-2026-001 */
async function nextCode(prefix, table, column = 'code') {
  const year = new Date().getFullYear();
  const like = `${prefix}-${year}-%`;
  const row = await one(
    `SELECT ${column} AS last_code FROM ${table} WHERE ${column} LIKE $1 ORDER BY id DESC LIMIT 1`,
    [like]
  );
  return formatNextSequence(prefix, year, row ? row.last_code : null);
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

module.exports = {
  isValidUuid,
  isValidPhone,
  normalizeIssueType,
  generateLookupCode,
  formatNextSequence,
  canRestoreEquipmentStatus,
  nextCode,
  notify,
  notifyRole,
};
