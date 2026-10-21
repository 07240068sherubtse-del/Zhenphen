const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const Module = require('node:module');
const root = path.resolve(__dirname, '..');
let count = 0;
function visit(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.name.startsWith('.') || ['node_modules', 'coverage'].includes(entry.name)) continue;
    const filename = path.join(directory, entry.name);
    if (entry.isDirectory()) visit(filename);
    else if (/\.(js|cjs)$/.test(entry.name)) {
      const source = fs.readFileSync(filename, 'utf8');
      new vm.Script(filename.includes(`${path.sep}public${path.sep}`) ? source : Module.wrap(source), { filename });
      count++;
    }
  }
}
visit(root);
console.log(`Syntax checks passed for ${count} JavaScript files.`);
