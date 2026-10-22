const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const report = {
  metrics: { volunteersServed: 1, activeVolunteers: 1, activeUsers: 2, openEvents: 1 },
  members: [
    { id: '1', name: '=Test, "Member"', email: 'one@example.com', volunteerApplications: 2, participations: 1, activeWork: ['Cleanup'] },
    { id: '2', name: 'Second', email: 'two@example.com', volunteerApplications: 1, participations: 0, activeWork: [] }
  ],
  events: [
    { id: '1', title: 'Cleanup', date: '2026-10-22', location: 'Campus', capacity: null, registrationCount: 2, attendedCount: 1, status: 'Open', workStatus: 'In progress', attendees: [{ userId: '1' }, { userId: '2' }] },
    { id: '2', title: 'Outreach', registrationCount: 1, attendedCount: 0, attendees: [{ userId: '1' }] }
  ]
};

function context() {
  const source = fs.readFileSync(path.resolve(__dirname, '../public/js/live.js'), 'utf8');
  const sandbox = { window: {}, Intl, Date, Blob, setTimeout: callback => callback(), toast() {} };
  vm.createContext(sandbox);
  vm.runInContext(source.slice(0, source.indexOf("document.addEventListener('submit'")), sandbox);
  return sandbox;
}

test('SSU reports distinguish unique volunteers, registrations, applications and attendance', () => {
  const app = context();
  const totals = new Map(app.buildSsuReport(report, 'summary').slice(1));
  assert.equal(totals.get('Unique volunteers registered for events'), 2);
  assert.equal(totals.get('Total event registrations'), 3);
  assert.equal(totals.get('Volunteer applications'), 3);
  assert.equal(totals.get('Unique volunteers with recorded attendance'), 1);
  const members = app.buildSsuReport(report, 'members');
  assert.equal(members[1][4], 2);
  assert.equal(members[2][4], 1);
  assert.equal(members[1][6], 'Cleanup');
  assert.equal(app.buildSsuReport(report, 'events')[1][4], 'No limit');
  assert.throws(() => app.buildSsuReport(report, 'unknown'), /valid SSU report/);
});

test('SSU CSV export fetches authorized live data, escapes CSV/formulas, and fails without a download', async () => {
  const app = context();
  let blob;
  let clicked = 0;
  let filename;
  app.apiRequest = async url => { assert.equal(url, '/api/ssu/admin/overview'); return report; };
  app.URL = { createObjectURL: value => { blob = value; return 'blob:test'; }, revokeObjectURL() {} };
  app.document = { createElement: () => ({ set download(value) { filename = value; }, click() { clicked++; } }) };
  await app.downloadSsuReport('members');
  assert.equal(clicked, 1);
  assert.match(filename, /^ssu-members-\d{4}-\d{2}-\d{2}\.csv$/);
  const csv = await blob.text();
  assert.ok(csv.includes('"\'=Test, ""Member"""'));
  app.apiRequest = async () => { throw new Error('Not authorized'); };
  await assert.rejects(app.downloadSsuReport('members'), /Not authorized/);
  assert.equal(clicked, 1);
});
