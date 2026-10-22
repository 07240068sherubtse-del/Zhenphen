const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

test('signup/resend opens code entry; verification redirects to login only after API success', async () => {
  const source = fs.readFileSync(path.resolve(__dirname, '../public/js/live.js'), 'utf8');
  const redirects = [];
  const state = new Map();
  let fails = false;
  let error;
  const context = {
    window: {},
    FormData: class { constructor(form) { return Object.entries(form.values); } },
    store: { set: (key, value) => state.set(key, value), remove: key => state.delete(key) },
    location: { assign: url => redirects.push(url), replace: url => redirects.push(url) },
    apiRequest: async () => { if (fails) throw new Error('Incorrect code'); return { message: 'Verified' }; }
  };
  vm.createContext(context);
  vm.runInContext(source.slice(0, source.indexOf("document.addEventListener('submit'")), context);
  context.showRequestError = (form, message) => { error = message; };
  const form = { dataset: { form: 'join' }, elements: { email: { value: 'test@example.com' } } };
  context.displayFormSuccess(form);
  assert.equal(state.get('verificationEmail'), 'test@example.com');
  assert.equal(redirects.pop(), 'join.html?verify=1');
  form.dataset.form = 'resend-verification';
  context.displayFormSuccess(form);
  assert.equal(redirects.pop(), 'join.html?verify=1');
  const verify = { dataset: { form: 'verify-email' }, values: { email: 'test@example.com', code: '012345' }, querySelector: () => null };
  const event = { preventDefault() {}, stopImmediatePropagation() {} };
  fails = true;
  await context.submitLiveForm(verify, event);
  assert.equal(error, 'Incorrect code');
  assert.equal(redirects.length, 0);
  fails = false;
  await context.submitLiveForm(verify, event);
  assert.equal(redirects.pop(), 'login.html?verified=1');
  assert.ok(!state.has('verificationEmail'));
});
