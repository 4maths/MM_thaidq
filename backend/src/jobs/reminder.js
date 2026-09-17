const cron = require('node-cron');
const { query, pool } = require('../db');
const { notify, notifyRole } = require('../utils/helpers');

/**
 * Job nhắc lịch bảo dưỡng định kỳ — mục tiêu "cảnh báo/nhắc lịch, tránh bỏ sót".
 * Chạy 07:00 mỗi ngày: tìm hạng mục kế hoạch đã duyệt dự kiến trong tháng hiện tại
 * mà chưa hoàn thành (hoặc trễ), gửi thông báo cho Văn phòng Cục + đơn vị sử dụng.
 */
async function remindDueMaintenance() {
  const rows = await query(
    `SELECT i.id, i.content, i.planned_month, i.status,
            e.code AS equipment_code, e.name AS equipment_name,
            d.id AS department_id, d.name AS department_name, p.year
       FROM maintenance_plan_items i
       JOIN maintenance_plans p ON p.id = i.plan_id
       JOIN equipment e ON e.id = i.equipment_id
       LEFT JOIN departments d ON d.id = i.department_id
      WHERE p.status = 'DA_DUYET'
        AND i.status IN ('CHO_THUC_HIEN','TRE_TIEN_DO')
        AND i.planned_month = EXTRACT(MONTH FROM now())::int`
  );
  if (!rows.length) return 0;

  for (const item of rows) {
    const title = `Nhắc lịch bảo dưỡng: ${item.equipment_name} (${item.equipment_code})`;
    const body = `Hạng mục "${item.content}" dự kiến tháng ${item.planned_month}/${item.year} chưa hoàn thành.`;
    await notifyRole('VAN_PHONG_CUC', { title, body, type: 'NHAC_BAO_DUONG', link: `/ke-hoach/${item.id}` });
    if (item.department_id) {
      const users = await query(`SELECT id FROM users WHERE department_id = $1 AND is_active = TRUE`, [item.department_id]);
      for (const u of users) {
        await notify(pool, { userId: u.id, title, body, type: 'NHAC_BAO_DUONG', link: `/ke-hoach/${item.id}` });
      }
    }
  }
  console.log(`[reminder] Đã gửi ${rows.length} nhắc lịch bảo dưỡng`);
  return rows.length;
}

function startReminderJob() {
  // 0 7 * * * — 07:00 mỗi ngày
  cron.schedule('0 7 * * *', () => remindDueMaintenance().catch((e) => console.error('[reminder]', e)));
  console.log('[reminder] Job nhắc lịch bảo dưỡng đã khởi động (07:00 hằng ngày)');
}

module.exports = { remindDueMaintenance, startReminderJob };
