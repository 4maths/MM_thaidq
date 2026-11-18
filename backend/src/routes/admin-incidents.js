const express = require('express');
const { query, one } = require('../db');
const { authenticate, requireRole } = require('../middleware/auth');
const { notify } = require('../utils/helpers');

const router = express.Router();
router.use(authenticate, requireRole('VAN_PHONG_CUC', 'LANH_DAO_CUC', 'QMS'));

/**
 * GET /api/admin/incidents/technicians — Danh sách cán bộ kỹ thuật để phân công (UC-04.2).
 */
router.get('/technicians', async (_req, res) => {
  const rows = await query(
    `SELECT u.id, u.username, u.full_name, u.email, u.phone, r.code AS role_code, r.name AS role_name
       FROM users u
       JOIN roles r ON r.id = u.role_id
      WHERE u.is_active = TRUE
      ORDER BY (r.code = 'VAN_PHONG_CUC') DESC, u.full_name ASC`
  );
  res.json({ data: rows });
});

/**
 * GET /api/admin/incidents — Danh sách sự cố cho bảng điều phối (UC-04, FR-04.1).
 * Hỗ trợ lọc theo phòng ban, trạng thái, thời gian, cán bộ phụ trách, nguồn báo.
 */
router.get('/', async (req, res) => {
  const {
    status,
    departmentId,
    department_id,
    technicianId,
    technician_id,
    source,
    from,
    dateFrom,
    to,
    dateTo,
    q,
    page = 1,
    pageSize = 50,
  } = req.query;

  const conditions = ['1=1'];
  const params = [];

  const dept = departmentId || department_id;
  if (dept) {
    params.push(dept);
    conditions.push(`i.department_id = $${params.length}`);
  }

  if (status) {
    params.push(status);
    // Hỗ trợ alias MOI tương đương MOI_TIEP_NHAN
    if (status === 'MOI_TIEP_NHAN' || status === 'MOI') {
      conditions.push(`i.status IN ('MOI_TIEP_NHAN', 'MOI')`);
      params.pop();
    } else {
      conditions.push(`i.status = $${params.length}`);
    }
  }

  const tech = technicianId || technician_id;
  if (tech) {
    params.push(tech);
    conditions.push(`i.technician_id = $${params.length}`);
  }

  if (source) {
    params.push(source);
    conditions.push(`i.source = $${params.length}`);
  }

  const startDate = from || dateFrom;
  if (startDate) {
    params.push(startDate);
    conditions.push(`i.reported_at >= $${params.length}::date`);
  }

  const endDate = to || dateTo;
  if (endDate) {
    params.push(endDate);
    conditions.push(`i.reported_at < ($${params.length}::date + INTERVAL '1 day')`);
  }

  if (q) {
    params.push(`%${q}%`);
    conditions.push(
      `(i.code ILIKE $${params.length} OR i.lookup_code ILIKE $${params.length} OR e.code ILIKE $${params.length} OR e.name ILIKE $${params.length} OR i.reporter_name ILIKE $${params.length})`
    );
  }

  const where = conditions.join(' AND ');
  const limit = Math.min(parseInt(pageSize, 10) || 50, 100);
  const offset = ((parseInt(page, 10) || 1) - 1) * limit;

  const rows = await query(
    `SELECT
        i.id, i.code, i.status, i.severity, i.issue_type, i.source,
        i.description, i.resolution_notes, i.detected_at, i.lookup_code,
        i.reporter_name, i.reporter_phone,
        i.reported_at, i.reviewed_at, i.resolved_at, i.updated_at,
        e.id AS equipment_id,
        e.code AS equipment_code,
        e.name AS equipment_name,
        e.status AS equipment_status,
        d.id AS department_id,
        d.name AS department_name,
        u.full_name AS reported_by_name,
        t.id AS technician_id,
        t.full_name AS technician_name,
        rv.full_name AS reviewed_by_name,
        rp.id AS repair_plan_id,
        rp.status AS repair_plan_status,
        COALESCE(
          (SELECT json_agg(json_build_object(
            'id', a.id,
            'file_name', a.file_name,
            'file_path', a.file_path,
            'mime_type', a.mime_type,
            'file_size', a.file_size
          ))
          FROM attachments a
          WHERE a.entity_type = 'incident' AND a.entity_id = i.id),
          '[]'::json
        ) AS attachments
       FROM incidents i
       JOIN equipment e ON e.id = i.equipment_id
       LEFT JOIN departments d ON d.id = i.department_id
       LEFT JOIN users u ON u.id = i.reported_by
       LEFT JOIN users t ON t.id = i.technician_id
       LEFT JOIN users rv ON rv.id = i.reviewed_by
       LEFT JOIN repair_plans rp ON rp.incident_id = i.id
      WHERE ${where}
      ORDER BY
        CASE i.status
          WHEN 'MOI_TIEP_NHAN' THEN 1
          WHEN 'MOI' THEN 1
          WHEN 'DANG_XEM_XET' THEN 2
          WHEN 'DANG_SUA' THEN 3
          WHEN 'CHO_DUYET' THEN 4
          WHEN 'CHO_NGHIEM_THU' THEN 5
          WHEN 'DA_XU_LY' THEN 6
          WHEN 'DONG' THEN 7
          ELSE 8
        END,
        i.reported_at DESC
      LIMIT ${limit} OFFSET ${offset}`,
    params
  );

  const [{ count }] = await query(
    `SELECT COUNT(*)::int AS count
       FROM incidents i
       JOIN equipment e ON e.id = i.equipment_id
      WHERE ${where}`,
    params
  );

  res.json({
    data: rows,
    total: count,
    page: parseInt(page, 10) || 1,
    pageSize: limit,
  });
});

