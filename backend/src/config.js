require('dotenv').config();

module.exports = {
  publicEquipmentBaseUrl:
  process.env.PUBLIC_EQUIPMENT_BASE_URL ||
  'http://localhost:3000/api/v1/public/equipment',

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
