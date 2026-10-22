const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const { load, serve, database, empty, rows } = require('./helpers.cjs');

const signup = { name: 'Test Student', email: '12345678.sherubtse@rub.edu.bt', password: 'TestPassword123!', memberType: 'Sherubtse College student', interest: 'Not applying for a volunteer role yet' };
function api(db, sendMail = async () => {}, bcrypt = {}) {
  const { createAuthController } = require('../controllers/authController');
  const { createEmailService } = load('services/emailService.js', {
    '../config/runtime': { appBaseUrl: () => 'https://site.example.com' },
    nodemailer: { createTransport: () => ({ sendMail }) }
  });
  return load('routes/api.js', {
    '../db': db,
    '../services/emailService': { createEmailService },
    '../controllers/authController': {
      createAuthController: dependencies => createAuthController({
        ...dependencies, bcrypt: { hash: async () => 'test-hash', compare: async () => true, ...bcrypt }
      })
    }
  });
}
// Harmless test-only configuration. No dotenv and no real transports.
Object.assign(process.env, { EMAIL_SMTP_HOST: 'smtp.example.com', EMAIL_SMTP_USER: 'test', EMAIL_SMTP_PASSWORD: 'test', EMAIL_FROM: 'sender@example.com', EMAIL_SMTP_PORT: '587', SESSION_SECRET: 'test-only-session-secret-at-least-32-characters' });

