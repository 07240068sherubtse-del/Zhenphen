const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = file => fs.readFileSync(path.resolve(__dirname, '../public/js', file), 'utf8');

function preview(page = 'donation') {
  const listeners = new Map();
  const storage = { getItem() { return null; }, removeItem() {}, setItem() { throw new Error('Storage write'); } };
  const context = { document: { body: { dataset: { page } }, addEventListener: (type, callback) => listeners.set(type, callback) },
    window: {}, sessionStorage: storage, localStorage: storage };
  vm.createContext(context);
  vm.runInContext(source('core.js'), context);
  vm.runInContext(source('donation-preview.js'), context);
  vm.runInContext(source('pages/public.js'), context);
  return { context, listeners };
}

test('original tab layout remains with one visible panel, one notice, and passive donation controls', () => {
  const { context } = preview();
  const html = vm.runInContext('donation()', context);
  const notice = 'Preview only \u2014 donations are not available yet. No information or payments will be submitted.';
  assert.equal(html.split(notice).length - 1, 1);
  assert.match(html, /data-donation-preview="money"/);
  assert.match(html, /data-donation-preview="clothes"/);
  assert.doesNotMatch(html, /<form\b|data-form=|data-amount=|\sname=/);
  assert.doesNotMatch(html, /id="money-panel"[^>]*\bhidden/);
  assert.match(html, /id="clothes-panel"[^>]*\bhidden/);
  assert.match(html, /data-tab="money"/);
  assert.match(html, /role="tablist"/);
  assert.match(html, /Before you continue/);
  const clothing = vm.runInContext("donation('clothes')", context);
  assert.match(clothing, /id="money-panel"[^>]*\bhidden/);
  assert.doesNotMatch(clothing, /id="clothes-panel"[^>]*\bhidden/);
  const controls = html.match(/<(?:input|button|select|textarea)\b[^>]*>/g);
  assert.ok(controls.length > 20);
  for (const control of controls) {
    if (control.includes('role="tab"')) { assert.doesNotMatch(control, /disabled/); continue; }
    assert.match(control, /\sdisabled(?:\s|>)/);
    assert.match(control, /tabindex="-1"/);
  }
  assert.doesNotMatch(html, /details for your demo history|forms below are interactive previews/);
});

test('synthetic click, keyboard, edit and submit events cannot reach donation handlers', () => {
  const { listeners } = preview();
  for (const type of ['click', 'keydown', 'input', 'change', 'submit']) {
    let prevented = false;
    let stopped = false;
    listeners.get(type)({ target: { closest: () => ({}) }, preventDefault() { prevented = true; }, stopImmediatePropagation() { stopped = true; } });
    assert.equal(prevented, true, type);
    assert.equal(stopped, true, type);
  }
});

test('even direct donation submission is blocked before reading fields, network, storage or success', async () => {
  const { context } = preview();
  const fail = () => { throw new Error('Forbidden side effect'); };
  context.FormData = class { constructor() { fail(); } };
  context.fetch = fail;
  context.apiRequest = fail;
  context.displayFormSuccess = fail;
  const live = source('live.js');
  vm.runInContext(live.slice(0, live.indexOf("document.addEventListener('submit'")), context);
  context.apiRequest = fail;
  context.displayFormSuccess = fail;
  for (const type of ['money', 'clothes']) {
    await context.submitLiveForm({ dataset: { form: type } }, { preventDefault() {}, stopImmediatePropagation() {} });
  }
  let rendered = false;
  context.render = () => { rendered = true; };
  await context.bootLiveApp();
  assert.equal(rendered, true);
});

test('other pages retain their existing donation forms and interactions', () => {
  const { context, listeners } = preview('clothesForm');
  const html = vm.runInContext("donation('clothes')", context);
  assert.match(html, /<form data-form="clothes">/);
  assert.match(html, /data-tab="clothes"/);
  assert.doesNotMatch(html, /data-donation-preview=/);
  listeners.get('click')({ preventDefault() { throw new Error('Other page blocked'); } });
});
