const express = require('express');
const { query, one, withTransaction } = require('../db');
const { authenticate, requireRole } = require('../middleware/auth');
const { notifyRole, notify } = require('../utils/helpers');

const router = express.Router();
router.use(authenticate);

/**
 * GET /api/v1/plans — danh sách kế hoạch bảo dưỡng, thay thế (BM/03)
 */
router.get('/', async (req, res) => {
  const plans = await query(
    `SELECT p.*, u.full_name AS created_by_name, a.full_name AS approved_by_name,
            (SELECT COUNT(*) FROM maintenance_plan_items i WHERE i.plan_id = p.id) AS item_count,
            (SELECT COUNT(*) FROM maintenance_plan_items i WHERE i.plan_id = p.id AND i.status = 'HOAN_THANH') AS completed_count
       FROM maintenance_plans p
       LEFT JOIN users u ON u.id = p.created_by
       LEFT JOIN users a ON a.id = p.approved_by
      ORDER BY p.year DESC`
  );
  res.json({ data: plans });
});

/** GET /api/v1/plans/:id — chi tiết kế hoạch + các dòng (đúng cột BM/03) */
router.get('/:id', async (req, res) => {
  const plan = await one(
    `SELECT p.*, u.full_name AS created_by_name, a.full_name AS approved_by_name
       FROM maintenance_plans p
       LEFT JOIN users u ON u.id = p.created_by
       LEFT JOIN users a ON a.id = p.approved_by
      WHERE p.id = $1`,
    [req.params.id]
  );
  if (!plan) return res.status(404).json({ error: 'Không tìm thấy kế hoạch' });

  const items = await query(
    `SELECT i.*, e.code AS equipment_code, e.name AS equipment_name, d.name AS department_name
       FROM maintenance_plan_items i
       JOIN equipment e ON e.id = i.equipment_id
       LEFT JOIN departments d ON d.id = i.department_id
      WHERE i.plan_id = $1 ORDER BY i.planned_month NULLS LAST, i.id`,
    [req.params.id]
  );
  res.json({ plan, items });
});

/**
 * POST /api/v1/plans — Văn phòng Cục lập kế hoạch năm + các hạng mục
 * Body: { year, items: [{ equipmentId, departmentId?, content, executorType, plannedMonth, estimatedCost?, priority?, notes? }] }
 */
