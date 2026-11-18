const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const config = require('../config');
const { one } = require('../db');
const {
  nextCode,
  notifyRole,
  normalizeIssueType,
  generateLookupCode,
  isValidUuid,
  isValidPhone,
} = require('../utils/helpers');

const router = express.Router();
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Thư mục lưu trữ tệp đính kèm (tương thích cả Docker Linux lẫn môi trường dev Windows)
let uploadDir;
if (process.platform === 'win32' && config.uploadDir && config.uploadDir.startsWith('/')) {
  uploadDir = path.join(__dirname, '..', '..', 'uploads');
} else if (path.isAbsolute(config.uploadDir)) {
  uploadDir = config.uploadDir;
} else {
  uploadDir = path.join(__dirname, '..', '..', config.uploadDir || 'uploads');
}

try {
  fs.mkdirSync(uploadDir, { recursive: true });
} catch (e) {
  uploadDir = path.join(__dirname, '..', '..', 'uploads');
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const safe = file.originalname.replace(/[^\w.\-À-ỹà-ỹ ]+/g, '_');
    cb(null, `${Date.now()}-${safe}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB (NFR-04)
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      return cb(null, true);
    }
    cb(Object.assign(new Error('Chỉ chấp nhận tệp hình ảnh (JPEG, PNG, WebP...)'), { status: 400 }));
  },
});

/**
 * GET /api/public/incidents/track/:code — Tra cứu tiến độ tối thiểu của phiếu sự cố (UC-03.6, A1.1).
 * Công khai, không cần đăng nhập.
 * Tham số :code có thể là mã phiếu (ví dụ SC-2026-001) hoặc mã tra cứu khó đoán (lookup_code).
 * TUÂN THỦ NFR-02: Tuyệt đối không trả về thông tin cá nhân (tên, SĐT người báo).
 */
router.get('/track/:code', async (req, res) => {
  const { code } = req.params;
  if (!code || !code.trim()) {
    return res.status(400).json({ error: 'Vui lòng cung cấp mã phiếu hoặc mã tra cứu' });
  }

  const queryCode = code.trim();
  const incident = await one(
    `SELECT i.code, i.status, i.issue_type, i.description, i.reported_at, i.resolved_at,
            i.resolution_notes, i.lookup_code,
            e.code AS equipment_code, e.name AS equipment_name,
            d.name AS department_name
       FROM incidents i
       JOIN equipment e ON e.id = i.equipment_id
       LEFT JOIN departments d ON d.id = i.department_id
      WHERE i.code ILIKE $1 OR i.lookup_code ILIKE $1`,
    [queryCode]
  );

  if (!incident) {
    return res.status(404).json({ error: 'Mã tra cứu không chính xác hoặc không tìm thấy phiếu sự cố (E6.1)' });
  }

  // Trả về tiến độ tối thiểu (FR-03.4 & NFR-02)
  return res.json({
    incident: {
      code: incident.code,
      status: incident.status,
      equipment_code: incident.equipment_code,
      equipment_name: incident.equipment_name,
      department_name: incident.department_name,
      issue_type: incident.issue_type,
      description: incident.description,
      reported_at: incident.reported_at,
      resolved_at: incident.resolved_at,
      resolution_notes: incident.resolution_notes,
      lookup_code: incident.lookup_code,
    },
  });
});

/**
 * POST /api/public/incidents — Tiếp nhận phiếu báo hỏng không cần đăng nhập (UC-03, FR-03.2).
 * Hỗ trợ multipart/form-data (ảnh) hoặc application/json.
 */
router.post('/', upload.single('photo'), async (req, res) => {
  const b = req.body || {};
  const equipmentUuid = b.equipmentUuid || b.equipment_uuid || b.uuid;
  const equipmentCode = b.equipmentCode || b.equipment_code;
  const reporterName = b.reporterName || b.reporter_name;
  const reporterPhone = b.reporterPhone || b.reporter_phone;
  const rawIssueType = b.issueType || b.issue_type;
  const description = b.description;
  const detectedAt = b.detectedAt || b.detected_at;
  const requestId = b.requestId || b.request_id;
  const confirmAnother = b.confirmAnother === true || b.confirmAnother === 'true';

  // 1. Chống gửi lại cùng thao tác qua request_id (NFR-03 & UC-03.A5.1)
  if (requestId && UUID_REGEX.test(String(requestId).trim())) {
    const existingReq = await one(
      `SELECT i.id, i.code, i.status, i.reported_at, i.lookup_code,
              e.code AS equipment_code, e.name AS equipment_name
         FROM incidents i
         JOIN equipment e ON e.id = i.equipment_id
        WHERE i.request_id = $1`,
      [String(requestId).trim()]
    );
    if (existingReq) {
      return res.status(200).json({
        message: 'Phiếu sự cố đã được tiếp nhận trước đó (A5.1)',
        incident: existingReq,
        lookupCode: existingReq.lookup_code,
      });
    }
  }

  // 2. Kiểm tra trường bắt buộc (E4.1)
  if (!equipmentUuid && !equipmentCode) {
    return res.status(400).json({ error: 'Thiếu định danh thiết bị (equipmentUuid hoặc equipmentCode)' });
  }
  if (!reporterName || !String(reporterName).trim()) {
    return res.status(400).json({ error: 'Vui lòng nhập họ tên người báo' });
  }
  if (!description || !String(description).trim()) {
    return res.status(400).json({ error: 'Vui lòng nhập mô tả biểu hiện sự cố' });
  }

  // 3. Tra cứu thiết bị
  let equip = null;
  if (equipmentUuid && UUID_REGEX.test(String(equipmentUuid).trim())) {
    equip = await one('SELECT id, code, name, department_id, status FROM equipment WHERE qr_code_uuid = $1 AND is_active = TRUE', [String(equipmentUuid).trim()]);
  } else if (equipmentCode) {
    equip = await one('SELECT id, code, name, department_id, status FROM equipment WHERE code ILIKE $1 AND is_active = TRUE', [String(equipmentCode).trim()]);
  }
  if (!equip) {
    return res.status(404).json({ error: 'Không tìm thấy thông tin thiết bị tương ứng (E2.1)' });
  }

  // 4. Kiểm tra phiếu đang mở trên thiết bị (FR-03.3 & UC-03.A4.1)
  if (!confirmAnother) {
    const activeIncident = await one(
      `SELECT id, code, reported_at, reporter_name, status
         FROM incidents
        WHERE equipment_id = $1
          AND status NOT IN ('DONG', 'DA_XU_LY')
        ORDER BY reported_at DESC LIMIT 1`,
      [equip.id]
    );
    if (activeIncident) {
      const timeStr = new Date(activeIncident.reported_at).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
      return res.status(409).json({
        error: `Thiết bị đang được Văn phòng tiếp nhận xử lý lúc ${timeStr} (Phiếu ${activeIncident.code}).`,
        has_active_incident: true,
        active_incident: {
          code: activeIncident.code,
          status: activeIncident.status,
          reported_at: activeIncident.reported_at,
        },
        hint: 'Nếu đây là sự cố khác hoàn toàn, vui lòng xác nhận thêm để tiếp tục gửi.',
      });
    }
  }

  // 5. Lưu phiếu sự cố với trạng thái MOI_TIEP_NHAN (UC-03.5)
  const code = await nextCode('SC', 'incidents');
  const issueType = normalizeIssueType(rawIssueType);
  const lookupCode = generateLookupCode();
  const validReqId = requestId && UUID_REGEX.test(String(requestId).trim()) ? String(requestId).trim() : null;

  const incident = await one(
    `INSERT INTO incidents
       (code, equipment_id, reported_by, department_id, description, severity,
        resolution_type, status, reporter_name, reporter_phone, issue_type,
        source, detected_at, request_id, lookup_code)
     VALUES ($1, $2, NULL, $3, $4, 'NHO', 'CHUA_XAC_DINH', 'MOI_TIEP_NHAN', $5, $6, $7,
             'QR_SCAN', $8, $9, $10)
     RETURNING id, code, status, severity, issue_type, source, description, reported_at, lookup_code`,
    [
      code,
      equip.id,
      equip.department_id,
      String(description).trim(),
      String(reporterName).trim(),
      reporterPhone ? String(reporterPhone).trim() : null,
      issueType,
      detectedAt ? new Date(detectedAt) : new Date(),
      validReqId,
      lookupCode,
    ]
  );

  // 6. Cập nhật tình trạng thiết bị sang SU_CO (Mục 2.4.1)
  await one(
    `UPDATE equipment SET status = 'SU_CO', updated_at = now() WHERE id = $1 AND status != 'NGUNG_SU_DUNG' AND status != 'THANH_LY'`,
    [equip.id]
  );

  // 7. Lưu ảnh minh chứng nếu có (Mục 2.4.2)
  let attachment = null;
  if (req.file) {
    attachment = await one(
      `INSERT INTO attachments
         (entity_type, entity_id, file_name, file_path, mime_type, file_size)
       VALUES ('incident', $1, $2, $3, $4, $5)
       RETURNING id, file_name, file_path, mime_type, file_size`,
      [incident.id, req.file.originalname, req.file.filename, req.file.mimetype, req.file.size]
    );
  }

  // 8. Thông báo cán bộ quản lý
  await notifyRole('VAN_PHONG_CUC', {
    title: `[Tiếp nhận sự cố QR] ${code} — ${equip.name}`,
    body: `${reporterName} báo hỏng: ${description.slice(0, 100)}`,
    type: 'SU_CO',
    link: `/su-co/${incident.id}`,
  });

  // 9. Ghi vết kiểm toán (NFR-06)
  if (req.audit) {
    await req.audit({
      action: 'REPORT_INCIDENT_QR',
      entityType: 'incident',
      entityId: incident.id,
      newValues: { code, equipment_code: equip.code, issue_type: issueType, lookup_code: lookupCode },
    });
  }

  // Trả về mã xác nhận và mã tra cứu khó đoán (UC-03.5)
  return res.status(201).json({
    message: 'Phiếu báo hỏng đã được tiếp nhận thành công.',
    incidentCode: code,
    lookupCode: lookupCode,
    incident: {
      ...incident,
      equipment_code: equip.code,
      equipment_name: equip.name,
    },
    attachment,
  });
});

module.exports = router;
