const express = require('express');
const path = require('path');
const session = require('express-session');
const connectPgSimple = require('connect-pg-simple');
const helmet = require('helmet');
const crypto = require('crypto');
require('dotenv').config();
const { pool, initializeDatabase } = require('./db');
const apiRoutes = require('./routes/api');
const adminRoutes = require('./routes/admin');
const ssuRoutes = require('./routes/ssu');
const { apiError } = require('./middleware/api');

const app = express();
const PORT = process.env.PORT || 3000;
const PgSession = connectPgSimple(session);

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.set('trust proxy', 1);

app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: false, limit: '32kb' }));
app.use(session({
  store: new PgSession({
    pool,
    tableName: 'user_sessions',
    createTableIfMissing: true,
    pruneSessionInterval: 15 * 60
  }),
  name: 'zhenphen.sid',
  secret: process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex'),
  resave: false,
  saveUninitialized: false,
  rolling: true,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 8 * 60 * 60 * 1000
  }
}));

app.use('/api', (req, res, next) => {
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method) || !req.get('origin')) return next();
  const expectedOrigin = `${req.protocol}://${req.get('host')}`;
  if (req.get('origin') !== expectedOrigin) return res.status(403).json({ error: 'Cross-site requests are not allowed.' });
  next();
});

app.use('/api', async (req, res, next) => {
  if (!req.session.userId) return next();
  try {
    const result = await pool.query(
      `SELECT id, name, email, role, member_type AS "memberType", phone, bio, skills
       FROM users WHERE id = $1`,
      [req.session.userId]
    );
    req.user = result.rows[0] || null;
    next();
  } catch (error) {
    next(error);
  }
});

app.use('/api', apiRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/ssu', ssuRoutes);
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(path.join(__dirname, 'views')));
app.use('/', require('./routes'));

app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ ok: true, service: 'zhenphen', database: 'connected' });
  } catch (error) {
    console.error('Health check failed:', error);
    res.status(503).json({ ok: false, service: 'zhenphen', database: 'unavailable' });
  }
});

app.use('/api', (req, res) => res.status(404).json({ error: 'API endpoint not found.' }));
app.use(apiError);

async function start() {
  if (process.env.NODE_ENV === 'production' && (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32)) {
    throw new Error('SESSION_SECRET must be configured with at least 32 characters in production.');
  }
  await initializeDatabase();
  const administratorEmails = [
    process.env.SSU_ADMIN_EMAIL,
    process.env.SITE_ADMIN_EMAIL
  ].filter(Boolean).map(email => email.trim().toLowerCase());
  if (new Set(administratorEmails).size !== administratorEmails.length) {
    throw new Error('SSU_ADMIN_EMAIL and SITE_ADMIN_EMAIL must be different accounts.');
  }
  await bootstrapAdministrator('SSU_ADMIN_EMAIL', 'SSU_ADMIN_PASSWORD', 'SSU_ADMIN_NAME', 'ssuAdmin', 'Sherubtse Social Service Unit administrator');
  await bootstrapAdministrator('SITE_ADMIN_EMAIL', 'SITE_ADMIN_PASSWORD', 'SITE_ADMIN_NAME', 'admin', 'Zhenphen administrator');
  const requestedPort = Number(PORT);
  if (!Number.isInteger(requestedPort) || requestedPort < 0 || requestedPort > 65535) {
    throw new Error('PORT must be a valid TCP port between 0 and 65535.');
  }
  const allowPortFallback = process.env.NODE_ENV !== 'production' && requestedPort > 0;
  const lastFallbackPort = Math.min(requestedPort + 20, 65535);
  for (let port = requestedPort; ; port += 1) {
    try {
      const server = await listenOnPort(port);
      const actualPort = server.address().port;
      if (requestedPort > 0 && actualPort !== requestedPort) {
        console.warn(`Port ${requestedPort} is already in use; using port ${actualPort} instead.`);
      }
      console.log(`Zhenphen server running at http://localhost:${actualPort}`);
      return;
    } catch (error) {
      if (error.code !== 'EADDRINUSE' || !allowPortFallback || port >= lastFallbackPort) {
        throw error;
      }
    }
  }
}

function listenOnPort(port) {
  return new Promise((resolve, reject) => {
    const server = app.listen(port);
    const onListening = () => {
      server.removeListener('error', onError);
      resolve(server);
    };
    const onError = error => {
      server.removeListener('listening', onListening);
      reject(error);
    };
    server.once('listening', onListening);
    server.once('error', onError);
  });
}

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
    if (existingAdmins.rowCount > 1 && role !== 'ssuAdmin') {
      throw new Error(`Multiple ${role} accounts exist; resolve them before bootstrapping the configured administrator.`);
    }
    if (existingAdmins.rowCount > 0) {
      const [latestAdmin, ...olderAdmins] = existingAdmins.rows;
      for (const olderAdmin of olderAdmins) {
        await client.query(
          'UPDATE ssu_events SET created_by = $1 WHERE created_by = $2',
          [latestAdmin.id, olderAdmin.id]
        );
        await client.query(
          `UPDATE ssu_registrations old_registration
           SET user_id = $1
           WHERE old_registration.user_id = $2
             AND NOT EXISTS (
               SELECT 1 FROM ssu_registrations latest_registration
               WHERE latest_registration.event_id = old_registration.event_id
                 AND latest_registration.user_id = $1
             )`,
          [latestAdmin.id, olderAdmin.id]
        );
        await client.query('DELETE FROM ssu_registrations WHERE user_id = $1', [olderAdmin.id]);
        await client.query('UPDATE volunteer_applications SET user_id = $1 WHERE user_id = $2', [latestAdmin.id, olderAdmin.id]);
        await client.query('UPDATE user_presence SET user_id = $1 WHERE user_id = $2', [latestAdmin.id, olderAdmin.id]);
        await client.query('DELETE FROM users WHERE id = $1', [olderAdmin.id]);
      }
      await client.query(
        `UPDATE users
         SET name = $1, email = $2, password_hash = $3, member_type = $4
         WHERE id = $5`,
        [name, email, passwordHash, memberType, latestAdmin.id]
      );
      await client.query('COMMIT');
      return;
    }
    await client.query(
      `INSERT INTO users (name, email, password_hash, role, member_type)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (email) DO UPDATE
       SET role = EXCLUDED.role, password_hash = EXCLUDED.password_hash`,
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

start().catch(error => {
  console.error('Unable to start Zhenphen:', error);
  process.exitCode = 1;
});
