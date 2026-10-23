const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { project } = require('../routes/evidence');

function screen(role, files = []) {
  const listeners = {};
  const requests = [];
  const nodes = new Map();
  const node = selector => {
    if (!nodes.has(selector)) nodes.set(selector, { textContent: '', innerHTML: '', classList: { toggle() {} } });
    return nodes.get(selector);
  };
  const form = {
    elements: {
      kind: { value: 'photo', addEventListener(type, callback) { listeners.kind = callback; } },
      file: { files: [], accept: 'image/jpeg,image/png' }, caption: { value: '' }
    },
    querySelector: () => node('submit'),
    addEventListener(type, callback) { listeners.submit = callback; },
    reset() { this.didReset = true; this.elements.file.files = []; this.elements.kind.value = 'photo'; }
  };
  const section = {
    innerHTML: '', setAttribute() {},
    querySelector(selector) { return selector === 'form' ? (['admin', 'ssuAdmin'].includes(role) ? form : null) : node(selector); },
    addEventListener(type, callback) { listeners[type] = callback; }
  };
  const main = { querySelector: () => null, insertBefore(element) { assert.equal(element, section); } };
  const context = {
    page: 'student-dashboard', memberRole: () => role,
    document: { querySelector: () => main, getElementById: () => null, createElement: () => section },
    esc: value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;'),
    window: { confirm: () => true },
    FileReader: class { readAsDataURL(file) { this.result = file.data; this.onload(); } },
    apiRequest: async (url, options) => {
      requests.push({ url, options });
      if (options?.method === 'POST') return { id: '1' };
      if (options?.method === 'DELETE') return null;
      return { project, files };
    }
  };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.resolve(__dirname, '../public/js/evidence.js'), 'utf8'), context);
  return { context, section, nodes, node, form, listeners, requests };
}

test('member evidence keeps bills collapsed and opens documents individually without embedding them', async () => {
  const view = screen('student', [
    { id: '3', kind: 'receipt', filename: '<bill>.pdf', caption: '', mimeType: 'application/pdf' },
    { id: '4', kind: 'photo', filename: 'photo.png', caption: 'Work completed', mimeType: 'image/png' }
  ]);
  await view.context.mountProjectEvidence();
  assert.match(view.section.innerHTML, /Painting of Lower Zangtolperi 108 Chorten/);
  assert.match(view.section.innerHTML, /3 September 2026/);
  assert.match(view.section.innerHTML, /<div class="evidence-details">/);
  assert.match(view.section.innerHTML, /Approximately one week/);
  assert.match(view.section.innerHTML, /Work carried out on weekends/);
  assert.match(view.section.innerHTML, /<details class="evidence-receipts">/);
  assert.doesNotMatch(view.section.innerHTML, /Manage evidence/);
  const receipts = view.node('[data-evidence-receipts]').innerHTML;
  assert.match(receipts, /href="\/api\/evidence\/receipts.pdf"/);
  assert.match(receipts, /1 original documents in one PDF/);
  assert.doesNotMatch(receipts, /\/3\/file/);
  assert.match(view.section.innerHTML, /Student involvement/);
  assert.match(view.section.innerHTML, /35,592.20/);
  assert.match(view.section.innerHTML, /More than 100 students/);
  assert.doesNotMatch(receipts, /<img|<iframe|<embed|data-remove-evidence/);
  assert.match(view.node('[data-evidence-photos]').innerHTML, /loading="lazy"/);
  assert.match(view.node('[data-evidence-photos]').innerHTML, /<button[^>]*data-evidence-photo="\/api\/evidence\/4\/file"/);
  assert.match(view.node('[data-evidence-photos]').innerHTML, /aria-haspopup="dialog"/);
  assert.doesNotMatch(view.node('[data-evidence-photos]').innerHTML, /target="_blank"/);
});

test('admin upload picker switches formats and rejects PDFs as project photos', async () => {
  const view = screen('ssuAdmin');
  await view.context.mountProjectEvidence();
  assert.match(view.section.innerHTML, /Manage evidence/);
  view.form.elements.kind.value = 'receipt';
  view.listeners.kind();
  assert.equal(view.form.elements.file.accept, 'image/jpeg,image/png,application/pdf');
  view.form.elements.kind.value = 'photo';
  view.listeners.kind();
  assert.equal(view.form.elements.file.accept, 'image/jpeg,image/png');
  view.form.elements.file.files = [{ size: 100, type: 'application/pdf' }];
  await view.listeners.submit({ preventDefault() {}, stopImmediatePropagation() {}, currentTarget: view.form });
  assert.match(view.node('[data-evidence-status]').textContent, /Photos must be JPG or PNG/);
  assert.equal(view.requests.length, 1);
});

test('receipt upload sends selected file and caption, refreshes evidence, and restores upload button', async () => {
  const view = screen('admin');
  await view.context.mountProjectEvidence();
  view.form.elements.kind.value = 'receipt';
  view.form.elements.caption.value = 'Actual bill';
  view.form.elements.file.files = [{ name: 'bill.pdf', size: 10, type: 'application/pdf', data: 'data:application/pdf;base64,JVBERi0=' }];
  await view.listeners.submit({ preventDefault() {}, stopImmediatePropagation() {}, currentTarget: view.form });
  const payload = JSON.parse(view.requests[1].options.body);
  assert.equal(payload.kind, 'receipt');
  assert.equal(payload.caption, 'Actual bill');
  assert.equal(payload.filename, 'bill.pdf');
  assert.equal(payload.data, 'data:application/pdf;base64,JVBERi0=');
  assert.equal(view.requests[2].url, '/api/evidence');
  assert.equal(view.form.didReset, true);
  assert.equal(view.node('submit').disabled, false);
  assert.equal(view.form.elements.file.accept, 'image/jpeg,image/png');
});
