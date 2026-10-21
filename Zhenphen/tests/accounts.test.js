const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const { load, serve, database, empty, rows } = require('./helpers.cjs');

const signup = { name: 'Test Student', email: '12345678.sherubtse@rub.edu.bt', password: 'TestPassword123!', memberType: 'Sherubtse College student', interest: 'Not applying for a volunteer role yet' };
function api(db, sendMail = async () => {}, bcrypt = {}) {
  return load('routes/api.js', {
    '../db': db,
    '../config/runtime': { appBaseUrl: () => 'https://site.example.com' },
    nodemailer: { createTransport: () => ({ sendMail }) },
    bcryptjs: { hash: async () => 'test-hash', compare: async () => true, ...bcrypt }
  });
}
// Harmless test-only configuration. No dotenv and no real transports.
Object.assign(process.env, { EMAIL_SMTP_HOST: 'smtp.example.com', EMAIL_SMTP_USER: 'test', EMAIL_SMTP_PASSWORD: 'test', EMAIL_FROM: 'sender@example.com', EMAIL_SMTP_PORT: '587' });

test('signup sends to submitted address, stores only token hash, embeds logo and commits', async t => {
  const db = database(sql => sql.includes('INSERT INTO users') ? rows({ id: 1, ...signup }) : empty());
  let mail;
  const request = await serve(t, [['/api', api(db, async value => { mail = value; })]]);
  const result = await request('/api/auth/register', { ...signup, role: 'admin' });
  assert.equal(result.status, 201);
  assert.equal(mail.to, signup.email);
  assert.equal(mail.from.name, 'Zhenphen');
  assert.ok(mail.html.includes('cid:zhenphen-logo'));
  assert.ok(fs.existsSync(mail.attachments[0].path));
  const raw = new URL(mail.text.match(/https:\/\/\S+/)[0]).searchParams.get('token');
  const token = db.calls.find(c => c.sql.includes('INSERT INTO email_verification_tokens'));
  assert.equal(token.params[0], crypto.createHash('sha256').update(raw).digest('hex'));
  assert.equal(db.calls.find(c => c.sql.includes('INSERT INTO users')).params[3], 'student');
  assert.ok(db.calls.some(c => c.sql === 'COMMIT'));
});

test('student email requires eight digits; supporters can use Gmail', async t => {
  const db = database(sql => sql.includes('INSERT INTO users') ? rows({ id: 1, ...signup, email: 'supporter@gmail.com' }) : empty());
  const request = await serve(t, [['/api', api(db)]]);
  for (const email of ['1234567.sherubtse@rub.edu.bt', '123456789.sherubtse@rub.edu.bt', 'student@gmail.com']) {
    assert.equal((await request('/api/auth/register', { ...signup, email })).status, 400);
  }
  assert.equal(db.calls.length, 0);
  assert.equal((await request('/api/auth/register', { ...signup, email: 'supporter@gmail.com', memberType: 'Community supporter / donor' })).status, 201);
});

test('signup rolls back account on email delivery failure', async t => {
  const db = database(sql => sql.includes('INSERT INTO users') ? rows({ id: 1, ...signup }) : empty());
  const request = await serve(t, [['/api', api(db, async () => { throw new Error('test delivery failure'); })]]);
  assert.equal((await request('/api/auth/register', signup)).status, 503);
  assert.ok(db.calls.some(c => c.sql === 'ROLLBACK'));
  assert.ok(!db.calls.some(c => c.sql === 'COMMIT'));
});

