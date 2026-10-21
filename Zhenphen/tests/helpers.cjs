const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const express = require('express');
const { apiError } = require('../middleware/api');

// Load actual CommonJS application modules with explicit in-memory dependencies.
// Never import db.js, read .env, or connect to SMTP/PostgreSQL in these tests.
function load(relative, mocks) {
  const filename = path.resolve(__dirname, '..', relative);
  const mod = new Module(filename, module);
  mod.filename = filename;
  mod.paths = Module._nodeModulePaths(path.dirname(filename));
  const original = mod.require.bind(mod);
  mod.require = name => Object.hasOwn(mocks, name) ? mocks[name] : original(name);
  mod._compile(fs.readFileSync(filename, 'utf8'), filename);
  return mod.exports;
}

async function serve(t, routers, user = null) {
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => {
    req.user = user;
    req.session = {
      userId: user?.id,
      regenerate(callback) { this.userId = undefined; callback(); },
      save(callback) { callback(); },
      destroy(callback) { callback(); }
    };
    next();
  });
  for (const [prefix, router] of routers) app.use(prefix, router);
  app.use(apiError);
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
  return async (url, body, method = 'POST') => {
    const response = await fetch(`http://127.0.0.1:${server.address().port}${url}`, {
      method, headers: { 'Content-Type': 'application/json' },
      ...(method === 'GET' ? {} : { body: JSON.stringify(body || {}) })
    });
    const text = await response.text();
    let resultBody;
    try { resultBody = JSON.parse(text); } catch { resultBody = { error: text }; }
    return { status: response.status, body: resultBody };
  };
}

function database(query) {
  const calls = [];
  const pool = {
    async query(sql, params) {
      calls.push({ sql, params });
      if (['BEGIN', 'COMMIT', 'ROLLBACK'].includes(sql)) return { rows: [], rowCount: 0 };
      return query(sql, params);
    },
    async connect() { return { query: pool.query, release() { calls.push({ sql: 'RELEASE' }); } }; }
  };
  return { pool, calls };
}
const empty = () => ({ rows: [], rowCount: 0 });
const rows = (...values) => ({ rows: values, rowCount: values.length });
module.exports = { load, serve, database, empty, rows };
