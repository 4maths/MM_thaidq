const express = require('express');
const ExcelJS = require('exceljs');
const { query, one, pool } = require('../db');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

/**
 * GET /api/v1/equipment — danh mục trang thiết bị (BM/01)
 * Hỗ trợ lọc: ?q= (tên/mã), ?status=, ?departmentId=, ?page=&pageSize=
 * Đơn vị thường chỉ thấy thiết bị của đơn vị mình; Văn phòng Cục / QMS / Lãnh đạo thấy toàn Cục.
 */
router.get('/', async (req, res) => {
  const { q, status, departmentId, page = 1, pageSize = 20 } = req.query;
  const conditions = ['e.is_active = TRUE'];
  const params = [];

  if (req.user.role === 'DON_VI' && req.user.departmentId) {
    params.push(req.user.departmentId);
    conditions.push(`e.department_id = $${params.length}`);
  }
  if (status) { params.push(status); conditions.push(`e.status = $${params.length}`); }
  if (departmentId && req.user.role !== 'DON_VI') {
    params.push(departmentId); conditions.push(`e.department_id = $${params.length}`);
  }
  if (q) {
    params.push(`%${q}%`);
    conditions.push(`(e.name ILIKE $${params.length} OR e.code ILIKE $${params.length})`);
  }

  const where = conditions.join(' AND ');
  const limit = Math.min(parseInt(pageSize, 10) || 20, 100);
  const offset = ((parseInt(page, 10) || 1) - 1) * limit;

  const rows = await query(
    `SELECT e.id, e.code, e.name, e.country_of_origin, e.received_date, e.status,
            e.category, e.model, e.notes, e.department_id, d.name AS department_name,
            (SELECT COUNT(*) FROM incidents i WHERE i.equipment_id = e.id AND i.status NOT IN ('DONG')) AS open_incidents
       FROM equipment e
       LEFT JOIN departments d ON d.id = e.department_id
      WHERE ${where}
      ORDER BY e.code
      LIMIT ${limit} OFFSET ${offset}`,
    params
  );
  const [{ count }] = await query(`SELECT COUNT(*)::int AS count FROM equipment e WHERE ${where}`, params);
  res.json({ data: rows, total: count, page: parseInt(page, 10) || 1, pageSize: limit });
});

/** GET /api/v1/equipment/:id — chi tiết thiết bị + hồ sơ (BM/02) + sự cố gần đây */
router.get('/:id', async (req, res) => {
  const equip = await one(
    `SELECT e.*, d.name AS department_name
       FROM equipment e LEFT JOIN departments d ON d.id = e.department_id
      WHERE e.id = $1`,
    [req.params.id]
  );
  if (!equip) return res.status(404).json({ error: 'Không tìm thấy thiết bị' });
  if (req.user.role === 'DON_VI' && req.user.departmentId && equip.department_id !== req.user.departmentId) {
    return res.status(403).json({ error: 'Thiết bị không thuộc đơn vị của bạn' });
  }

  const logs = await query(
    `SELECT l.*, u.full_name AS created_by_name
       FROM equipment_logs l LEFT JOIN users u ON u.id = l.created_by
      WHERE l.equipment_id = $1 ORDER BY l.performed_date DESC, l.id DESC`,
    [req.params.id]
  );
  const incidents = await query(
    `SELECT id, code, description, severity, status, reported_at, resolved_at
       FROM incidents WHERE equipment_id = $1 ORDER BY reported_at DESC LIMIT 10`,
    [req.params.id]
  );
  res.json({ equipment: equip, logs, incidents });
});

