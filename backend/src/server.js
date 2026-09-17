const express = require('express');
require('express-async-errors');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const config = require('./config');
const { attachAudit } = require('./middleware/audit');
const { pool } = require('./db');
const { startReminderJob } = require('./jobs/reminder');

const app = express();
app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(attachAudit);

// File đính kèm tải xuống qua route (không expose thư mục trực tiếp)
const uploadDir = path.isAbsolute(config.uploadDir)
  ? config.uploadDir
  : path.join(__dirname, '..', config.uploadDir);

// ---- Routes ----
const api = express.Router();
api.get('/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', db: 'connected', time: new Date().toISOString() });
  } catch (e) {
    res.status(500).json({ status: 'error', db: 'disconnected', message: e.message });
  }
});
api.use('/auth', require('./routes/auth'));
api.use('/equipment', require('./routes/equipment'));
api.use('/plans', require('./routes/plans'));
api.use('/incidents', require('./routes/incidents'));
api.use('/repair-plans', require('./routes/repair-plans'));
api.use('/acceptances', require('./routes/acceptances'));
api.use('/', require('./routes/admin'));       // /departments, /users, /vendors
api.use('/reports', require('./routes/reports'));
api.use('/attachments', require('./routes/attachments'));
api.use('/notifications', require('./routes/notifications'));
app.use('/api/v1', api);

// 404 JSON cho API
app.use('/api', (_req, res) => res.status(404).json({ error: 'Endpoint không tồn tại' }));

// Xử lý lỗi tập trung
app.use((err, _req, res, _next) => {
  console.error('[error]', err);
  const status = err.status || (err.code === '23505' ? 409 : 500);
  res.status(status).json({ error: err.status ? err.message : 'Lỗi hệ thống, vui lòng thử lại sau' });
});

const port = config.port;
app.listen(port, () => {
  console.log(`API hệ thống quản lý trang thiết bị (QT.QLD.09.01) đang chạy tại http://localhost:${port}/api/v1`);
  startReminderJob();
});
