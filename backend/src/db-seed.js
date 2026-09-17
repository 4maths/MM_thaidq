// Nạp dữ liệu mẫu theo thứ tự tên file trong db/seeds
const fs = require('fs');
const path = require('path');
const { pool } = require('./db');

async function seed() {
  // Idempotent: bỏ qua nếu dữ liệu mẫu đã nạp (tránh trùng khi restart container)
  const { rows } = await pool.query('SELECT COUNT(*)::int AS count FROM users');
  if (rows[0].count > 0) {
    console.log('= seed: dữ liệu mẫu đã tồn tại, bỏ qua');
    await pool.end();
    return;
  }
  const dir = path.join(__dirname, '..', 'db', 'seeds');
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
  for (const file of files) {
    const sql = fs.readFileSync(path.join(dir, file), 'utf8');
    try {
      await pool.query(sql);
      console.log(`✓ seed ${file}`);
    } catch (err) {
      console.error(`✗ seed ${file}: ${err.message}`);
      process.exitCode = 1;
    }
  }
  await pool.end();
}

seed();
