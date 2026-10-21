const { test } = require('node:test');
const assert = require('node:assert/strict');
const { appBaseUrl } = require('../config/runtime');

test('production email links require public HTTPS origin', () => {
  for (const value of ['http://example.com', 'https://localhost:3000', 'https://127.0.0.1', 'https://[::1]', 'https://example.com/path', 'https://user:pass@example.com', 'https://example.com/?token=x']) {
    assert.throws(() => appBaseUrl({ NODE_ENV: 'production', APP_BASE_URL: value }));
  }
  assert.equal(appBaseUrl({ NODE_ENV: 'production', APP_BASE_URL: 'https://site.example.com/' }), 'https://site.example.com');
  assert.equal(appBaseUrl({ NODE_ENV: 'production', RENDER_EXTERNAL_URL: 'https://service.example.com' }), 'https://service.example.com');
  assert.equal(appBaseUrl({ NODE_ENV: 'development', APP_BASE_URL: 'http://localhost:3000' }), 'http://localhost:3000');
  assert.throws(() => appBaseUrl({}));
});
