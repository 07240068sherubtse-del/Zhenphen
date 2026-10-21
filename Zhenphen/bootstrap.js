const { pool } = require('./db');

async function bootstrapAdministrator(emailKey, passwordKey, nameKey, role, memberType) {
  const email = process.env[emailKey]?.trim().toLowerCase();
  const password = process.env[passwordKey];
  if (!email && !password) return;
  if (!email || !password || password.length < 12 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error(`${emailKey} and ${passwordKey} must be configured with a valid email and a password of at least 12 characters.`);
  }
  const bcrypt = require('bcryptjs');
  const passwordHash = await bcrypt.hash(password, 12);
  const name = process.env[nameKey]?.trim().slice(0, 120)
    || (role === 'ssuAdmin' ? 'SSU Coordinator' : 'Zhenphen Administrator');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const existingAdmins = await client.query(
      'SELECT id FROM users WHERE role = $1 ORDER BY created_at DESC, id DESC FOR UPDATE',
      [role]
    );
    // Bootstrap is create-only: never merge users or reset an existing password on restart.
    if (existingAdmins.rowCount > 0) {
      await client.query('COMMIT');
      return;
    }
    const existingEmail = await client.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existingEmail.rowCount) throw new Error(`${emailKey} belongs to an existing account. Assign its role through the administrator workflow.`);
    await client.query(
      `INSERT INTO users (name, email, password_hash, role, member_type, email_verified)
       VALUES ($1, $2, $3, $4, $5, TRUE)`,
      [name, email, passwordHash, role, memberType]
    );
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

module.exports = { bootstrapAdministrator };
