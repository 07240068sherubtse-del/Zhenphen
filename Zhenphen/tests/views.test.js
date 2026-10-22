const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { serve } = require('./helpers.cjs');

test('all EJS pages render through Express at existing HTML URLs without exposing templates', async t => {
  const request = await serve(t, [['/', require('../routes')]]);
  const files = fs.readdirSync(path.resolve(__dirname, '../views'));
  assert.ok(!files.some(file => file.endsWith('.html')));
  for (const file of files.filter(file => file.endsWith('.ejs'))) {
    const result = await request(`/${file.replace('.ejs', '.html')}`, undefined, 'GET');
    assert.equal(result.status, 200, file);
    assert.ok(result.body.error.includes('id="app"'), file);
    assert.ok(!result.body.error.includes('<%'), file);
    assert.ok(!result.body.error.includes('Application scaffold is ready'), file);
  }
  const home = await request('/', undefined, 'GET');
  assert.equal(home.status, 200);
  assert.ok(home.body.error.includes('data-page="home"'));
  assert.equal((await request('/index.ejs', undefined, 'GET')).status, 404);
  assert.equal((await request('/unknown.html', undefined, 'GET')).status, 404);
});
