const express = require('express');
const { one } = require('../db');

const router = express.Router();
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * GET /api/public/equipment/:identifier — Tra cứu thiết bị qua mã QR hoặc mã thiết bị (UC-02).
 * Công khai, không cần đăng nhập.
 *
 * Tham số :identifier:
 *   - Mã định danh QR (UUID) khi quét bằng camera (Luồng chính UC-02)
 *   - Hoặc Mã thiết bị (ví dụ TT-2021-001) khi nhập thủ công (Nhánh A1.1 - Không dùng camera)
 */
router.get('/:identifier', async (req, res) => {
  const { identifier } = req.params;

  if (!identifier || typeof identifier !== 'string' || !identifier.trim()) {
    return res.status(400).json({ error: 'Mã tra cứu không hợp lệ' });
  }

  const raw = identifier.trim();
  const isUuid = UUID_REGEX.test(raw);

  // Tìm theo qr_code_uuid nếu là UUID, hoặc tìm theo mã thiết bị (code)
  const equipment = await one(
    `SELECT e.id, e.code, e.name, e.status, e.category, e.model, e.country_of_origin, e.qr_code_uuid,
            d.name AS department_name
       FROM equipment e
       LEFT JOIN departments d ON d.id = e.department_id
      WHERE (${isUuid ? 'e.qr_code_uuid = $1' : 'e.code ILIKE $1'})
        AND e.is_active = TRUE`,
    [raw]
  );

  if (!equipment) {
    return res.status(404).json({
      error: isUuid
        ? 'Mã QR không tồn tại hoặc đã được thay mới (E2.1)'
        : `Không tìm thấy thiết bị có mã "${raw}" (E2.1)`,
    });
  }

  // Lấy sự cố đang mở — phục vụ cảnh báo chống báo hỏng trùng lặp (FR-03.3 & UC-03.A4.1)
  const activeIncident = await one(
    `SELECT id, code, status, description, reported_at, reporter_name, source
       FROM incidents
      WHERE equipment_id = $1
        AND status NOT IN ('DONG', 'DA_XU_LY')
      ORDER BY reported_at DESC LIMIT 1`,
    [equipment.id]
  );

  let warningMessage = null;
  if (activeIncident) {
    const timeStr = new Date(activeIncident.reported_at).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
    warningMessage = `Thiết bị đang được Văn phòng tiếp nhận xử lý lúc ${timeStr} (Phiếu: ${activeIncident.code}).`;
  }

  // Chỉ trả về thông tin công khai tối thiểu (FR-02.3 & NFR-02: giữ kín thông tin nội bộ)
  return res.json({
    equipment: {
      code: equipment.code,
      name: equipment.name,
      status: equipment.status,
      category: equipment.category,
      model: equipment.model,
      country_of_origin: equipment.country_of_origin,
      department_name: equipment.department_name,
      qr_code_uuid: equipment.qr_code_uuid,
    },
    has_active_incident: Boolean(activeIncident),
    active_incident: activeIncident
      ? {
          code: activeIncident.code,
          status: activeIncident.status,
          description: activeIncident.description,
          reported_at: activeIncident.reported_at,
          message: warningMessage,
        }
      : null,
    // Alias hỗ trợ cả camelCase
    activeIncident: activeIncident || null,
  });
});

module.exports = router;
