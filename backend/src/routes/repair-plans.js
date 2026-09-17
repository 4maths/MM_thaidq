const express = require('express');
const { query, one } = require('../db');
const { authenticate, requireRole } = require('../middleware/auth');
const { notifyRole } = require('../utils/helpers');

const router = express.Router();
router.use(authenticate);

/** GET /api/v1/repair-plans — danh sách phương án sửa chữa */
router.get('/', requireRole('VAN_PHONG_CUC', 'LANH_DAO_CUC', 'QMS', 'NHA_THAU'), async (req, res) => {
  const rows = await query(
    `SELECT rp.*, i.code AS incident_code, i.description AS incident_description,
            e.code AS equipment_code, e.name AS equipment_name,
            v.name AS vendor_name, u.full_name AS created_by_name, ap.full_name AS approved_by_name
       FROM repair_plans rp
       JOIN incidents i ON i.id = rp.incident_id
       JOIN equipment e ON e.id = i.equipment_id
       LEFT JOIN vendors v ON v.id = rp.vendor_id
       LEFT JOIN users u ON u.id = rp.created_by
       LEFT JOIN users ap ON ap.id = rp.approved_by
      ORDER BY rp.created_at DESC`
  );
  res.json({ data: rows });
});

/**
 * POST /api/v1/repair-plans — Văn phòng Cục lập phương án sửa chữa / thuê ngoài
 * Body: { incidentId, content, vendorId?, estimatedCost? }
 */
router.post('/', requireRole('VAN_PHONG_CUC'), async (req, res) => {
  const { incidentId, content, vendorId, estimatedCost } = req.body || {};
  if (!incidentId || !content) return res.status(400).json({ error: 'Thiếu sự cố hoặc nội dung phương án' });

  const incident = await one(`SELECT * FROM incidents WHERE id = $1 AND status IN ('CHO_DUYET','DANG_XEM_XET')`, [incidentId]);
  if (!incident) return res.status(409).json({ error: 'Sự cố không ở trạng thái chờ lập phương án' });

  const dup = await one('SELECT id FROM repair_plans WHERE incident_id = $1', [incidentId]);
  if (dup) return res.status(409).json({ error: 'Sự cố này đã có phương án sửa chữa' });

  const created = await one(
    `INSERT INTO repair_plans (incident_id, content, vendor_id, estimated_cost, status, created_by)
     VALUES ($1,$2,$3,$4,'CHO_DUYET',$5) RETURNING *`,
    [incidentId, content, vendorId || null, estimatedCost || null, req.user.id]
  );
  await req.audit({ action: 'CREATE', entityType: 'repair_plan', entityId: created.id, newValues: { incident: incident.code } });
  res.status(201).json({ repairPlan: created });
});

/** POST /api/v1/repair-plans/:id/approve — Lãnh đạo Cục phê duyệt phương án */
router.post('/:id/approve', requireRole('LANH_DAO_CUC'), async (req, res) => {
  const plan = await one(
    `UPDATE repair_plans SET status = 'DA_DUYET', approved_by = $2, approved_at = now(), approval_note = $3
      WHERE id = $1 AND status = 'CHO_DUYET' RETURNING *`,
    [req.params.id, req.user.id, req.body?.note || null]
  );
  if (!plan) return res.status(409).json({ error: 'Phương án không ở trạng thái chờ duyệt' });

  await one(`UPDATE incidents SET status = 'DANG_SUA' WHERE id = $1`, [plan.incident_id]);
  await one(
    `UPDATE equipment SET status = 'DANG_SUA', updated_at = now()
      WHERE id = (SELECT equipment_id FROM incidents WHERE id = $1)`,
    [plan.incident_id]
  );
  await req.audit({ action: 'APPROVE', entityType: 'repair_plan', entityId: plan.id, newValues: plan });

  const incident = await one('SELECT code, reported_by FROM incidents WHERE id = $1', [plan.incident_id]);
  await notifyRole('VAN_PHONG_CUC', {
    title: `Phương án cho sự cố ${incident.code} đã được duyệt`,
    body: 'Văn phòng Cục liên hệ đơn vị ngoài, phối hợp đơn vị sử dụng tiến hành sửa chữa (6.2.4).',
    type: 'PH_DUYET', link: `/sua-chua/${plan.id}`,
  });
  res.json({ repairPlan: plan, message: 'Đã phê duyệt — chuyển sang giai đoạn thực hiện' });
});

/** POST /api/v1/repair-plans/:id/reject — Lãnh đạo Cục từ chối */
router.post('/:id/reject', requireRole('LANH_DAO_CUC'), async (req, res) => {
  if (!req.body?.note) return res.status(400).json({ error: 'Phải ghi rõ lý do từ chối' });
  const plan = await one(
    `UPDATE repair_plans SET status = 'TU_CHOI', approved_by = $2, approved_at = now(), approval_note = $3
      WHERE id = $1 AND status = 'CHO_DUYET' RETURNING *`,
    [req.params.id, req.user.id, req.body.note]
  );
  if (!plan) return res.status(409).json({ error: 'Phương án không ở trạng thái chờ duyệt' });

  await one(`UPDATE incidents SET status = 'DANG_XEM_XET' WHERE id = $1`, [plan.incident_id]);
  await req.audit({ action: 'REJECT', entityType: 'repair_plan', entityId: plan.id, newValues: plan });
  await notifyRole('VAN_PHONG_CUC', {
    title: 'Phương án sửa chữa bị trả về',
    body: req.body.note, type: 'PH_DUYET',
  });
  res.json({ repairPlan: plan });
});

/**
 * POST /api/v1/repair-plans/:id/complete — báo hoàn thành sửa chữa (VPC)
 * Chuyển sự cố sang CHỜ NGHIỆM THU — nghiệm thu theo 6.2.5 khi thuê ngoài.
 */
router.post('/:id/complete', requireRole('VAN_PHONG_CUC'), async (req, res) => {
  const plan = await one(
    `UPDATE repair_plans SET status = 'HOAN_THANH' WHERE id = $1 AND status IN ('DA_DUYET','DANG_THUC_HIEN') RETURNING *`,
    [req.params.id]
  );
  if (!plan) return res.status(409).json({ error: 'Phương án không ở trạng thái đang thực hiện' });

  const incident = await one(
    `UPDATE incidents SET status = 'CHO_NGHIEM_THU' WHERE id = $1 RETURNING *`,
    [plan.incident_id]
  );
  await req.audit({ action: 'COMPLETE', entityType: 'repair_plan', entityId: plan.id, newValues: plan });
  res.json({ repairPlan: plan, incident, message: 'Đã báo hoàn thành — chờ kiểm tra, chạy thử và lập biên bản nghiệm thu' });
});

module.exports = router;
