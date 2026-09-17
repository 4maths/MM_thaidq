const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const config = require('../config');
const { query, one } = require('../db');
const { authenticate } = require('../middleware/auth');

const uploadDir = path.isAbsolute(config.uploadDir)
  ? config.uploadDir
  : path.join(__dirname, '..', '..', config.uploadDir);
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const safe = file.originalname.replace(/[^\w.\-À-ỹà-ỹ ]+/g, '_');
    cb(null, `${Date.now()}-${safe}`);
  },
});
const upload = multer({ storage, limits: { fileSize: 20 * 1024 * 1024 } });

const router = express.Router();
router.use(authenticate);

/** POST /api/v1/attachments — tải lên file đính kèm (hóa đơn, ảnh sự cố, biên bản scan) */
router.post('/', upload.single('file'), async (req, res) => {
  const { entityType, entityId } = req.body || {};
  if (!req.file || !entityType || !entityId) {
    return res.status(400).json({ error: 'Thiếu file hoặc thông tin đối tượng (entityType, entityId)' });
  }
  const created = await one(
    `INSERT INTO attachments (entity_type, entity_id, file_name, file_path, mime_type, file_size, uploaded_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id, file_name, file_path`,
    [entityType, entityId, req.file.originalname, req.file.filename, req.file.mimetype, req.file.size, req.user.id]
  );
  await req.audit({ action: 'CREATE', entityType: 'attachment', entityId: created.id, newValues: created });
  res.status(201).json({ attachment: created });
});

/** GET /api/v1/attachments?entityType=&entityId= — liệt kê đính kèm của một đối tượng */
router.get('/', async (req, res) => {
  const { entityType, entityId } = req.query;
  if (!entityType || !entityId) return res.status(400).json({ error: 'Thiếu entityType/entityId' });
  const rows = await query(
    `SELECT a.id, a.entity_type, a.entity_id, a.file_name, a.mime_type, a.file_size, a.uploaded_at,
            u.full_name AS uploaded_by_name
       FROM attachments a LEFT JOIN users u ON u.id = a.uploaded_by
      WHERE a.entity_type = $1 AND a.entity_id = $2 ORDER BY a.uploaded_at DESC`,
    [entityType, entityId]
  );
  res.json({ data: rows });
});

/** GET /api/v1/attachments/:id/download — tải file */
router.get('/:id/download', async (req, res) => {
  const file = await one('SELECT * FROM attachments WHERE id = $1', [req.params.id]);
  if (!file) return res.status(404).json({ error: 'Không tìm thấy file' });
  res.download(path.join(uploadDir, file.file_path), file.file_name);
});

module.exports = router;
