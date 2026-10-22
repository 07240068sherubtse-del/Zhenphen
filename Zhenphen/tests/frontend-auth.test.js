const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function frontend() {
  const stored = new Map([
    ['zh-signed', 'true'], ['zh-member', JSON.stringify({ name: 'Forged', role: 'admin' })]
  ]);
  const storage = { getItem: key => stored.get(key) ?? null, setItem: (key, value) => stored.set(key, value), removeItem: key => stored.delete(key) };
  const context = {
    sessionStorage: storage, localStorage: storage,
    document: { body: { dataset: { page: 'login' } } }, window: {},
    console: { error() {} }, URLSearchParams,
    FormData: class { constructor(form) { return Object.entries(form.values); } }
  };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.resolve(__dirname, '../public/js/core.js'), 'utf8'), context);
  const source = fs.readFileSync(path.resolve(__dirname, '../public/js/live.js'), 'utf8');
  vm.runInContext(source.slice(0, source.indexOf("document.addEventListener('submit'")), context);
  return { context, stored };
}

test('forged browser identity is ignored; server identity is never persisted to browser storage', () => {
  const { context, stored } = frontend();
  assert.equal(vm.runInContext("store.get('signed', false)", context), false);
  assert.equal(vm.runInContext('memberRole()', context), '');
  vm.runInContext("store.set('member', { id: '1', role: 'student' }); store.set('signed', true)", context);
  assert.equal(vm.runInContext("store.get('signed', false)", context), true);
  assert.ok(!stored.has('zh-member'));
  assert.ok(!stored.has('zh-signed'));
});

test('failed live login/signup never authenticates or saves an account locally', async () => {
  const { context, stored } = frontend();
  context.fetch = async () => { throw new Error('Network unavailable'); };
  await assert.rejects(context.apiRequest('/api/auth/session'), /live service could not be reached/);
  const errors = [];
  context.apiRequest = async () => { throw new Error('Sign-in service unavailable'); };
  context.showRequestError = (form, message) => errors.push(message);
  const event = { preventDefault() {}, stopImmediatePropagation() {} };
  for (const type of ['login', 'join']) {
    const form = { dataset: { form: type }, values: { email: 'test@example.com', username: 'test@example.com' }, querySelector: () => null };
    await context.submitLiveForm(form, event);
    assert.equal(vm.runInContext("store.get('signed', false)", context), false);
    assert.ok(!stored.has('zh-member'));
  }
  assert.equal(errors.length, 2);
  context.apiRequest = async () => ({ user: { role: 'admin' } });
  await context.submitLiveForm({ dataset: { form: 'login' }, values: {}, querySelector: () => null }, event);
  assert.match(errors[2], /invalid sign-in response/);
  assert.equal(vm.runInContext("store.get('signed', false)", context), false);
  assert.ok(!stored.has('zh-member'));
});
