const express = require('express');
const { requireAuth, requireRole, asyncRoute, httpError, validateId } = require('../middleware/api');
const costSummary = require('../data/evidence/lower-zangtolperi-108-chorten/cost-summary.json');

const project = Object.freeze({
  id: 'lower-zangtolperi-108-chorten',
  title: 'Painting of Lower Zangtolperi 108 Chorten',
  completed: '2026-09-03',
  completedLabel: '3 September 2026',
  location: 'Lower Zangtolperi 108 Chorten',
  duration: 'Approximately one week',
  schedule: 'Work carried out on weekends',
  studentInvolvement: 'More than 100 students participated across different days, helping with the activity from start to finish. Work was carried out on weekends.',
  budgetReceived: null,
  costEstimate: {
    ...costSummary,
    grossChhetrum: costSummary.entries.reduce((sum, entry) => sum + Math.max(0, entry.amountChhetrum), 0),
    creditChhetrum: -costSummary.entries.reduce((sum, entry) => sum + Math.min(0, entry.amountChhetrum), 0),
    netChhetrum: costSummary.entries.reduce((sum, entry) => sum + entry.amountChhetrum, 0)
  },
  organizers: 'Social Services Unit, in collaboration with Zhenphen Association'
});

function createEvidenceRouter(pool) {
  const router = express.Router();
  router.use(requireAuth);
  router.param('id', validateId);
  router.get('/receipts.pdf', asyncRoute(async (req, res) => {
    const result = await pool.query(`SELECT content, mime_type, caption FROM project_evidence
      WHERE project_key = $1 AND kind = 'receipt' ORDER BY created_at, id`, [project.id]);
    if (!result.rows.length) throw httpError(404, 'No bills or receipts are available yet.');
    const content = await require('../services/receiptPdf').createReceiptPdf(result.rows);
    res.set({ 'Content-Type': 'application/pdf',
      'Content-Disposition': `${req.query.download === '1' ? 'attachment' : 'inline'}; filename="chorten-bills-and-receipts.pdf"`,
      'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' });
    res.send(content);
  }));
  router.get('/', asyncRoute(async (req, res) => {
    const result = await pool.query(`SELECT id, kind, filename, caption, mime_type AS "mimeType"
      FROM project_evidence WHERE project_key = $1 ORDER BY created_at, id`, [project.id]);
    res.json({ project, files: result.rows });
  }));
  router.post('/', requireRole('admin', 'ssuAdmin'), asyncRoute(async (req, res) => {
    const { kind, filename, caption = '', data } = req.body || {};
    if (!['photo', 'receipt'].includes(kind) || typeof filename !== 'string' || !filename.trim() || filename.length > 160 ||
        /[\x00-\x1f\x7f/\\]/.test(filename) || typeof caption !== 'string' || caption.length > 300) {
      throw httpError(400, 'Choose a photo or receipt and provide a valid filename and caption.');
    }
    if (typeof data !== 'string' || data.length > 1400000) throw httpError(413, 'Choose a file up to 1 MB.');
    const match = /^data:(image\/jpeg|image\/png|application\/pdf);base64,([A-Za-z0-9+/]+={0,2})$/.exec(data);
    if (!match || (kind === 'photo' && match[1] === 'application/pdf')) throw httpError(400, 'Photos must be JPG or PNG. Receipts may also be PDF.');
    const bytes = Buffer.from(match[2], 'base64');
    if (!bytes.length || bytes.length > 1048576) throw httpError(413, 'Choose a file up to 1 MB.');
    const valid = match[1] === 'image/jpeg' ? bytes.subarray(0, 3).equals(Buffer.from([255, 216, 255])) :
      match[1] === 'image/png' ? bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) :
        bytes.subarray(0, 5).toString() === '%PDF-';
    if (!valid || bytes.toString('base64') !== match[2]) throw httpError(400, 'The file does not match its declared format.');
    const result = await pool.query(`INSERT INTO project_evidence (project_key, kind, filename, caption, mime_type, content, uploaded_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
    [project.id, kind, filename.trim(), caption.trim(), match[1], bytes, req.user.id]);
    res.status(201).json({ id: result.rows[0].id });
  }));
  router.get('/:id/file', asyncRoute(async (req, res) => {
    const result = await pool.query('SELECT mime_type, content FROM project_evidence WHERE id = $1 AND project_key = $2', [req.params.id, project.id]);
    if (!result.rows[0]) throw httpError(404, 'Evidence file not found.');
    const file = result.rows[0];
    res.set({ 'Content-Type': file.mime_type, 'Content-Disposition': 'inline', 'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "sandbox; default-src 'none'" });
    res.send(file.content);
  }));
  router.delete('/:id', requireRole('admin', 'ssuAdmin'), asyncRoute(async (req, res) => {
    const result = await pool.query('DELETE FROM project_evidence WHERE id = $1 AND project_key = $2 RETURNING id', [req.params.id, project.id]);
    if (!result.rows.length) throw httpError(404, 'Evidence file not found.');
    res.status(204).end();
  }));
  return router;
}

module.exports = { createEvidenceRouter, project };