test('verification rejects malformed, expired and reused links; success removes all links', async t => {
  let verified = false;
  const db = database((sql, params) => {
    if (sql.includes('JOIN email_verification_tokens')) return verified || params[0] === crypto.createHash('sha256').update('c'.repeat(64)).digest('hex') ? empty() : rows({ id: 1 });
    if (sql.includes('UPDATE users SET email_verified')) verified = true;
    return empty();
  });
  const request = await serve(t, [['/api', api(db)]]);
  assert.equal((await request('/api/auth/verification/confirm', { token: 'bad' })).status, 400);
  assert.equal((await request('/api/auth/verification/confirm', { token: 'c'.repeat(64) })).status, 400);
  assert.equal((await request('/api/auth/verification/confirm', { token: 'a'.repeat(64) })).status, 200);
  assert.ok(db.calls.some(c => c.sql.includes('DELETE FROM email_verification_tokens WHERE user_id')));
  assert.equal((await request('/api/auth/verification/confirm', { token: 'a'.repeat(64) })).status, 400);
  assert.ok(db.calls.some(c => c.sql.includes('expires_at > NOW()') && c.sql.includes('FOR UPDATE OF u')));
});

test('resend hides account existence and keeps old links on delivery failure', async t => {
  const db = database((sql, params) => sql.startsWith('SELECT id, name, email') && params[0] === signup.email ? rows({ id: 1, ...signup }) : empty());
  const request = await serve(t, [['/api', api(db, async () => { throw new Error('test SMTP failure'); })]]);
  assert.equal((await request('/api/auth/verification/resend', { email: 'unknown@example.com' })).status, 202);
  assert.equal((await request('/api/auth/verification/resend', { email: signup.email })).status, 503);
  assert.ok(!db.calls.some(c => c.sql.includes('DELETE FROM email_verification_tokens WHERE user_id')));
});

test('login blocks unverified accounts and wrong passwords', async t => {
  let verified = false;
  let correct = true;
  const db = database(() => rows({ id: 1, ...signup, email_verified: verified, password_hash: 'test-hash' }));
  const request = await serve(t, [['/api', api(db, undefined, { compare: async () => correct })]]);
  assert.equal((await request('/api/auth/login', signup)).status, 403);
  correct = false;
  assert.equal((await request('/api/auth/login', signup)).status, 401);
  correct = true; verified = true;
  const result = await request('/api/auth/login', signup);
  assert.equal(result.status, 200);
  assert.equal(result.body.user.password_hash, undefined);
});

test('password recovery hides unknown account and does not delete old links when send fails', async t => {
  const db = database((sql, params) => sql.startsWith('SELECT id, name, email') && params[0] === signup.email ? rows({ id: 1, ...signup }) : empty());
  const request = await serve(t, [['/api', api(db, async () => { throw new Error('test SMTP failure'); })]]);
  assert.equal((await request('/api/auth/password-reset/request', { email: 'unknown@example.com' })).status, 202);
  assert.equal((await request('/api/auth/password-reset/request', { email: signup.email })).status, 503);
  assert.ok(!db.calls.some(c => c.sql === 'DELETE FROM password_reset_tokens WHERE user_id = $1'));
});

test('password recovery sends a correctly addressed link and stores only its hash', async t => {
  const db = database(sql => sql.startsWith('SELECT id, name, email') ? rows({ id: 1, ...signup }) : empty());
  let mail;
  const request = await serve(t, [['/api', api(db, async value => { mail = value; })]]);
  assert.equal((await request('/api/auth/password-reset/request', { email: signup.email })).status, 202);
  assert.equal(mail.to, signup.email);
  const link = new URL(mail.text.match(/https:\/\/\S+/)[0]);
  assert.equal(link.origin, 'https://site.example.com');
  assert.equal(link.pathname, '/forgot-password.html');
  const stored = db.calls.find(c => c.sql.includes('INSERT INTO password_reset_tokens'));
  assert.equal(stored.params[0], crypto.createHash('sha256').update(link.searchParams.get('token')).digest('hex'));
  assert.ok(stored.sql.includes("INTERVAL '30 minutes'"));
});

