const assert = require('node:assert/strict');
const { load } = require('./helpers.cjs');

const testMailUrl = 'https://script.google.com/macros/s/TEST_ONLY_DEPLOYMENT/exec';
const testMailSecret = 'test-only-apps-script-secret-not-a-real-credential';
const environmentSnapshots = new WeakMap();

function mailEnvironment(t, overrides = {}) {
  const values = {
    NODE_ENV: 'test', APP_BASE_URL: 'https://site.example.com',
    MAIL_WEB_APP_URL: testMailUrl, MAIL_SECRET: testMailSecret,
    SESSION_SECRET: 'test-only-session-secret-at-least-32-characters', ...overrides
  };
  let previous = environmentSnapshots.get(t);
  if (!previous) {
    previous = new Map();
    environmentSnapshots.set(t, previous);
    t.after(() => {
      for (const [key, value] of previous) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
      environmentSnapshots.delete(t);
    });
  }
  for (const [key, value] of Object.entries(values)) {
    if (!previous.has(key)) previous.set(key, process.env[key]);
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

function emailService(fetchMock, baseUrl = 'https://site.example.com') {
  assert.equal(typeof fetchMock, 'function', 'Every mail test must supply an offline fetch mock');
  return load('services/emailService.js', {
    '../config/runtime': { appBaseUrl: () => baseUrl }
  }, { fetch: fetchMock }).createEmailService();
}

function mailFetch(onMessage = async () => {}) {
  return async (endpoint, options) => {
    assert.equal(String(endpoint), testMailUrl);
    assert.equal(options.method, 'POST');
    assert.equal(options.headers['Content-Type'], 'application/json');
    const payload = JSON.parse(options.body);
    assert.equal(payload.secret, testMailSecret);
    await onMessage(payload);
    return { ok: true, json: async () => ({ ok: true }) };
  };
}

module.exports = { mailEnvironment, emailService, mailFetch, testMailUrl, testMailSecret };