test('signup emails a six-digit code, stores keyed hash, embeds logo and commits', async t => {
  const db = database(sql => sql.includes('INSERT INTO users') ? rows({ id: 1, ...signup }) : empty());
  let mail;
  const request = await serve(t, [['/api', api(db, async value => { mail = value; }, require('bcryptjs'))]]);
  const result = await request('/api/auth/register', { ...signup, role: 'admin' });
  assert.equal(result.status, 201);
  assert.equal(mail.to, signup.email);
  assert.equal(mail.from.name, 'Zhenphen');
  assert.ok(mail.html.includes('cid:zhenphen-logo'));
  assert.ok(fs.existsSync(mail.attachments[0].path));
  const raw = mail.text.match(/code is: (\d{6})/)[1];
  const token = db.calls.find(c => c.sql.includes('INSERT INTO email_verification_tokens'));
  assert.equal(token.params[0], crypto.createHmac('sha256', process.env.SESSION_SECRET).update(`${signup.email}:${raw}`).digest('hex'));
  assert.equal(db.calls.find(c => c.sql.includes('INSERT INTO users')).params[3], 'student');
  const inserted = db.calls.find(c => c.sql.includes('INSERT INTO users'));
  assert.ok(inserted.sql.includes('FALSE'));
  assert.notEqual(inserted.params[2], signup.password);
  assert.ok(await require('bcryptjs').compare(signup.password, inserted.params[2]));
  assert.ok(!JSON.stringify(db.calls).includes(signup.password));
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

test('verification accepts correct email/code, rejects invalid and reused codes, removes all codes', async t => {
  let verified = false;
  let attempts = 0;
  const expected = crypto.createHmac('sha256', process.env.SESSION_SECRET).update(`${signup.email}:012345`).digest('hex');
  const db = database((sql, params) => {
    if (sql.startsWith('SELECT id, email_verification_attempts')) return verified ? empty() : rows({ id: 1, email_verification_attempts: attempts });
    if (sql.includes('SELECT user_id FROM email_verification_tokens')) return params[1] === expected ? rows({ user_id: 1 }) : empty();
    if (sql.includes('email_verification_attempts + 1')) attempts++;
    if (sql.includes('UPDATE users SET email_verified')) verified = true;
    return empty();
  });
  const request = await serve(t, [['/api', api(db)]]);
  const confirm = code => request('/api/auth/verification/confirm', { email: signup.email, code });
  assert.equal((await confirm('bad')).status, 400);
  assert.equal((await confirm('999999')).status, 400);
  assert.equal(attempts, 1);
  assert.equal((await confirm('012345')).status, 200);
  assert.ok(db.calls.some(c => c.sql.includes('DELETE FROM email_verification_tokens WHERE user_id')));
  assert.equal((await confirm('012345')).status, 400);
  assert.ok(db.calls.some(c => c.sql.includes('expires_at > NOW()')));
});

test('verification rejects expired codes and locks out accounts after five failed attempts', async t => {
  let attempts = 4;
  const db = database(sql => {
    if (sql.startsWith('SELECT id, email_verification_attempts')) return rows({ id: 1, email_verification_attempts: attempts });
    if (sql.includes('email_verification_attempts + 1')) attempts++;
    return empty();
  });
  const request = await serve(t, [['/api', api(db)]]);
  const body = { email: signup.email, code: '123456' };
  assert.equal((await request('/api/auth/verification/confirm', body)).status, 400);
  assert.equal(attempts, 5);
  const before = db.calls.filter(c => c.sql.includes('SELECT user_id FROM email_verification_tokens')).length;
  assert.equal((await request('/api/auth/verification/confirm', body)).status, 400);
  assert.equal(db.calls.filter(c => c.sql.includes('SELECT user_id FROM email_verification_tokens')).length, before);
  assert.ok(!db.calls.some(c => c.sql.includes('UPDATE users SET email_verified')));
});

test('resend hides account existence and keeps the earlier code on delivery failure', async t => {
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

test('password recovery sends a correctly addressed code and stores only its hash', async t => {
  const db = database(sql => sql.startsWith('SELECT id, name, email') ? rows({ id: 1, ...signup }) : empty());
  let mail;
  const request = await serve(t, [['/api', api(db, async value => { mail = value; })]]);
  assert.equal((await request('/api/auth/password-reset/request', { email: signup.email })).status, 202);
  assert.equal(mail.to, signup.email);
  const code = mail.text.match(/\b\d{6}\b/)[0];
  assert.ok(!mail.text.includes('https://'));
  const stored = db.calls.find(c => c.sql.includes('INSERT INTO password_reset_tokens'));
  assert.equal(stored.params[0], crypto.createHmac('sha256', process.env.SESSION_SECRET).update(`password-reset:${signup.email}:${code}`).digest('hex'));
  assert.ok(stored.sql.includes("INTERVAL '30 minutes'"));
});

test('password reset consumes valid token, updates password and revokes all sessions; replay rejected', async t => {
  let used = false;
  const db = database((sql, params) => {
    if (sql.includes('JOIN password_reset_tokens')) return used || params[0] === crypto.createHmac('sha256', process.env.SESSION_SECRET).update(`password-reset:${signup.email}:654321`).digest('hex') ? empty() : rows({ user_id: 1 });
    if (sql.includes('DELETE FROM password_reset_tokens WHERE token_hash')) { used = true; return rows({ user_id: 1 }); }
    return empty();
  });
  const request = await serve(t, [['/api', api(db, undefined, require('bcryptjs'))]]);
  const body = { email: signup.email, code: '123456', password: 'NewPassword123!' };
  assert.equal((await request('/api/auth/password-reset/confirm', { ...body, code: '654321' })).status, 400);
  assert.equal((await request('/api/auth/password-reset/confirm', { ...body, password: 'short' })).status, 400);
  assert.equal((await request('/api/auth/password-reset/confirm', body)).status, 200);
  assert.ok(db.calls.some(c => c.sql.includes('DELETE FROM user_sessions')));
  const update = db.calls.find(c => c.sql.includes('UPDATE users SET password_hash'));
  assert.notEqual(update.params[0], body.password);
  assert.ok(await require('bcryptjs').compare(body.password, update.params[0]));
  assert.ok(!JSON.stringify(db.calls).includes(body.password));
  assert.ok(db.calls.some(c => c.sql.includes('expires_at > NOW()')));
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

test('successful verification resend and recovery have identical known/unknown account responses', async t => {
  let sent = 0;
  const db = database((sql, params) => sql.startsWith('SELECT id, name, email') && params[0] === signup.email
    ? rows({ id: 1, ...signup }) : empty());
  const request = await serve(t, [['/api', api(db, async () => { sent++; })]]);
  for (const endpoint of ['/api/auth/verification/resend', '/api/auth/password-reset/request']) {
    const known = await request(endpoint, { email: signup.email });
    const unknown = await request(endpoint, { email: 'unknown@example.com' });
    assert.equal(known.status, 202);
    assert.deepEqual(known, unknown);
  }
  assert.equal(sent, 2);
});

test('SMTP failure responses do not contain provider details, credentials or raw tokens', async t => {
  let mail;
  const db = database(sql => sql.startsWith('SELECT id, name, email') || sql.includes('INSERT INTO users')
    ? rows({ id: 1, ...signup }) : empty());
  const request = await serve(t, [['/api', api(db, async value => {
    mail = value;
    throw Object.assign(new Error('private-provider-detail-test-sentinel'), { code: 'EAUTH' });
  })]]);
  for (const [endpoint, body] of [
    ['/api/auth/register', signup],
    ['/api/auth/password-reset/request', { email: signup.email }]
  ]) {
    const result = await request(endpoint, body);
    assert.equal(result.status, 503);
    assert.match(result.body.error, /could not.*sen[dt]/i);
    const response = JSON.stringify(result.body);
    assert.ok(!response.includes('private-provider-detail-test-sentinel'));
    assert.ok(!response.includes('EAUTH'));
    const code = mail.text.match(/code is: (\d{6})/)?.[1];
    const token = mail.text.match(/token=([a-f0-9]{64})/)?.[1];
    if (code) assert.ok(!response.includes(code));
    if (token) assert.ok(!response.includes(token));
  }
});

test('new accounts require a capital, number and special character before any database write', async t => {
  const db = database(() => empty());
  const request = await serve(t, [['/api', api(db)]]);
  for (const password of ['lowercase123!', 'NoNumbersHere!', 'NoSpecialChar123', 'NoSpecial123 ']) {
    const result = await request('/api/auth/register', { ...signup, password });
    assert.equal(result.status, 400);
    assert.match(result.body.error, /capital letter, one number, and one special character/);
  }
  assert.equal(db.calls.length, 0);
});

test('existing accounts can still sign in with passwords that lack the new requirements', async t => {
  const password = 'oldpassword';
  const bcrypt = require('bcryptjs');
  const passwordHash = await bcrypt.hash(password, 4);
  const db = database(() => rows({ id: 1, ...signup, email_verified: true, password_hash: passwordHash }));
  const request = await serve(t, [['/api', api(db, undefined, bcrypt)]]);
  assert.equal((await request('/api/auth/login', { email: signup.email, password })).status, 200);
});
