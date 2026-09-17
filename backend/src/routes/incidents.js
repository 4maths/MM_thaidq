const express = require('express');
const { query, one } = require('../db');
const { authenticate, requireRole } = require('../middleware/auth');
const { nextCode, notifyRole, notify } = require('../utils/helpers');

const router = express.Router();
router.use(authenticate);

/** GET /api/v1/incidents?status=&equipmentId= — danh sách sự cố */
router.get('/', async (req, res) => {
  const { status, equipmentId, page = 1, pageSize = 20 } = req.query;
  const conditions = ['1=1'];
  const params = [];
  if (status) { params.push(status); conditions.push(`i.status = $${params.length}`); }
  if (equipmentId) { params.push(equipmentId); conditions.push(`i.equipment_id = $${params.length}`); }
  if (req.user.role === 'DON_VI' && req.user.departmentId) {
    params.push(req.user.departmentId);
    conditions.push(`i.department_id = $${params.length}`);
  }
  const where = conditions.join(' AND ');
  const limit = Math.min(parseInt(pageSize, 10) || 20, 100);
  const offset = ((parseInt(page, 10) || 1) - 1) * limit;

  const rows = await query(
    `SELECT i.*, e.code AS equipment_code, e.name AS equipment_name, d.name AS department_name,
            u.full_name AS reported_by_name, rp.id AS repair_plan_id, rp.status AS repair_plan_status,
            acc.id AS acceptance_id
       FROM incidents i
       JOIN equipment e ON e.id = i.equipment_id
       LEFT JOIN departments d ON d.id = i.department_id
       LEFT JOIN users u ON u.id = i.reported_by
       LEFT JOIN repair_plans rp ON rp.incident_id = i.id
       LEFT JOIN acceptance_records acc ON acc.incident_id = i.id
      WHERE ${where}
      ORDER BY i.reported_at DESC
      LIMIT ${limit} OFFSET ${offset}`,
    params
  );
  const [{ count }] = await query(`SELECT COUNT(*)::int AS count FROM incidents i WHERE ${where}`, params);
  res.json({ data: rows, total: count, page: parseInt(page, 10) || 1, pageSize: limit });
});

/** GET /api/v1/incidents/:id */
router.get('/:id', async (req, res) => {
  const incident = await one(
    `SELECT i.*, e.code AS equipment_code, e.name AS equipment_name, d.name AS department_name,
            u.full_name AS reported_by_name, rv.full_name AS reviewed_by_name
       FROM incidents i
       JOIN equipment e ON e.id = i.equipment_id
       LEFT JOIN departments d ON d.id = i.department_id
       LEFT JOIN users u ON u.id = i.reported_by
       LEFT JOIN users rv ON rv.id = i.reviewed_by
      WHERE i.id = $1`,
    [req.params.id]
  );
  if (!incident) return res.status(404).json({ error: 'Không tìm thấy sự cố' });
  const repairPlan = await one('SELECT * FROM repair_plans WHERE incident_id = $1', [req.params.id]);
  res.json({ incident, repairPlan });
});

/**
 * POST /api/v1/incidents — báo sự cố (mục 6.2.3b: đơn vị thông báo cho Văn phòng Cục)
 * Body: { equipmentId, description, severity? }
 */
router.post('/', requireRole('DON_VI', 'VAN_PHONG_CUC'), async (req, res) => {
  const { equipmentId, description, severity } = req.body || {};
  if (!equipmentId || !description) return res.status(400).json({ error: 'Thiếu thiết bị hoặc mô tả sự cố' });

  const equip = await one('SELECT * FROM equipment WHERE id = $1 AND is_active = TRUE', [equipmentId]);
  if (!equip) return res.status(404).json({ error: 'Không tìm thấy thiết bị trong danh mục' });

  const code = await nextCode('SC', 'incidents');
  const created = await one(
    `INSERT INTO incidents (code, equipment_id, reported_by, department_id, description, severity, status)
     VALUES ($1,$2,$3,$4,$5,$6,'MOI') RETURNING *`,
    [code, equipmentId, req.user.id, equip.department_id, description, severity || 'NHO']
  );
  await one(`UPDATE equipment SET status = 'SU_CO', updated_at = now() WHERE id = $1`, [equipmentId]);

  await req.audit({ action: 'CREATE', entityType: 'incident', entityId: created.id, newValues: { code, equipment: equip.code } });
  await notifyRole('VAN_PHONG_CUC', {
    title: `Sự cố mới ${code} — ${equip.name}`,
    body: `${req.user.name} báo: ${description}`,
    type: 'SU_CO', link: `/su-co/${created.id}`,
  });
  res.status(201).json({ incident: created, message: 'Đã gửi báo sự cố tới Văn phòng Cục' });
});