/**
 * PATCH /api/admin/incidents/:id/assign — Phân công cán bộ kỹ thuật tiếp nhận và xử lý (UC-04.2, FR-04.2).
 */
router.patch('/:id/assign', requireRole('VAN_PHONG_CUC'), async (req, res) => {
  const { technicianId, technician_id } = req.body || {};
  const targetTechId = technicianId || technician_id;

  if (!targetTechId) {
    return res.status(400).json({ error: 'Vui lòng chọn cán bộ kỹ thuật phụ trách' });
  }

  const tech = await one('SELECT id, full_name, email FROM users WHERE id = $1 AND is_active = TRUE', [targetTechId]);
  if (!tech) {
    return res.status(404).json({ error: 'Cán bộ kỹ thuật không tồn tại hoặc tài khoản đã bị khóa' });
  }

  const incident = await one('SELECT * FROM incidents WHERE id = $1', [req.params.id]);
  if (!incident) {
    return res.status(404).json({ error: 'Không tìm thấy phiếu sự cố' });
  }

  // Tự động chuyển trạng thái sang DANG_SUA theo quy tắc 3.4.1 (MOI_TIEP_NHAN -> DANG_SUA)
  const isInitial = incident.status === 'MOI_TIEP_NHAN' || incident.status === 'MOI' || incident.status === 'DANG_XEM_XET';
  const nextStatus = isInitial ? 'DANG_SUA' : incident.status;

  const updated = await one(
    `UPDATE incidents
        SET technician_id = $2,
            status = $3,
            reviewed_by = COALESCE(reviewed_by, $4),
            reviewed_at = COALESCE(reviewed_at, now()),
            updated_at = now()
      WHERE id = $1
      RETURNING *`,
    [req.params.id, targetTechId, nextStatus, req.user.id]
  );

  // Cập nhật trạng thái thiết bị sang DANG_SUA nếu đang là SU_CO (Mục 3.4.1)
  await one(
    `UPDATE equipment SET status = 'DANG_SUA', updated_at = now()
      WHERE id = $1 AND status = 'SU_CO'`,
    [incident.equipment_id]
  );

  // Gửi thông báo cho cán bộ kỹ thuật được phân công
  await notify(targetTechId, {
    title: `Phân công xử lý sự cố ${incident.code}`,
    body: `Bạn được phân công xử lý sự cố: ${incident.description.slice(0, 100)}`,
    type: 'SU_CO',
    link: `/su-co/${incident.id}`,
  });

  await req.audit({
    action: 'ASSIGN_TECHNICIAN',
    entityType: 'incident',
    entityId: updated.id,
    oldValues: { technician_id: incident.technician_id, status: incident.status },
    newValues: { technician_id: targetTechId, technician_name: tech.full_name, status: nextStatus },
  });

  res.json({
    incident: updated,
    technician: tech,
    message: `Đã phân công cán bộ ${tech.full_name} tiếp nhận xử lý sự cố ${incident.code}`,
  });
});

/**
 * PATCH /api/admin/incidents/:id/status — Cập nhật tiến độ xử lý và đồng bộ lý lịch thiết bị (UC-04, FR-04.3, FR-04.4).
 * Tuân thủ nghiêm ngặt quy tắc chuyển trạng thái tại Mục 3.4.1 (Incident State Rules).
 */
