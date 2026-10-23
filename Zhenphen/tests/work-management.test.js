const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function ui() {
  const listeners = {};
  const requests = [];
  let dialog;
  const submit = { disabled: false };
  const context = {
    Intl, Date, memberRole: () => 'admin', esc: value => String(value), toast() {},
    modal: (...args) => { dialog = args; },
    document: { body: { dataset: { page: 'admin-dashboard' } },
      addEventListener: (type, callback) => { listeners[type] = callback; },
      querySelector: () => submit, getElementById: () => ({ close() {} }) },
    window: { liveSsuEvents: [{ id: '7', title: 'Shared work' }], confirm: () => true },
    refreshSuperAdminDashboard: async () => {}, refreshSsuAdminData: async () => {}, refreshSsuPublicOpportunities: async () => {},
    FormData: class { constructor(form) { return Object.entries(form.values); } },
    apiRequest: async (url, options) => { requests.push({ url, options }); }
  };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.resolve(__dirname, '../public/js/work-management.js'), 'utf8'), context);
  return { context, listeners, requests, submit, dialog: () => dialog };
}

test('joint editor retains details and submits create versus edit to the shared API', async () => {
  const app = ui();
  app.context.openJointWorkEditor({ id: '7', title: 'Shared work', date: '2026-10-31', capacity: 10, description: 'Joint activity' });
  assert.match(app.dialog()[1], /data-work-id="7"/);
  assert.match(app.dialog()[1], /in collaboration with Zhenphen Association/);
  const errorBox = {};
  const form = { dataset: {}, values: { title: 'New work' }, querySelector: () => errorBox };
  const event = { target: { closest: () => form }, preventDefault() {} };
  await app.listeners.submit(event);
  assert.equal(app.requests[0].url, '/api/ssu/events');
  assert.equal(app.requests[0].options.method, 'POST');
  form.dataset.workId = '7';
  await app.listeners.submit(event);
  assert.equal(app.requests[1].url, '/api/ssu/events/7');
  assert.equal(app.requests[1].options.method, 'PATCH');
  assert.equal(app.submit.disabled, false);
});

test('deleting shared work requires confirmation and cancellation makes no request', async () => {
  const app = ui();
  const button = { dataset: { jointWorkDelete: '7' }, disabled: false };
  const event = { target: { closest: selector => selector === '[data-joint-work-delete]' ? button : null } };
  app.context.window.confirm = () => false;
  await app.listeners.click(event);
  assert.equal(app.requests.length, 0);
  app.context.window.confirm = message => { assert.match(message, /registrations and attendance/); return true; };
  await app.listeners.click(event);
  assert.equal(app.requests[0].options.method, 'DELETE');
  assert.equal(app.requests[0].url, '/api/ssu/events/7');
});
