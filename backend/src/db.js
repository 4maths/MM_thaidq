const { Pool } = require('pg');
const config = require('./config');

const pool = new Pool({ ...config.db, max: 10 });

/** Query helper: trả về các row cho SELECT, row[0] cho INSERT/UPDATE ... RETURNING */
async function query(text, params = []) {
  const result = await pool.query(text, params);
  return result.rows;
}

async function one(text, params = []) {
  const rows = await query(text, params);
  return rows[0] || null;
}

/** Chạy nhiều câu trong một transaction */
async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { pool, query, one, withTransaction };
