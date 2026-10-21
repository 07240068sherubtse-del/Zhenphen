const { test } = require('node:test');
const assert = require('node:assert/strict');
const { load, serve, database, empty, rows } = require('./helpers.cjs');

function router(db) {
  const controller = load('controllers/ssuController.js', { '../db': db });
  return load('routes/ssu.js', { '../controllers/ssuController': controller });
}

test('anonymous and supporter users cannot register or modify SSU work', async t => {
  const db = database(() => { throw new Error('Unauthorized database access'); });
  for (const user of [null, { id: '1', role: 'supporter' }]) {
    const request = await serve(t, [['/ssu', router(db)]], user);
    const expected = user ? 403 : 401;
    assert.equal((await request('/ssu/events/1/register')).status, expected);
    assert.equal((await request('/ssu/events', {})).status, expected);
    assert.equal((await request('/ssu/events/1/attendance/1', { attendance: 'Checked in' }, 'PATCH')).status, expected);
    assert.equal((await request('/ssu/admin/overview', null, 'GET')).status, expected);
  }
  assert.equal(db.calls.length, 0);
});

test('registration locks capacity, rejects full/closed/completed/past events and duplicates', async t => {
  let event = { id: 1, status: 'Open', work_status: 'Upcoming', event_date: '2099-01-01', capacity: 1 };
  let count = 0;
  let duplicate = false;
  const db = database(sql => {
    if (sql.includes('FROM ssu_events')) return rows(event);
    if (sql.includes('COUNT(*)')) return rows({ count });
    if (sql.startsWith('SELECT id FROM ssu_registrations')) return duplicate ? rows({ id: 1 }) : empty();
    if (sql.includes('INSERT INTO ssu_registrations')) return duplicate ? empty() : rows({ id: 1 });
    return empty();
  });
  const request = await serve(t, [['/ssu', router(db)]], { id: '1', role: 'student' });
  assert.equal((await request('/ssu/events/1/register')).status, 201);
  assert.ok(db.calls.some(c => c.sql.includes('FOR UPDATE')));
  count = 1;
  assert.equal((await request('/ssu/events/1/register')).status, 409);
  count = 0; duplicate = true;
  assert.equal((await request('/ssu/events/1/register')).status, 409);
  duplicate = false;
  for (const patch of [{ status: 'Closed' }, { work_status: 'Completed' }, { work_status: 'In progress' }, { event_date: '2000-01-01' }]) {
    const original = event; event = { ...event, ...patch };
    assert.equal((await request('/ssu/events/1/register')).status, 409);
    event = original;
  }
  assert.ok(db.calls.some(c => c.sql === 'ROLLBACK'));
});

test('attendance requires registered member, in-progress work, and check-in before checkout', async t => {
  let attendance = 'Registered';
  let workStatus = 'Upcoming';
  const db = database((sql, params) => {
    assert.ok(sql.includes("work_status = 'In progress'"));
    assert.ok(sql.includes("attendance = 'Checked in'"));
    if (workStatus !== 'In progress' || (params[0] === 'Checked out' && attendance !== 'Checked in' && attendance !== 'Checked out')) return empty();
    attendance = params[0];
    return rows({ attendance });
  });
  const request = await serve(t, [['/ssu', router(db)]], { id: '2', role: 'ssuAdmin' });
  const update = value => request('/ssu/events/1/attendance/1', { attendance: value }, 'PATCH');
  assert.equal((await update('invalid')).status, 400);
  assert.equal((await update('Checked in')).status, 409);
  workStatus = 'In progress';
  assert.equal((await update('Checked out')).status, 409);
  assert.equal((await update('Checked in')).status, 200);
  assert.equal((await update('Checked out')).status, 200);
  workStatus = 'Completed';
  assert.equal((await update('Checked in')).status, 409);
});

test('students cannot publish, while administrators validate event dates and capacity', async t => {
  const db = database(() => rows({ id: '1' }));
  const student = await serve(t, [['/ssu', router(db)]], { id: '1', role: 'student' });
  assert.equal((await student('/ssu/events', {})).status, 403);
  assert.equal((await student('/ssu/events/not-an-id/register')).status, 400);
  const admin = await serve(t, [['/ssu', router(db)]], { id: '2', role: 'ssuAdmin' });
  const body = { title: 'Community support', date: '2099-01-01', location: 'Kanglung', description: 'Community service event', capacity: 10 };
  assert.equal((await admin('/ssu/events', { ...body, date: '2099-02-30' })).status, 400);
  assert.equal((await admin('/ssu/events', { ...body, capacity: -1 })).status, 400);
  assert.equal((await admin('/ssu/events', body)).status, 201);
});

test('site admin endpoints reject SSU administrators and prevent self-demotion', async t => {
  const db = database(() => rows({ id: '2', role: 'supporter' }));
  const adminRouter = () => load('routes/admin.js', { '../db': db });
  const ssu = await serve(t, [['/admin', adminRouter()]], { id: '1', role: 'ssuAdmin' });
  assert.equal((await ssu('/admin/overview', null, 'GET')).status, 403);
  const admin = await serve(t, [['/admin', adminRouter()]], { id: '1', role: 'admin' });
  assert.equal((await admin('/admin/users/1/role', { role: 'supporter' }, 'PUT')).status, 409);
  assert.equal((await admin('/admin/users/2/role', { role: 'unknown' }, 'PUT')).status, 400);
  assert.equal((await admin('/admin/users/2/role', { role: 'supporter' }, 'PUT')).status, 200);
});
