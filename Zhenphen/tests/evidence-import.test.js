const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { importProvidedEvidence } = require('../services/projectEvidence');

function database(imported = false, fail = false) {
  const calls = [];
  const client = {
    async query(sql, params) {
      calls.push({ sql, params });
      if (sql.includes('INSERT INTO project_evidence_imports')) return { rows: imported ? [] : [{ source_key: 'document' }] };
      if (fail && sql.includes('INSERT INTO project_evidence (')) throw new Error('Storage failed');
      return { rows: [] };
    }, release() { calls.push({ sql: 'RELEASE' }); }
  };
  return { calls, pool: { connect: async () => client } };
}

test('provided document imports all three completed-work photos and ten original bill images', async () => {
  const db = database();
  await importProvidedEvidence(db.pool);
  const inserts = db.calls.filter(call => call.sql.includes('INSERT INTO project_evidence ('));
  assert.equal(inserts.length, 13);
  assert.equal(inserts.filter(call => call.params[1] === 'photo').length, 3);
  assert.equal(inserts.filter(call => call.params[1] === 'receipt').length, 10);
  for (const call of inserts) {
    assert.deepEqual(call.params[5], fs.readFileSync(path.resolve(__dirname, '../data/evidence/lower-zangtolperi-108-chorten', call.params[2])));
    assert.equal(call.params[4], 'image/jpeg');
  }
  assert.match(inserts[11].params[3], /Credit note/);
  assert.equal(db.calls.at(-2).sql, 'COMMIT');
  assert.equal(db.calls.at(-1).sql, 'RELEASE');
});

test('completed imports do not reinsert photos or restore deleted evidence after restart', async () => {
  const db = database(true);
  await importProvidedEvidence(db.pool);
  assert.equal(db.calls.filter(call => call.sql.includes('INSERT INTO project_evidence (')).length, 0);
  assert.equal(db.calls.at(-2).sql, 'COMMIT');
});

test('a failed import rolls back the batch marker and files together', async () => {
  const db = database(false, true);
  await assert.rejects(importProvidedEvidence(db.pool), /Storage failed/);
  assert.equal(db.calls.at(-2).sql, 'ROLLBACK');
  assert.equal(db.calls.at(-1).sql, 'RELEASE');
});
