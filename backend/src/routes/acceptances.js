const express = require('express');
const { query, one } = require('../db');
const { authenticate, requireRole } = require('../middleware/auth');
const { nextCode, notify, notifyRole } = require('../utils/helpers');

const router = express.Router();
router.use(authenticate);

/** GET /api/v1/acceptances — danh sách biên bản nghiệm thu (BM/04) */
router.get('/', async (req, res) => {
  const rows = await query(
    `SELECT a.*, e.code AS equipment_code, e.name AS equipment_name,
            i.code AS incident_code, rp.id AS repair_plan_id,
            u.full_name AS created_by_name,
            (SELECT COUNT(*) FROM acceptance_representatives r WHERE r.acceptance_id = a.id AND r.signed) AS signed_count,
            (SELECT COUNT(*) FROM acceptance_representatives r WHERE r.acceptance_id = a.id) AS rep_count
       FROM acceptance_records a
       LEFT JOIN equipment e ON e.id = a.equipment_id
       LEFT JOIN incidents i ON i.id = a.incident_id
       LEFT JOIN repair_plans rp ON rp.id = a.repair_plan_id
       LEFT JOIN users u ON u.id = a.created_by
      ORDER BY a.accepted_date DESC, a.id DESC`
  );
  res.json({ data: rows });
});

/** GET /api/v1/acceptances/:id — chi tiết biên bản + 2 bên đại diện (đúng cấu trúc BM/04) */
router.get('/:id', async (req, res) => {
  const record = await one(
    `SELECT a.*, e.code AS equipment_code, e.name AS equipment_name, i.code AS incident_code
       FROM acceptance_records a
       LEFT JOIN equipment e ON e.id = a.equipment_id
       LEFT JOIN incidents i ON i.id = a.incident_id
      WHERE a.id = $1`,
    [req.params.id]
  );
  if (!record) return res.status(404).json({ error: 'Không tìm thấy biên bản nghiệm thu' });
  const representatives = await query(
    `SELECT * FROM acceptance_representatives WHERE acceptance_id = $1 ORDER BY side, id`,
    [req.params.id]
  );
  res.json({ record, representatives });
});

/**
 * POST /api/v1/acceptances — Văn phòng Cục lập biên bản nghiệm thu (6.2.5)
 * Body: {
 *   repairPlanId? | planItemId? | incidentId?,
 *   workDone, equipmentConditionAfter, acceptedDate?,
 *   representatives: [{ side: 'A'|'B', fullName, organization }]  // Bên A = Cục QLD, Bên B = Công ty
 * }
 */
router.post('/', requireRole('VAN_PHONG_CUC'), async (req, res) => {
  const b = req.body || {};
  if (!b.workDone || !b.equipmentConditionAfter) {
    return res.status(400).json({ error: 'Thiếu nội dung đã thực hiện hoặc tình trạng sau thực hiện' });
  }
  const reps = Array.isArray(b.representatives) ? b.representatives : [];
  if (!reps.some((r) => r.side === 'A') || !reps.some((r) => r.side === 'B')) {
    return res.status(400).json({ error: 'Biên bản phải có đại diện cả Bên A (Cục QLD) và Bên B (Công ty)' });
  }

  let repairPlan = null;
  let incident = null;
  let planItem = null;
  let equipmentId = b.equipmentId || null;
  if (b.repairPlanId) {
    repairPlan = await one('SELECT * FROM repair_plans WHERE id = $1', [b.repairPlanId]);
    if (!repairPlan) return res.status(404).json({ error: 'Không tìm thấy phương án sửa chữa' });
    incident = await one('SELECT * FROM incidents WHERE id = $1', [repairPlan.incident_id]);
    equipmentId = equipmentId || incident.equipment_id;
  } else if (b.planItemId) {
    planItem = await one('SELECT * FROM maintenance_plan_items WHERE id = $1', [b.planItemId]);
    if (!planItem) return res.status(404).json({ error: 'Không tìm thấy hạng mục kế hoạch' });
    equipmentId = equipmentId || planItem.equipment_id;
  }
  if (!equipmentId) return res.status(400).json({ error: 'Thiếu thông tin thiết bị nghiệm thu' });

  const code = await nextCode('BBNT', 'acceptance_records');
  const record = await one(
    `INSERT INTO acceptance_records
       (code, incident_id, repair_plan_id, plan_item_id, equipment_id, work_done,
        equipment_condition_after, accepted_date, status, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'MOI',$9) RETURNING *`,
    [code, incident?.id || null, repairPlan?.id || null, planItem?.id || null, equipmentId,
      b.workDone, b.equipmentConditionAfter, b.acceptedDate || new Date().toISOString().slice(0, 10), req.user.id]
  );
  for (const r of reps) {
    await one(
      `INSERT INTO acceptance_representatives (acceptance_id, side, full_name, organization)
       VALUES ($1,$2,$3,$4)`,
      [record.id, r.side, r.fullName, r.organization || null]
    );
  }

  await req.audit({ action: 'CREATE', entityType: 'acceptance_record', entityId: record.id, newValues: { code } });
  res.status(201).json({ record, message: `Đã lập biên bản ${code} — chờ các bên ký` });
});

