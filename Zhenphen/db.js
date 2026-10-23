const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required. Configure a PostgreSQL database before starting the server.');
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' && process.env.DATABASE_SSL !== 'false'
    ? { rejectUnauthorized: true }
    : undefined,
  max: Number(process.env.PG_POOL_SIZE || 10),
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000
});

async function initializeDatabase() {
  const schema = fs.readFileSync(path.join(__dirname, 'migrations', '001_initial.sql'), 'utf8');
  await pool.query(schema);
  await require('./services/projectEvidence').importProvidedEvidence(pool);
}

module.exports = { pool, initializeDatabase };
