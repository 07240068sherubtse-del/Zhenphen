const fs = require('node:fs');
const path = require('node:path');

// Preserve the supplied document images in private storage and import once.
// A completed import is retained so deleted evidence stays deleted on restart.
async function importProvidedEvidence(pool) {
  const directory = path.join(__dirname, '../data/evidence/lower-zangtolperi-108-chorten');
  const manifest = JSON.parse(fs.readFileSync(path.join(directory, 'manifest.json'), 'utf8'));
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const imported = await client.query(`INSERT INTO project_evidence_imports (source_key)
      VALUES ($1) ON CONFLICT DO NOTHING RETURNING source_key`, [manifest.sourceSha256]);
    if (imported.rows.length) {
      for (const file of manifest.files) {
        const content = fs.readFileSync(path.join(directory, file.filename));
        await client.query(`INSERT INTO project_evidence (project_key, kind, filename, caption, mime_type, content)
          VALUES ($1, $2, $3, $4, $5, $6)`,
        [manifest.projectKey, file.kind, file.filename, file.caption, 'image/jpeg', content]);
      }
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

module.exports = { importProvidedEvidence };