/** POST /api/v1/equipment — bổ sung thiết bị mới vào danh mục (Văn phòng Cục) */
router.post('/', requireRole('VAN_PHONG_CUC'), async (req, res) => {
  const { code, name, countryOfOrigin, receivedDate, departmentId, category, model, serialNumber, notes } = req.body || {};
  if (!code || !name) return res.status(400).json({ error: 'Thiếu mã số hoặc tên trang thiết bị' });

  const dup = await one('SELECT id FROM equipment WHERE code = $1', [code]);
  if (dup) return res.status(409).json({ error: `Mã số ${code} đã tồn tại trong danh mục` });

  const created = await one(
    `INSERT INTO equipment (code, name, country_of_origin, received_date, department_id, category, model, serial_number, notes)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
    [code, name, countryOfOrigin || null, receivedDate || null, departmentId || null, category || null, model || null, serialNumber || null, notes || null]
  );
  await req.audit({ action: 'CREATE', entityType: 'equipment', entityId: created.id, newValues: { code, name } });
  res.status(201).json({ equipment: created });
});

/** PUT /api/v1/equipment/:id — cập nhật thông tin (Văn phòng Cục) */
router.put('/:id', requireRole('VAN_PHONG_CUC'), async (req, res) => {
  const old = await one('SELECT * FROM equipment WHERE id = $1', [req.params.id]);
  if (!old) return res.status(404).json({ error: 'Không tìm thấy thiết bị' });

  const b = req.body || {};
  const updated = await one(
    `UPDATE equipment SET
       name = $2, country_of_origin = $3, received_date = $4, department_id = $5,
       status = $6, category = $7, model = $8, serial_number = $9, notes = $10, updated_at = now()
     WHERE id = $1 RETURNING *`,
    [req.params.id,
      b.name ?? old.name, b.countryOfOrigin ?? old.country_of_origin, b.receivedDate ?? old.received_date,
      b.departmentId ?? old.department_id, b.status ?? old.status, b.category ?? old.category,
      b.model ?? old.model, b.serial_number ?? old.serial_number, b.notes ?? old.notes]
  );
  await req.audit({ action: 'UPDATE', entityType: 'equipment', entityId: updated.id, oldValues: old, newValues: updated });
  res.json({ equipment: updated });
});

/** DELETE /api/v1/equipment/:id — ngừng sử dụng (soft delete, giữ hồ sơ lưu trữ) */
router.delete('/:id', requireRole('VAN_PHONG_CUC'), async (req, res) => {
  const updated = await one(
    `UPDATE equipment SET is_active = FALSE, status = 'NGUNG_SU_DUNG', updated_at = now()
      WHERE id = $1 RETURNING id, code`,
    [req.params.id]
  );
  if (!updated) return res.status(404).json({ error: 'Không tìm thấy thiết bị' });
  await req.audit({ action: 'DEACTIVATE', entityType: 'equipment', entityId: updated.id, newValues: updated });
  res.json({ message: `Đã ngừng sử dụng thiết bị ${updated.code}` });
});

/**
 * POST /api/v1/equipment/:id/logs — ghi bản ghi vào hồ sơ thiết bị (BM/02)
 * STT | Ngày thực hiện | Nội dung bảo trì, sửa chữa | Người thực hiện
 */
router.post('/:id/logs', requireRole('VAN_PHONG_CUC', 'DON_VI'), async (req, res) => {
  const { performedDate, content, performer, logType, relatedIncidentId, relatedPlanItemId } = req.body || {};
  if (!performedDate || !content || !performer) {
    return res.status(400).json({ error: 'Thiếu ngày thực hiện / nội dung / người thực hiện' });
  }
  const created = await one(
    `INSERT INTO equipment_logs (equipment_id, performed_date, content, performer, log_type, related_incident_id, related_plan_item_id, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
    [req.params.id, performedDate, content, performer, logType || 'BAO_DUONG', relatedIncidentId || null, relatedPlanItemId || null, req.user.id]
  );
  await req.audit({ action: 'CREATE', entityType: 'equipment_log', entityId: created.id, newValues: { content } });
  res.status(201).json({ log: created });
});

/** GET /api/v1/equipment/export.xlsx — xuất danh mục (BM/01) ra Excel */
router.get('/export.xlsx', requireRole('VAN_PHONG_CUC', 'QMS', 'LANH_DAO_CUC'), async (req, res) => {
  const rows = await query(
    `SELECT ROW_NUMBER() OVER (ORDER BY e.code) AS stt, e.name, e.code,
            e.country_of_origin, to_char(e.received_date, 'DD/MM/YYYY') AS received, d.name AS department
       FROM equipment e LEFT JOIN departments d ON d.id = e.department_id
      WHERE e.is_active = TRUE`
  );
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Danh muc trang thiet bi');
  ws.columns = [
    { header: 'STT', key: 'stt', width: 6 },
    { header: 'Tên trang thiết bị', key: 'name', width: 38 },
    { header: 'Mã số', key: 'code', width: 16 },
    { header: 'Nước sản xuất', key: 'country_of_origin', width: 18 },
    { header: 'Ngày nhận', key: 'received', width: 14 },
    { header: 'Đơn vị sử dụng', key: 'department', width: 34 },
  ];
  ws.getRow(1).font = { bold: true };
  rows.forEach((r) => ws.addRow(r));

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename="BM-QLD-09-01_01_danh-muc-trang-thiet-bi.xlsx"');
  await wb.xlsx.write(res);
  res.end();
});

module.exports = router;