test('password reset consumes valid token, updates password and revokes all sessions; replay rejected', async t => {
  let used = false;
  const db = database((sql, params) => {
    if (sql.includes('JOIN password_reset_tokens')) return used || params[0] === crypto.createHash('sha256').update('c'.repeat(64)).digest('hex') ? empty() : rows({ user_id: 1 });
    if (sql.includes('DELETE FROM password_reset_tokens WHERE token_hash')) { used = true; return rows({ user_id: 1 }); }
    return empty();
  });
  const request = await serve(t, [['/api', api(db)]]);
  const body = { token: 'b'.repeat(64), password: 'NewPassword123!' };
  assert.equal((await request('/api/auth/password-reset/confirm', { ...body, token: 'c'.repeat(64) })).status, 400);
  assert.equal((await request('/api/auth/password-reset/confirm', { ...body, password: 'short' })).status, 400);
  assert.equal((await request('/api/auth/password-reset/confirm', body)).status, 200);
  assert.ok(db.calls.some(c => c.sql.includes('DELETE FROM user_sessions')));
  assert.ok(db.calls.some(c => c.sql.includes('UPDATE users SET password_hash')));
  assert.equal((await request('/api/auth/password-reset/confirm', body)).status, 400);
  assert.ok(db.calls.some(c => c.sql === 'ROLLBACK'));
});

test('profile changes cannot set email or role; invalid image rejected; volunteer access enforced', async t => {
  const db = database(sql => sql.includes('UPDATE users') ? rows({ id: 1, name: 'Updated', email: signup.email, role: 'student' }) : rows({ id: '1' }));
  const request = await serve(t, [['/api', api(db)]], { id: '1', role: 'student' });
  assert.equal((await request('/api/profile', { name: 'Updated', role: 'admin', email: 'attacker@example.com' }, 'PUT')).status, 200);
  assert.ok(!db.calls[0].sql.includes('email ='));
  assert.ok(!db.calls[0].sql.includes('role ='));
  assert.equal((await request('/api/profile', { name: 'Updated', avatar: 'data:image/png;base64,YmFk' }, 'PUT')).status, 400);
  assert.equal((await request('/api/volunteer-applications', { interest: 'Outreach', availability: 'Weekends' })).status, 201);
  const supporter = await serve(t, [['/api', api(db)]], { id: '2', role: 'supporter' });
  assert.equal((await supporter('/api/volunteer-applications', { interest: 'Outreach', availability: 'Weekends' })).status, 403);
});

test('donations remain disabled and perform no database writes', async t => {
  const db = database(() => { throw new Error('Unexpected database call'); });
  const request = await serve(t, [['/api', api(db)]]);
  assert.equal((await request('/api/donations/checkout', { amount: 100 })).status, 503);
  assert.equal(db.calls.length, 0);
});

test('bcrypt credentials are checked with the real hashing library and long byte inputs rejected', async t => {
  const bcrypt = require('bcryptjs');
  const password = 'RealPassword123!';
  const passwordHash = await bcrypt.hash(password, 4);
  const db = database(() => rows({ id: 1, ...signup, password_hash: passwordHash, email_verified: true }));
  const request = await serve(t, [['/api', api(db, undefined, bcrypt)]]);
  assert.equal((await request('/api/auth/login', { email: signup.email, password: 'WrongPassword123!' })).status, 401);
  assert.equal((await request('/api/auth/login', { email: signup.email, password })).status, 200);
  assert.equal((await request('/api/auth/register', { ...signup, password: 'a'.repeat(73) })).status, 400);
  assert.equal((await request('/api/auth/register', { ...signup, password: '\u00e9'.repeat(37) })).status, 400);
});

test('login rate limiting blocks repeated attempts', async t => {
  const db = database(empty);
  const request = await serve(t, [['/api', api(db)]]);
  for (let attempt = 0; attempt < 10; attempt++) {
    assert.equal((await request('/api/auth/login', signup)).status, 401);
  }
  assert.equal((await request('/api/auth/login', signup)).status, 429);
  assert.equal(db.calls.length, 10);
});
