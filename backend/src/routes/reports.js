const express = require('express');
const { query } = require('../db');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate, requireRole('VAN_PHONG_CUC', 'LANH_DAO_CUC', 'QMS'));

/** GET /api/v1/reports/summary — 4 chỉ số cho dashboard */
router.get('/summary', async (req, res) => {
  const [equipment] = await query(
    `SELECT COUNT(*)::int AS total,
            COUNT(*) FILTER (WHERE status = 'HOAT_DONG')::int AS hoat_dong,
            COUNT(*) FILTER (WHERE status IN ('SU_CO','DANG_SUA'))::int AS dang_hong,
            COUNT(*) FILTER (WHERE status = 'NGUNG_SU_DUNG')::int AS ngung_su_dung
       FROM equipment WHERE is_active = TRUE`
  );
  const [incident] = await query(
    `SELECT COUNT(*) FILTER (WHERE status IN ('MOI','DANG_XEM_XET','CHO_DUYET','DANG_SUA','CHO_NGHIEM_THU'))::int AS dang_xu_ly,
            COUNT(*) FILTER (WHERE resolution_type = 'TU_KHAC_PHUC')::int AS tu_khac_phuc,
            COUNT(*) FILTER (WHERE resolution_type IN ('THUE_NGOAI','NOI_BO'))::int AS sua_chua_lon,
            COUNT(*) FILTER (WHERE reported_at >= date_trunc('month', now()))::int AS thang_nay
       FROM incidents`
  );
  const [plan] = await query(
    `SELECT COUNT(*)::int AS plans,
            COALESCE(SUM((SELECT COUNT(*) FROM maintenance_plan_items i WHERE i.plan_id = p.id)),0)::int AS items,
            COALESCE(SUM((SELECT COUNT(*) FROM maintenance_plan_items i WHERE i.plan_id = p.id AND i.status = 'HOAN_THANH')),0)::int AS done
       FROM maintenance_plans p`
  );
  const [cost] = await query(
    `SELECT COALESCE(SUM(estimated_cost),0)::bigint AS estimated_cost
       FROM maintenance_plan_items i JOIN maintenance_plans p ON p.id = i.plan_id WHERE p.year = EXTRACT(YEAR FROM now())::int`
  );
  res.json({ equipment, incident, plan, cost });
});

/** GET /api/v1/reports/equipment-by-department — số thiết bị theo đơn vị */
router.get('/equipment-by-department', async (req, res) => {
  const rows = await query(
    `SELECT d.name AS department, COUNT(e.id)::int AS total,
            COUNT(e.id) FILTER (WHERE e.status = 'HOAT_DONG')::int AS hoat_dong,
            COUNT(e.id) FILTER (WHERE e.status IN ('SU_CO','DANG_SUA','DANG_BAO_DUONG'))::int AS dang_xu_ly
       FROM departments d
       LEFT JOIN equipment e ON e.department_id = d.id AND e.is_active = TRUE
      GROUP BY d.name HAVING COUNT(e.id) > 0
      ORDER BY total DESC`
  );
  res.json({ data: rows });
});

/** GET /api/v1/reports/incident-frequency — tần suất sự cố theo tháng (12 tháng gần nhất) */
router.get('/incident-frequency', async (req, res) => {
  const rows = await query(
    `SELECT to_char(date_trunc('month', reported_at), 'MM/YYYY') AS month,
            COUNT(*)::int AS total,
            COUNT(*) FILTER (WHERE resolution_type = 'TU_KHAC_PHUC')::int AS tu_khac_phuc,
            COUNT(*) FILTER (WHERE resolution_type IN ('THUE_NGOAI','NOI_BO'))::int AS sua_chua
       FROM incidents
      WHERE reported_at >= date_trunc('month', now()) - INTERVAL '11 months'
      GROUP BY date_trunc('month', reported_at)
      ORDER BY date_trunc('month', reported_at)`
  );
  res.json({ data: rows });
});

/** GET /api/v1/reports/plan-progress — tiến độ kế hoạch theo năm */
router.get('/plan-progress', async (req, res) => {
  const year = req.query.year || new Date().getFullYear();
  const rows = await query(
    `SELECT e.name AS equipment, e.code AS equipment_code, d.name AS department,
            i.content, i.executor_type, i.planned_month, i.status, i.estimated_cost
       FROM maintenance_plan_items i
       JOIN maintenance_plans p ON p.id = i.plan_id
       JOIN equipment e ON e.id = i.equipment_id
       LEFT JOIN departments d ON d.id = i.department_id
      WHERE p.year = $1 ORDER BY i.planned_month NULLS LAST`,
    [year]
  );
  res.json({ data: rows });
});

/** GET /api/v1/reports/audit — nhật ký thao tác (QMS kiểm soát tài liệu) */
router.get('/audit', requireRole('QMS', 'VAN_PHONG_CUC'), async (req, res) => {
  const rows = await query(
    `SELECT a.*, u.full_name AS user_name, u.username
       FROM audit_logs a LEFT JOIN users u ON u.id = a.user_id
      ORDER BY a.created_at DESC LIMIT 200`
  );
  res.json({ data: rows });
});

module.exports = router;
