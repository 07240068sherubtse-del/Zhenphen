const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const entries = [];
const excluded = new Set(['.git', 'node_modules', 'coverage', 'dist', '.agents', '.codex', '.aws']);
function add(relative) {
  const absolute = path.join(root, relative);
  const stat = fs.lstatSync(absolute);
  if (stat.isSymbolicLink()) return;
  const name = path.basename(relative);
  if (excluded.has(name) || (name.startsWith('.') && name !== '.env.example')
      || /\.(log|zip|pem|key|p12|pfx)$/i.test(name) || /^(credentials|secrets).*\.json$/i.test(name)) return;
  if (stat.isDirectory()) {
    for (const item of fs.readdirSync(absolute).sort()) add(path.join(relative, item));
  } else entries.push({ name: relative.replaceAll('\\', '/'), data: fs.readFileSync(absolute) });
}
// Explicit release roots; never traverse the repository or private tooling directories.
for (const file of ['package.json', 'package-lock.json', 'render.yaml']) add(file);
add('Zhenphen');
for (const entry of entries) {
  if (entry.name.split('/').some(name => name === '.git' || name === 'node_modules' || (name.startsWith('.env') && name !== '.env.example'))) {
    throw new Error('Private file detected in release manifest.');
  }
}

// Minimal standards-compliant ZIP writer (stored entries). No external archiver needed.
function crc32(data) {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
const local = [], directory = [];
let offset = 0;
for (const { name, data } of entries) {
  const filename = Buffer.from(name);
  const crc = crc32(data);
  const header = Buffer.alloc(30);
  header.writeUInt32LE(0x04034b50, 0); header.writeUInt16LE(20, 4);
  header.writeUInt16LE(0x800, 6); header.writeUInt16LE(33, 12);
  header.writeUInt32LE(crc, 14); header.writeUInt32LE(data.length, 18); header.writeUInt32LE(data.length, 22);
  header.writeUInt16LE(filename.length, 26);
  local.push(header, filename, data);
  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6);
  central.writeUInt16LE(0x800, 8); central.writeUInt16LE(33, 14);
  central.writeUInt32LE(crc, 16); central.writeUInt32LE(data.length, 20); central.writeUInt32LE(data.length, 24);
  central.writeUInt16LE(filename.length, 28); central.writeUInt32LE(offset, 42);
  directory.push(central, filename);
  offset += header.length + filename.length + data.length;
}
const central = Buffer.concat(directory);
const end = Buffer.alloc(22);
end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10);
end.writeUInt32LE(central.length, 12); end.writeUInt32LE(offset, 16);
const output = path.join(root, 'dist', 'zhenphen-release.zip');
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, Buffer.concat([...local, central, end]));
console.log(`Created ${output} (${entries.length} files; private files and dependencies excluded).`);