router.patch('/:id/status', requireRole('VAN_PHONG_CUC', 'LANH_DAO_CUC'), async (req, res) => {
  const { status, resolutionNotes, resolution_notes } = req.body || {};
  const notes = resolutionNotes || resolution_notes;

  const validStatuses = ['MOI_TIEP_NHAN', 'MOI', 'DANG_XEM_XET', 'DANG_SUA', 'CHO_DUYET', 'CHO_NGHIEM_THU', 'DA_XU_LY', 'DONG'];
  if (!status || !validStatuses.includes(status)) {
    return res.status(400).json({ error: `Trạng thái không hợp lệ. Cho phép: ${validStatuses.join(', ')}` });
  }

  const old = await one('SELECT * FROM incidents WHERE id = $1', [req.params.id]);
  if (!old) {
    return res.status(404).json({ error: 'Không tìm thấy phiếu sự cố' });
  }

  const isResolvedOrClosed = ['DA_XU_LY', 'DONG'].includes(status);
  const wasResolvedOrClosed = ['DA_XU_LY', 'DONG'].includes(old.status);
  const isReopened = !isResolvedOrClosed && wasResolvedOrClosed; // Mở lại phiếu khi lỗi tái xuất hiện (Mục 3.4.1)

  const updated = await one(
    `UPDATE incidents
        SET status = $2,
            resolution_notes = COALESCE($3, resolution_notes),
            resolved_at = CASE WHEN $2 IN ('DA_XU_LY', 'DONG') AND resolved_at IS NULL THEN now() ELSE resolved_at END,
            updated_at = now()
      WHERE id = $1
      RETURNING *`,
    [req.params.id, status, notes || null]
  );

  let logCreated = null;

  // 1. DANG_SUA -> DA_XU_LY / DONG: Ghi một dòng lịch sử nguồn vào equipment_logs (Mục 3.4.1)
  // Quy tắc: DA_XU_LY -> DONG không sinh thêm dòng lý lịch trùng.
  if (isResolvedOrClosed && !wasResolvedOrClosed) {
    // Kiểm tra xem đã có bản ghi lý lịch nào từ sự cố này chưa (chống ghi trùng - NFR-05)
    const existingLog = await one(
      'SELECT id FROM equipment_logs WHERE related_incident_id = $1',
      [old.id]
    );

    if (!existingLog) {
      const tech = old.technician_id
        ? await one('SELECT full_name FROM users WHERE id = $1', [old.technician_id])
        : null;
      const performer = tech ? tech.full_name : req.user.name;

      const logContent = notes
        ? `[Khắc phục sự cố ${old.code}] ${notes}`
        : `[Khắc phục sự cố ${old.code}] Hoàn thành xử lý sự cố: ${old.description}`;

      logCreated = await one(
        `INSERT INTO equipment_logs
           (equipment_id, performed_date, content, performer, log_type, related_incident_id, created_by)
         VALUES ($1, now()::date, $2, $3, 'KHAC_PHUC_SU_CO', $4, $5)
         RETURNING *`,
        [old.equipment_id, logContent, performer, old.id, req.user.id]
      );
    }

    // 2. Kiểm tra điều kiện phục hồi trạng thái thiết bị sang HOAT_DONG (Mục 3.4.1):
    // "Còn phiếu mở: không tự phục hồi HOAT_DONG. Ngừng sử dụng hoặc thanh lý: giữ trạng thái đó, không ghi đè khi đóng phiếu."
    const [{ open_count }] = await query(
      `SELECT COUNT(*)::int AS open_count
         FROM incidents
        WHERE equipment_id = $1
          AND id != $2
          AND status NOT IN ('DA_XU_LY', 'DONG')`,
      [old.equipment_id, old.id]
    );

    if (open_count === 0) {
      // Chỉ phục hồi HOAT_DONG nếu không ngừng sử dụng hoặc thanh lý
      await one(
        `UPDATE equipment
            SET status = 'HOAT_DONG', updated_at = now()
          WHERE id = $1 AND status NOT IN ('NGUNG_SU_DUNG', 'THANH_LY')`,
        [old.equipment_id]
      );
    }
  }

  // 3. Xử lý mở lại phiếu (DA_XU_LY / DONG -> DANG_SUA) theo Mục 3.4.1:
  // "Mở lại có lý do khi chưa đạt hoặc lỗi tái xuất hiện; giữ lịch sử và ghi dấu vết."
  if (isReopened) {
    await one(
      `UPDATE equipment
          SET status = 'DANG_SUA', updated_at = now()
        WHERE id = $1 AND status NOT IN ('NGUNG_SU_DUNG', 'THANH_LY')`,
      [old.equipment_id]
    );
  }

  await req.audit({
    action: isReopened ? 'REOPEN_INCIDENT' : 'UPDATE_INCIDENT_STATUS',
    entityType: 'incident',
    entityId: updated.id,
    oldValues: { status: old.status, resolution_notes: old.resolution_notes },
    newValues: { status: updated.status, resolution_notes: updated.resolution_notes, note: notes },
  });

  res.json({
    incident: updated,
    equipment_log: logCreated,
    message: `Đã cập nhật trạng thái sự cố sang ${status}`,
  });
});

module.exports = router;
