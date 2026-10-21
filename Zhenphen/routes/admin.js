const express = require('express');
const { pool } = require('../db');
const { requireAuth, requireRole, asyncRoute, httpError } = require('../middleware/api');

const router = express.Router();
router.param('userId', require('../middleware/api').validateId);
const editableRoles = new Set(['student', 'supporter', 'admin', 'ssuAdmin']);

router.use(requireAuth, requireRole('admin'));

router.get('/feedback', asyncRoute(async (req, res) => {
  const result = await pool.query(`SELECT id::text, name, email, subject, message,
    user_id::text AS "userId", created_at AS "createdAt" FROM feedback_messages ORDER BY created_at DESC, id DESC`);
  res.json({ messages: result.rows });
}));

router.get('/overview', asyncRoute(async (req, res) => {
  const [counts, users, content] = await Promise.all([
    pool.query(
      `SELECT
         (SELECT COUNT(*)::integer FROM users) AS "totalUsers",
         (SELECT COUNT(*)::integer FROM users WHERE role = 'student') AS students,
         (SELECT COUNT(*)::integer FROM users WHERE role = 'supporter') AS supporters,
         (SELECT COUNT(*)::integer FROM users WHERE role = 'ssuAdmin') AS "ssuAdmins",
         (SELECT COUNT(*)::integer FROM ssu_events) AS "serviceEvents",
         (SELECT COUNT(*)::integer FROM volunteer_applications) AS "volunteerApplications"`
    ),
    pool.query(
      `SELECT id::text, name, email, role, member_type AS "memberType", created_at AS "createdAt"
       FROM users
       ORDER BY created_at DESC, id DESC`
    ),
    pool.query(
      `SELECT homepage_title AS "homepageTitle", homepage_summary AS "homepageSummary"
       FROM site_content WHERE id = 1`
    )
  ]);
  res.json({
    metrics: counts.rows[0],
    users: users.rows,
    siteContent: content.rows[0],
    donations: { available: false, reason: 'Online donations are unavailable until BNB merchant payment verification is configured.' }
  });
}));

router.put('/users/:userId/role', asyncRoute(async (req, res) => {
  const role = req.body.role;
  if (!editableRoles.has(role)) throw httpError(400, 'Choose a valid member, SSU admin, or site admin role.');
  if (String(req.user.id) === req.params.userId) {
    throw httpError(409, 'You cannot change your own administrator role.');
  }

  const result = await pool.query(
    `UPDATE users SET role = $1, updated_at = NOW()
     WHERE id = $2
     RETURNING id::text, name, email, role`,
    [role, req.params.userId]
  );
  if (!result.rowCount) throw httpError(404, 'This account could not be found.');
  res.json({ user: result.rows[0] });
}));

router.put('/site-content', asyncRoute(async (req, res) => {
  const homepageTitle = typeof req.body.homepageTitle === 'string' ? req.body.homepageTitle.trim() : '';
  const homepageSummary = typeof req.body.homepageSummary === 'string' ? req.body.homepageSummary.trim() : '';
  if (!homepageTitle || homepageTitle.length > 120 || !homepageSummary || homepageSummary.length > 500) {
    throw httpError(400, 'Enter a homepage title (up to 120 characters) and summary (up to 500 characters).');
  }
  const result = await pool.query(
    `UPDATE site_content
     SET homepage_title = $1, homepage_summary = $2, updated_at = NOW(), updated_by = $3
     WHERE id = 1
     RETURNING homepage_title AS "homepageTitle", homepage_summary AS "homepageSummary"`,
    [homepageTitle, homepageSummary, req.user.id]
  );
  if (!result.rowCount) throw new Error('Homepage content settings have not been initialized.');
  res.json({ siteContent: result.rows[0] });
}));

module.exports = router;
