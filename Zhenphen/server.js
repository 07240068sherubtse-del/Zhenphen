const express = require('express');
const path = require('path');
const session = require('express-session');
const connectPgSimple = require('connect-pg-simple');
const helmet = require('helmet');
const crypto = require('crypto');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const { pool, initializeDatabase } = require('./db');
const apiRoutes = require('./routes/api');
const adminRoutes = require('./routes/admin');
const ssuRoutes = require('./routes/ssu');
const { apiError } = require('./middleware/api');
const { bootstrapAdministrator } = require('./bootstrap');

const app = express();
const PORT = process.env.PORT || 3000;
const PgSession = connectPgSimple(session);

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.set('trust proxy', 1);

app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false, referrerPolicy: { policy: 'no-referrer' } }));
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
app.use('/api/evidence', require('./routes/evidence').createEvidenceRouter(pool));
app.use(express.static(path.join(__dirname, 'public')));
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
  if (process.env.NODE_ENV === 'production') require('./config/runtime').appBaseUrl();
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
  const server = await listenOnPort(requestedPort);
  console.log(`Zhenphen server listening on port ${server.address().port}`);
  if (process.env.NODE_ENV !== 'production') {
    console.log(`Open your website: http://localhost:${server.address().port}`);
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


start().catch(error => {
  console.error('Unable to start Zhenphen:', error);
  process.exitCode = 1;
});