/**
 * POST /api/v1/incidents/:id/review — Văn phòng Cục kiểm tra, xem xét nguyên nhân (6.2.3b)
 * Body: { severity: NHO|LON|NGUY_CO, resolutionType: TU_KHAC_PHUC|THUE_NGOAI|NOI_BO, note? }
 * - TU_KHAC_PHUC: chuyển cho đơn vị tự khắc phục (không qua phê duyệt — đúng quy trình)
 * - THUE_NGOAI/NOI_BO: chờ lập phương án sửa chữa và trình duyệt
 */
router.post('/:id/review', requireRole('VAN_PHONG_CUC'), async (req, res) => {
  const { severity, resolutionType, note } = req.body || {};
  const incident = await one(`SELECT * FROM incidents WHERE id = $1 AND status = 'MOI'`, [req.params.id]);
  if (!incident) return res.status(409).json({ error: 'Sự cố không ở trạng thái MỚI' });

  const updated = await one(
    `UPDATE incidents SET severity = $2, resolution_type = $3, status = $4,
            reviewed_by = $5, reviewed_at = now(), notes = $6
      WHERE id = $1 RETURNING *`,
    [req.params.id, severity || incident.severity, resolutionType,
      resolutionType === 'TU_KHAC_PHUC' ? 'DANG_XEM_XET' : 'CHO_DUYET',
      req.user.id, note ?? incident.notes]
  );
  await req.audit({ action: 'REVIEW', entityType: 'incident', entityId: updated.id, oldValues: incident, newValues: updated });

  if (resolutionType === 'TU_KHAC_PHUC') {
    await notify(updated.reported_by, {
      title: `Sự cố ${updated.code}: đề nghị đơn vị tự khắc phục`,
      body: 'Văn phòng Cục đã xem xét — sự cố nhỏ, đơn vị tự khắc phục và cập nhật hồ sơ thiết bị.',
      type: 'SU_CO', link: `/su-co/${updated.id}`,
    });
  } else {
    await notifyRole('LANH_DAO_CUC', {
      title: `Sự cố ${updated.code} cần phê duyệt phương án sửa chữa`,
      body: 'Văn phòng Cục sẽ lập phương án sau khi được xem xét.',
      type: 'SU_CO', link: `/su-co/${updated.id}`,
    });
  }
  res.json({ incident: updated });
});

/**
 * POST /api/v1/incidents/:id/self-resolve — đơn vị tự khắc phục sự cố nhỏ (6.2.3b)
 * Ghi hồ sơ thiết bị (BM/02) và đóng sự cố — KHÔNG qua phê duyệt, đúng ngữ nghĩa quy trình.
 * Body: { content, performer?, performedDate? }
 */
router.post('/:id/self-resolve', requireRole('DON_VI', 'VAN_PHONG_CUC'), async (req, res) => {
  const { content, performer, performedDate } = req.body || {};
  if (!content) return res.status(400).json({ error: 'Thiếu nội dung khắc phục' });

  const incident = await one(
    `SELECT * FROM incidents WHERE id = $1 AND resolution_type = 'TU_KHAC_PHUC'
        AND status IN ('MOI','DANG_XEM_XET')`,
    [req.params.id]
  );
  if (!incident) return res.status(409).json({ error: 'Sự cố không ở giai đoạn tự khắc phục' });

  await one(
    `INSERT INTO equipment_logs (equipment_id, performed_date, content, performer, log_type, related_incident_id, created_by)
     VALUES ($1,$2,$3,$4,'KHAC_PHUC_SU_CO',$5,$6)`,
    [incident.equipment_id, performedDate || new Date().toISOString().slice(0, 10),
      `[Sự cố ${incident.code}] ${content}`, performer || req.user.name, incident.id, req.user.id]
  );
  const closed = await one(
    `UPDATE incidents SET status = 'DONG', resolved_at = now() WHERE id = $1 RETURNING *`,
    [req.params.id]
  );
  await one(`UPDATE equipment SET status = 'HOAT_DONG', updated_at = now() WHERE id = $1`, [incident.equipment_id]);

  await req.audit({ action: 'SELF_RESOLVE', entityType: 'incident', entityId: closed.id, newValues: closed });
  res.json({ incident: closed, message: 'Đã ghi hồ sơ và đóng sự cố' });
});

module.exports = router;
