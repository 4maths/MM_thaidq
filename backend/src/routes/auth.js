const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const config = require('../config');
const { one } = require('../db');
const { authenticate } = require('../middleware/auth');
const { logAudit } = require('../middleware/audit');

const router = express.Router();

/**
 * POST /api/v1/auth/login
 * Đăng nhập nội bộ (mô phỏng SSO/AD của Cục ở giai đoạn mở rộng).
 */
router.post('/login', async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'Thiếu tên đăng nhập hoặc mật khẩu' });

  const user = await one(
    `SELECT u.id, u.username, u.password_hash, u.full_name, u.email, u.is_active,
            r.code AS role, r.name AS role_name, d.name AS department_name, u.department_id
       FROM users u
       JOIN roles r ON r.id = u.role_id
       LEFT JOIN departments d ON d.id = u.department_id
      WHERE u.username = $1`,
    [username]
  );
  if (!user || !user.is_active || !(await bcrypt.compare(password, user.password_hash))) {
    return res.status(401).json({ error: 'Tên đăng nhập hoặc mật khẩu không đúng' });
  }

  const token = jwt.sign(
    { id: user.id, username: user.username, name: user.full_name, role: user.role, departmentId: user.department_id },
    config.jwt.secret,
    { expiresIn: config.jwt.expiresIn }
  );

  await logAudit({
    userId: user.id, action: 'LOGIN', entityType: 'user', entityId: user.id,
    newValues: { username: user.username }, ip: req.ip,
  });

  res.json({
    token,
    user: {
      id: user.id, username: user.username, name: user.full_name, email: user.email,
      role: user.role, roleName: user.role_name, department: user.department_name,
    },
  });
});

/** GET /api/v1/auth/me — thông tin người dùng hiện tại */
router.get('/me', authenticate, async (req, res) => {
  const user = await one(
    `SELECT u.id, u.username, u.full_name, u.email, u.phone, r.code AS role, r.name AS role_name, d.name AS department
       FROM users u JOIN roles r ON r.id = u.role_id
       LEFT JOIN departments d ON d.id = u.department_id
      WHERE u.id = $1`,
    [req.user.id]
  );
  res.json({ user });
});

module.exports = router;
