const express = require('express');
const { query, one } = require('../db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

/** GET /api/v1/notifications — thông báo của người dùng hiện tại */
router.get('/', async (req, res) => {
  const rows = await query(
    `SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50`,
    [req.user.id]
  );
  const [{ unread }] = await query(
    `SELECT COUNT(*)::int AS unread FROM notifications WHERE user_id = $1 AND is_read = FALSE`,
    [req.user.id]
  );
  res.json({ data: rows, unread });
});

/** PATCH /api/v1/notifications/:id/read */
router.patch('/:id/read', async (req, res) => {
  const updated = await one(
    `UPDATE notifications SET is_read = TRUE WHERE id = $1 AND user_id = $2 RETURNING id`,
    [req.params.id, req.user.id]
  );
  if (!updated) return res.status(404).json({ error: 'Không tìm thấy thông báo' });
  res.json({ ok: true });
});

module.exports = router;
