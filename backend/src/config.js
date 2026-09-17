require('dotenv').config();

module.exports = {
  port: process.env.PORT || 3000,
  db: {
    host: process.env.PGHOST || 'localhost',
    port: process.env.PGPORT || 5432,
    database: process.env.PGDATABASE || 'qltt',
    user: process.env.PGUSER || 'qltt',
    password: process.env.PGPASSWORD || 'qltt_secret',
  },
  jwt: {
    secret: process.env.JWT_SECRET || 'dev-only-secret-change-me',
    expiresIn: process.env.JWT_EXPIRES || '8h',
  },
  uploadDir: process.env.UPLOAD_DIR || 'uploads',
};