/**
 * POST /api/v1/acceptances/:id/sign — ký duyệt biên bản (mô phỏng chữ ký số)
 * Khi đủ chữ ký Bên A & Bên B: đóng sự cố (nếu có), ghi hồ sơ thiết bị (BM/02),
 * thiết bị quay lại trạng thái HOẠT ĐỘNG — mục 6.2.5.
 */
router.post('/:id/sign', requireRole('VAN_PHONG_CUC', 'LANH_DAO_CUC', 'DON_VI', 'NHA_THAU'), async (req, res) => {
  const rep = await one(
    `SELECT r.*, a.status AS record_status
       FROM acceptance_representatives r JOIN acceptance_records a ON a.id = r.acceptance_id
      WHERE r.acceptance_id = $1 AND r.full_name = $2`,
    [req.params.id, req.body?.fullName || req.user.name]
  );
  if (!rep) return res.status(404).json({ error: 'Không tìm thấy dòng đại diện khớp người ký' });
  if (rep.record_status === 'DA_KY') return res.status(409).json({ error: 'Biên bản đã được ký hoàn tất' });

  await one(`UPDATE acceptance_representatives SET signed = TRUE, signed_at = now() WHERE id = $1`, [rep.id]);
  const record = await one('SELECT * FROM acceptance_records WHERE id = $1', [req.params.id]);
  const [{ signed }] = await query(
    `SELECT COUNT(*)::int AS signed FROM acceptance_representatives WHERE acceptance_id = $1 AND signed = TRUE`,
    [req.params.id]
  );
  const [{ total }] = await query(
    `SELECT COUNT(*)::int AS total FROM acceptance_representatives WHERE acceptance_id = $1`,
    [req.params.id]
  );

  if (signed >= total) {
    await one(`UPDATE acceptance_records SET status = 'DA_KY' WHERE id = $1`, [record.id]);
    await one(
      `INSERT INTO equipment_logs (equipment_id, performed_date, content, performer, log_type, related_incident_id, related_plan_item_id, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [record.equipment_id, record.accepted_date,
        `[Nghiệm thu ${record.code}] ${record.work_done}`, 'Hội đồng nghiệm thu',
        record.repair_plan_id ? 'SUA_CHUA' : 'BAO_DUONG',
        record.incident_id, record.plan_item_id, req.user.id]
    );
    await one(`UPDATE equipment SET status = 'HOAT_DONG', updated_at = now() WHERE id = $1 AND status IN ('SU_CO','DANG_SUA','DANG_BAO_DUONG')`, [record.equipment_id]);
    if (record.incident_id) {
      await one(`UPDATE incidents SET status = 'DONG', resolved_at = now() WHERE id = $1`, [record.incident_id]);
      const inc = await one('SELECT code, reported_by FROM incidents WHERE id = $1', [record.incident_id]);
      if (inc) {
        await notify(inc.reported_by, {
          title: `Biên bản ${record.code} đã được ký — sự cố ${inc.code} đóng`,
          body: 'Thiết bị đã nghiệm thu đạt, trở lại trạng thái hoạt động.',
          type: 'SU_CO',
        });
      }
    }
    await req.audit({ action: 'SIGN_COMPLETE', entityType: 'acceptance_record', entityId: record.id, newValues: { code: record.code } });
    return res.json({ record: { ...record, status: 'DA_KY' }, message: 'Biên bản đã đủ chữ ký — hoàn tất nghiệm thu' });
  }

  await req.audit({ action: 'SIGN', entityType: 'acceptance_record', entityId: record.id, newValues: { signedBy: rep.full_name } });
  res.json({ record, signed, total, message: `Đã ghi nhận chữ ký (${signed}/${total})` });
});

module.exports = router;
