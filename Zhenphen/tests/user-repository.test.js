const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createUserRepository } = require('../repositories/userRepository');

test('user repository binds transaction operations to the acquired client and parameterizes hashes', async () => {
  const calls = [];
  let released = false;
  const repository = createUserRepository({
    query: async () => { throw new Error('Transaction escaped to pool'); },
    connect: async () => ({
      query: async (sql, params) => { calls.push({ sql, params }); return { rows: [], rowCount: 0 }; },
      release: () => { released = true; }
    })
  });
  const client = await repository.connect();
  await client.begin();
  await client.createUnverified(['Test', 'test@example.com', 'test-password-hash', 'student', 'Sherubtse College student']);
  await client.commit();
  client.release();
  assert.equal(calls[0].sql, 'BEGIN');
  assert.match(calls[1].sql, /VALUES \(\$1, \$2, \$3, \$4, \$5, FALSE\)/);
  assert.equal(calls[1].params[2], 'test-password-hash');
  assert.ok(!calls[1].sql.includes('test@example.com'));
  assert.equal(calls[2].sql, 'COMMIT');
  assert.equal(released, true);
});
