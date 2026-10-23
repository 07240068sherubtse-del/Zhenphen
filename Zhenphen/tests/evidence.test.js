const { test } = require('node:test');
const assert = require('node:assert/strict');
const { serve, database, rows, empty } = require('./helpers.cjs');
const { createEvidenceRouter, project } = require('../routes/evidence');

test('evidence reads require login and changes require an administrator', async t => {
  const db = database(() => { throw new Error('Unexpected query'); });
  const anonymous = await serve(t, [['/evidence', createEvidenceRouter(db.pool)]]);
  for (const [path, method] of [['/evidence', 'GET'], ['/evidence/1/file', 'GET'], ['/evidence', 'POST']]) {
    assert.equal((await anonymous(path, {}, method)).status, 401);
  }
  for (const role of ['student', 'supporter']) {
    const request = await serve(t, [['/evidence', createEvidenceRouter(db.pool)]], { id: '1', role });
    assert.equal((await request('/evidence', {})).status, 403);
    assert.equal((await request('/evidence/1', {}, 'DELETE')).status, 403);
  }
  assert.equal(db.calls.length, 0);
});

test('project has supplied details and no invented evidence', async t => {
  const db = database(() => empty());
  const request = await serve(t, [['/evidence', createEvidenceRouter(db.pool)]], { id: '1', role: 'student' });
  const result = await request('/evidence', null, 'GET');
  assert.equal(result.status, 200);
  assert.deepEqual(result.body, { project, files: [] });
  assert.equal(project.title, 'Painting of Lower Zangtolperi 108 Chorten');
  assert.equal(project.completed, '2026-09-03');
  assert.equal(project.location, 'Lower Zangtolperi 108 Chorten');
  assert.equal(project.organizers, 'Social Services Unit, in collaboration with Zhenphen Association');
});

test('both administrator roles can save actual file bytes; invalid formats and sizes are rejected', async t => {
  const db = database(() => rows({ id: '42' }));
  for (const role of ['admin', 'ssuAdmin']) {
    const request = await serve(t, [['/evidence', createEvidenceRouter(db.pool)]], { id: '7', role });
    const payload = { kind: 'receipt', filename: 'bill.pdf', caption: 'Paint bill', data: `data:application/pdf;base64,${Buffer.from('%PDF-1.4\n').toString('base64')}` };
    assert.equal((await request('/evidence', payload)).status, 201);
    assert.ok(Buffer.isBuffer(db.calls.at(-1).params[5]));
    assert.equal(db.calls.at(-1).params[5].toString(), '%PDF-1.4\n');
    assert.equal((await request('/evidence', { ...payload, kind: 'photo' })).status, 400);
    assert.equal((await request('/evidence', { ...payload, data: 'data:image/png;base64,YmFk' })).status, 400);
    assert.equal((await request('/evidence', { ...payload, filename: '../bill.pdf' })).status, 400);
    assert.equal((await request('/evidence', { ...payload, data: 'x'.repeat(1400001) })).status, 413);
    assert.equal((await request('/evidence/42', {}, 'DELETE')).status, 204);
    assert.equal((await request('/evidence/nope', {}, 'DELETE')).status, 400);
  }
});

test('missing evidence file returns 404', async t => {
  const db = database(() => empty());
  const request = await serve(t, [['/evidence', createEvidenceRouter(db.pool)]], { id: '1', role: 'supporter' });
  assert.equal((await request('/evidence/99/file', null, 'GET')).status, 404);
});

test('supplied bills estimate deducts the rounded credit note without double counting handwritten subtotals', () => {
  const estimate = project.costEstimate;
  assert.equal(estimate.entries.length, 10);
  assert.equal(estimate.grossChhetrum, 3759020);
  assert.equal(estimate.creditChhetrum, 199800);
  assert.equal(estimate.netChhetrum, 3559220);
  assert.equal(estimate.entries.find(entry => entry.document === 4).amountChhetrum, 328650 + 47250);
  assert.equal(estimate.entries.find(entry => entry.document === 9).amountChhetrum, -199800);
  assert.equal(project.budgetReceived, null);
  assert.match(estimate.reconciliationNote, /dated after/);
  assert.match(project.studentInvolvement, /More than 100 students/);
  assert.equal(project.completed, '2026-09-03');
});
