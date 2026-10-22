const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

// Support the familiar CLI option without adding a second test framework.
const options = process.argv.slice(2);
if (options.some(option => option !== '--runInBand')) {
  console.error('Supported test option: --runInBand (runs test files sequentially).');
  process.exit(1);
}
const root = path.resolve(__dirname, '..');
const files = fs.readdirSync(path.join(root, 'tests')).filter(file => file.endsWith('.test.js')).sort();
const result = spawnSync(process.execPath, [
  '--test', ...(options.includes('--runInBand') ? ['--test-concurrency=1'] : []),
  ...files.map(file => path.join('tests', file))
], { cwd: root, stdio: 'inherit' });
if (result.error) console.error(`Test runner could not start (${result.error.code || 'execution error'}).`);
process.exit(result.status ?? 1);