router.post('/', requireRole('VAN_PHONG_CUC'), async (req, res) => {
  const { year, items = [] } = req.body || {};
  if (!year || !items.length) return res.status(400).json({ error: 'Thiếu năm kế hoạch hoặc danh sách hạng mục' });

  const dup = await one('SELECT id FROM maintenance_plans WHERE year = $1', [year]);
  if (dup) return res.status(409).json({ error: `Đã tồn tại kế hoạch năm ${year}` });

  const planId = await withTransaction(async (client) => {
    const { rows } = await client.query(
      `INSERT INTO maintenance_plans (year, status, created_by) VALUES ($1, 'NHAP', $2) RETURNING id`,
      [year, req.user.id]
    );
    const pid = rows[0].id;
    for (const it of items) {
      if (!it.equipmentId || !it.content || !it.executorType) {
        throw Object.assign(new Error('Hạng mục thiếu thiết bị / nội dung / loại đơn vị thực hiện'), { status: 400 });
      }
      await client.query(
        `INSERT INTO maintenance_plan_items
           (plan_id, equipment_id, department_id, content, executor_type, planned_month, estimated_cost, priority, notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [pid, it.equipmentId, it.departmentId || null, it.content, it.executorType,
          it.plannedMonth || null, it.estimatedCost || null, it.priority || 'BINH_THUONG', it.notes || null]
      );
    }
    return pid;
  });

  await req.audit({ action: 'CREATE', entityType: 'maintenance_plan', entityId: planId, newValues: { year, itemCount: items.length } });
  res.status(201).json({ id: planId, message: `Đã tạo kế hoạch năm ${year} với ${items.length} hạng mục` });
});

/** POST /api/v1/plans/:id/submit — trình Lãnh đạo Cục phê duyệt */
router.post('/:id/submit', requireRole('VAN_PHONG_CUC'), async (req, res) => {
  const plan = await one(
    `UPDATE maintenance_plans SET status = 'CHO_DUYET', submitted_at = now(), updated_at = now()
      WHERE id = $1 AND status IN ('NHAP','TU_CHOI') RETURNING *`,
    [req.params.id]
  );
  if (!plan) return res.status(409).json({ error: 'Chỉ kế hoạch ở trạng thái NHAP / TU_CHOI mới trình duyệt được' });

  await req.audit({ action: 'SUBMIT', entityType: 'maintenance_plan', entityId: plan.id, newValues: plan });
  await notifyRole('LANH_DAO_CUC', {
    title: `Kế hoạch bảo dưỡng năm ${plan.year} chờ phê duyệt`,
    body: 'Văn phòng Cục đã trình kế hoạch, đề nghị Lãnh đạo Cục xem xét phê duyệt.',
    type: 'PH_DUYET', link: `/plans/${plan.id}`,
  });
  res.json({ plan, message: 'Đã trình Lãnh đạo Cục phê duyệt' });
});

/** POST /api/v1/plans/:id/approve — Lãnh đạo Cục phê duyệt */
router.post('/:id/approve', requireRole('LANH_DAO_CUC'), async (req, res) => {
  const plan = await one(
    `UPDATE maintenance_plans SET status = 'DA_DUYET', approved_by = $2, approved_at = now(),
            approval_note = $3, updated_at = now()
      WHERE id = $1 AND status = 'CHO_DUYET' RETURNING *`,
    [req.params.id, req.user.id, req.body?.note || null]
  );
  if (!plan) return res.status(409).json({ error: 'Kế hoạch không ở trạng thái chờ duyệt' });

  await req.audit({ action: 'APPROVE', entityType: 'maintenance_plan', entityId: plan.id, newValues: plan });
  await notifyRole('VAN_PHONG_CUC', {
    title: `Kế hoạch năm ${plan.year} đã được phê duyệt`,
    body: req.body?.note || 'Lãnh đạo Cục đã phê duyệt kế hoạch bảo dưỡng, thay thế trang thiết bị.',
    type: 'PH_DUYET', link: `/plans/${plan.id}`,
  });
  res.json({ plan, message: 'Đã phê duyệt kế hoạch' });
});

/** POST /api/v1/plans/:id/reject — Lãnh đạo Cục từ chối (yêu cầu chỉnh sửa) */
router.post('/:id/reject', requireRole('LANH_DAO_CUC'), async (req, res) => {
  if (!req.body?.note) return res.status(400).json({ error: 'Phải ghi rõ lý do từ chối' });
  const plan = await one(
    `UPDATE maintenance_plans SET status = 'TU_CHOI', approved_by = $2, approved_at = now(),
            approval_note = $3, updated_at = now()
      WHERE id = $1 AND status = 'CHO_DUYET' RETURNING *`,
    [req.params.id, req.user.id, req.body.note]
  );
  if (!plan) return res.status(409).json({ error: 'Kế hoạch không ở trạng thái chờ duyệt' });

  await req.audit({ action: 'REJECT', entityType: 'maintenance_plan', entityId: plan.id, newValues: plan });
  await notifyRole('VAN_PHONG_CUC', {
    title: `Kế hoạch năm ${plan.year} bị trả về`,
    body: req.body.note, type: 'PH_DUYET', link: `/plans/${plan.id}`,
  });
  res.json({ plan, message: 'Đã trả kế hoạch về Văn phòng Cục' });
});

/**
 * PATCH /api/v1/plans/items/:itemId — cập nhật tiến độ hạng mục (VPC hoặc đơn vị)
 * Khi hoàn thành → tự động ghi một bản ghi vào hồ sơ thiết bị (BM/02) — mục 6.2.4.
 */
router.patch('/items/:itemId', requireRole('VAN_PHONG_CUC', 'DON_VI'), async (req, res) => {
  const { status, completionDate, notes } = req.body || {};
  const item = await one('SELECT * FROM maintenance_plan_items WHERE id = $1', [req.params.itemId]);
  if (!item) return res.status(404).json({ error: 'Không tìm thấy hạng mục' });

  const updated = await one(
    `UPDATE maintenance_plan_items
        SET status = $2, completion_date = $3, notes = $4, updated_at = now()
      WHERE id = $1 RETURNING *`,
    [req.params.itemId, status ?? item.status, completionDate ?? item.completion_date, notes ?? item.notes]
  );

  if (status === 'HOAN_THANH' && item.status !== 'HOAN_THANH') {
    const equip = await one('SELECT code, name FROM equipment WHERE id = $1', [item.equipment_id]);
    await one(
      `INSERT INTO equipment_logs (equipment_id, performed_date, content, performer, log_type, related_plan_item_id, created_by)
       VALUES ($1, $2, $3, $4, 'BAO_DUONG', $5, $6)`,
      [item.equipment_id, updated.completion_date || new Date().toISOString().slice(0, 10),
        `[Kế hoạch] ${item.content}`, req.user.name || 'Văn phòng Cục', item.id, req.user.id]
    );
    // Thiết bị quay lại trạng thái hoạt động nếu đang bảo dưỡng
    await one(`UPDATE equipment SET status = 'HOAT_DONG', updated_at = now() WHERE id = $1 AND status = 'DANG_BAO_DUONG'`, [item.equipment_id]);
    await req.audit({ action: 'CREATE', entityType: 'equipment_log', entityId: item.equipment_id, newValues: { source: 'plan_item', itemId: item.id } });
  }
  if (status === 'DANG_THUC_HIEN') {
    await one(`UPDATE equipment SET status = 'DANG_BAO_DUONG', updated_at = now() WHERE id = $1 AND status = 'HOAT_DONG'`, [item.equipment_id]);
  }

  await req.audit({ action: 'UPDATE', entityType: 'plan_item', entityId: updated.id, oldValues: item, newValues: updated });
  res.json({ item: updated, equipment: { code: (await one('SELECT code FROM equipment WHERE id=$1', [updated.equipment_id])).code } });
});

/** GET /api/v1/plans/reminder/due — hạng mục sắp đến hạn trong tháng (nhắc lịch) */
router.get('/reminder/due', requireRole('VAN_PHONG_CUC', 'LANH_DAO_CUC', 'QMS'), async (req, res) => {
  const rows = await query(
    `SELECT i.*, e.code AS equipment_code, e.name AS equipment_name, d.name AS department_name
       FROM maintenance_plan_items i
       JOIN maintenance_plans p ON p.id = i.plan_id
       JOIN equipment e ON e.id = i.equipment_id
       LEFT JOIN departments d ON d.id = i.department_id
      WHERE p.status = 'DA_DUYET' AND i.status IN ('CHO_THUC_HIEN','TRE_TIEN_DO')
        AND i.planned_month = EXTRACT(MONTH FROM now())::int`
  );
  res.json({ data: rows });
});

module.exports = router;
