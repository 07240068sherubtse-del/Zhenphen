const { test } = require('node:test');
const assert = require('node:assert/strict');
const { load, database, rows, empty } = require('./helpers.cjs');

test('administrator bootstrap never merges accounts or overwrites existing credentials', async () => {
  Object.assign(process.env, { TEST_ADMIN_EMAIL: 'admin@example.com', TEST_ADMIN_PASSWORD: 'TestPassword123!' });
  const db = database(() => rows({ id: 1 }, { id: 2 }));
  const { bootstrapAdministrator } = load('bootstrap.js', { './db': db, bcryptjs: { hash: async () => 'test-hash' } });
  await bootstrapAdministrator('TEST_ADMIN_EMAIL', 'TEST_ADMIN_PASSWORD', 'TEST_ADMIN_NAME', 'ssuAdmin', 'SSU administrator');
  assert.ok(!db.calls.some(c => /UPDATE|DELETE|INSERT/.test(c.sql.replace('FOR UPDATE', ''))));
  assert.ok(db.calls.some(c => c.sql === 'COMMIT'));
});

test('administrator bootstrap refuses to promote an existing email implicitly', async () => {
  Object.assign(process.env, { TEST_ADMIN_EMAIL: 'admin@example.com', TEST_ADMIN_PASSWORD: 'TestPassword123!' });
  const db = database(sql => sql.includes('WHERE role') ? empty() : rows({ id: 1 }));
  const { bootstrapAdministrator } = load('bootstrap.js', { './db': db, bcryptjs: { hash: async () => 'test-hash' } });
  await assert.rejects(bootstrapAdministrator('TEST_ADMIN_EMAIL', 'TEST_ADMIN_PASSWORD', 'TEST_ADMIN_NAME', 'admin', 'Site administrator'), /existing account/);
  assert.ok(db.calls.some(c => c.sql === 'ROLLBACK'));
});
