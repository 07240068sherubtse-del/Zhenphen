const assert = require('node:assert/strict');

// Exercise the running local server without loading .env or supplying credentials.
// Does not create accounts, send email, or modify authenticated records.
async function main() {
  const base = 'http://localhost:3000';
  const health = await fetch(`${base}/health`);
  const data = await health.json();
  console.log(`GET /health: ${health.status}; database: ${data.database}`);
  assert.equal(health.status, 200);
  assert.equal(data.database, 'connected');
  const checks = [
    ['GET', '/api/auth/session', undefined, 200],
    ['GET', '/api/profile', undefined, 401],
    ['GET', '/api/member/activity', undefined, 401],
    ['GET', '/api/admin/overview', undefined, 401],
    ['GET', '/api/ssu/admin/overview', undefined, 401],
    ['POST', '/api/auth/verification/confirm', { token: 'invalid-local-smoke-token' }, 400],
    ['POST', '/api/auth/password-reset/confirm', { token: 'invalid-local-smoke-token' }, 400],
    ['POST', '/api/donations/checkout', {}, 503]
  ];
  for (const [method, url, body, expected] of checks) {
    const response = await fetch(base + url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      ...(body ? { body: JSON.stringify(body) } : {})
    });
    console.log(`${method} ${url}: ${response.status}; expected: ${expected}`);
    assert.equal(response.status, expected);
  }
  console.log('Local smoke checks passed. No accounts created or emails sent.');
}

main().catch(() => {
  console.error('Local smoke checks failed. Ensure the local app is running on port 3000 and inspect its terminal.');
  process.exitCode = 1;
});
