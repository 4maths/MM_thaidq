const express = require('express');
const bcrypt = require('bcryptjs');
const { query, one } = require('../db');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

/** GET /api/v1/departments — danh mục đơn vị (dùng cho filter/form) */
router.get('/departments', async (req, res) => {
  res.json({ data: await query('SELECT id, code, name FROM departments ORDER BY code') });
});

/** GET /api/v1/users — quản lý người dùng & phân quyền (Văn phòng Cục / QMS) */
router.get('/users', requireRole('VAN_PHONG_CUC', 'QMS'), async (req, res) => {
  const rows = await query(
    `SELECT u.id, u.username, u.full_name, u.email, u.phone, u.is_active, u.created_at,
            r.code AS role, r.name AS role_name, d.name AS department_name
       FROM users u JOIN roles r ON r.id = u.role_id
       LEFT JOIN departments d ON d.id = u.department_id
      ORDER BY u.id`
  );
  res.json({ data: rows });
});

/** POST /api/v1/users — tạo tài khoản (Văn phòng Cục) */
router.post('/users', requireRole('VAN_PHONG_CUC'), async (req, res) => {
  const { username, password, fullName, email, phone, role, departmentId } = req.body || {};
  if (!username || !password || !fullName || !role) {
    return res.status(400).json({ error: 'Thiếu tên đăng nhập / mật khẩu / họ tên / vai trò' });
  }
  const dup = await one('SELECT id FROM users WHERE username = $1', [username]);
  if (dup) return res.status(409).json({ error: `Tài khoản ${username} đã tồn tại` });

  const created = await one(
    `INSERT INTO users (username, password_hash, full_name, email, phone, role_id, department_id)
     VALUES ($1,$2,$3,$4,$5,(SELECT id FROM roles WHERE code=$6),$7)
     RETURNING id, username, full_name`,
    [username, await bcrypt.hash(password, 10), fullName, email || null, phone || null, role, departmentId || null]
  );
  await req.audit({ action: 'CREATE', entityType: 'user', entityId: created.id, newValues: { username, role } });
  res.status(201).json({ user: created });
});

/** PATCH /api/v1/users/:id — khoá/mở tài khoản hoặc đổi vai trò (Văn phòng Cục) */
router.patch('/users/:id', requireRole('VAN_PHONG_CUC'), async (req, res) => {
  const { isActive, role } = req.body || {};
  const updated = await one(
    `UPDATE users SET
        is_active = COALESCE($2, is_active),
        role_id = COALESCE((SELECT id FROM roles WHERE code = $3), role_id)
      WHERE id = $1 RETURNING id, username, full_name, is_active`,
    [req.params.id, isActive, role || null]
  );
  if (!updated) return res.status(404).json({ error: 'Không tìm thấy người dùng' });
  await req.audit({ action: 'UPDATE', entityType: 'user', entityId: updated.id, newValues: updated });
  res.json({ user: updated });
});

/** GET /api/v1/vendors — danh mục nhà thầu ngoài */
router.get('/vendors', async (req, res) => {
  res.json({ data: await query('SELECT * FROM vendors WHERE is_active = TRUE ORDER BY name') });
});

/** POST /api/v1/vendors — thêm nhà thầu (Văn phòng Cục) */
router.post('/vendors', requireRole('VAN_PHONG_CUC'), async (req, res) => {
  const { name, taxCode, address, phone, email, contactPerson } = req.body || {};
  if (!name) return res.status(400).json({ error: 'Thiếu tên nhà thầu' });
  const created = await one(
    `INSERT INTO vendors (name, tax_code, address, phone, email, contact_person)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [name, taxCode || null, address || null, phone || null, email || null, contactPerson || null]
  );
  await req.audit({ action: 'CREATE', entityType: 'vendor', entityId: created.id, newValues: { name } });
  res.status(201).json({ vendor: created });
});

module.exports = router;
