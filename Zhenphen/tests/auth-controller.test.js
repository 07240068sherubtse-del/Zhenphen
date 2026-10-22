const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createAuthController } = require('../controllers/authController');

function response() {
  return {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
    clearCookie(name) { this.cookie = name; },
    end() { this.ended = true; }
  };
}

test('auth controller login regenerates and saves session and excludes password hash', async () => {
  const operations = [];
  const controller = createAuthController({
    users: { findForLogin: async () => ({ rows: [{ id: 7, email: 'test@example.com', role: 'student', password_hash: 'hash-only', email_verified: true }] }) },
    emailService: {}, bcrypt: { compare: async () => true }
  });
  const req = { body: { email: 'test@example.com', password: 'test-only-input' }, session: {
    regenerate(callback) { operations.push('regenerate'); callback(); },
    save(callback) { operations.push('save'); callback(); }
  } };
  const res = response();
  await controller.login(req, res);
  assert.deepEqual(operations, ['regenerate', 'save']);
  assert.equal(req.session.userId, '7');
  assert.equal(res.body.user.id, '7');
  assert.equal(res.body.user.password_hash, undefined);
  assert.ok(!JSON.stringify(res.body).includes(req.body.password));
});

test('auth controller session failure cannot establish a partially saved login', async () => {
  const controller = createAuthController({
    users: { findForLogin: async () => ({ rows: [{ id: 7, password_hash: 'hash-only', email_verified: true }] }) },
    emailService: {}, bcrypt: { compare: async () => true }
  });
  const res = response();
  await assert.rejects(controller.login({ body: { email: 'test@example.com', password: 'test-input' }, session: {
    regenerate(callback) { callback(new Error('Test session store failure')); }
  } }, res), /session store failure/);
  assert.equal(res.body, undefined);
});

test('auth controller logout removes presence, destroys session and clears existing cookie name', async () => {
  const operations = [];
  const controller = createAuthController({ users: { removePresence: async params => operations.push(params) }, emailService: {} });
  const res = response();
  await controller.logout({ sessionID: 'test-session', session: { destroy(callback) { operations.push('destroy'); callback(); } } }, res);
  assert.deepEqual(operations, [['test-session'], 'destroy']);
  assert.equal(res.cookie, 'zhenphen.sid');
  assert.equal(res.statusCode, 204);
  assert.equal(res.ended, true);
});

test('auth controller clears stale sessions and returns the existing anonymous response', async () => {
  let destroyed = false;
  const controller = createAuthController({ users: { findPublicById: async () => ({ rows: [] }) }, emailService: {} });
  const res = response();
  await controller.session({ session: { userId: '99', destroy(callback) { destroyed = true; callback(); } } }, res);
  assert.equal(destroyed, true);
  assert.deepEqual(res.body, { user: null });
});
