const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { PDFDocument } = require('pdf-lib');
const { createReceiptPdf } = require('../services/receiptPdf');
const { createEvidenceRouter } = require('../routes/evidence');
const { serve, database, empty } = require('./helpers.cjs');

test('all ten supplied bills fit on separate A4 pages in one PDF', async () => {
  const directory = path.resolve(__dirname, '../data/evidence/lower-zangtolperi-108-chorten');
  const manifest = JSON.parse(fs.readFileSync(path.join(directory, 'manifest.json'), 'utf8'));
  const files = manifest.files.filter(file => file.kind === 'receipt').map(file => ({
    caption: file.caption, mime_type: 'image/jpeg', content: fs.readFileSync(path.join(directory, file.filename))
  }));
  const bytes = await createReceiptPdf(files);
  const pdf = await PDFDocument.load(bytes);
  assert.equal(pdf.getPageCount(), 10);
  for (const page of pdf.getPages()) {
    assert.equal(page.getWidth(), 595.28);
    assert.equal(page.getHeight(), 841.89);
    assert.equal(page.node.Resources().lookup(require('pdf-lib').PDFName.of('XObject')).entries().length, 1);
  }
});

test('uploaded multi-page PDF receipts retain every page', async () => {
  const source = await PDFDocument.create();
  source.addPage([300, 400]); source.addPage([500, 600]);
  const result = await PDFDocument.load(await createReceiptPdf([{ mime_type: 'application/pdf', content: await source.save() }]));
  assert.equal(result.getPageCount(), 2);
  assert.equal(result.getPages()[1].getHeight(), 600);
});

test('consolidated receipt route requires login and reports empty evidence', async t => {
  const db = database(() => empty());
  const anonymous = await serve(t, [['/evidence', createEvidenceRouter(db.pool)]]);
  assert.equal((await anonymous('/evidence/receipts.pdf', null, 'GET')).status, 401);
  assert.equal(db.calls.length, 0);
  const member = await serve(t, [['/evidence', createEvidenceRouter(db.pool)]], { id: '1', role: 'student' });
  assert.equal((await member('/evidence/receipts.pdf', null, 'GET')).status, 404);
  assert.match(db.calls[0].sql, /kind = 'receipt'/);
});
