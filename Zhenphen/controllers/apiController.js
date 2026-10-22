const { clean, publicUser, validateEmail, validImage } = require('../utils/account');
const { httpError } = require('../middleware/api');

function createApiController({ pool, users }) {
  async function feedback(req, res) {
    const name = typeof req.body.name === 'string' ? req.body.name.trim() : '';
    const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const subject = typeof req.body.subject === 'string' ? req.body.subject.trim() : '';
    const message = typeof req.body.message === 'string' ? req.body.message.trim() : '';
    const subjects = ['Feedback or suggestion', 'Student volunteering', 'Making a donation', 'Donation records and receipts', 'Clothing or ration support', 'Partnership or general question'];
    if (name.length < 2 || name.length > 120 || !validateEmail(email) || !subjects.includes(subject) || message.length < 10 || message.length > 3000 || req.body.consent !== 'yes') {
      throw httpError(400, 'Enter your name, a valid email, a topic, and a message between 10 and 3000 characters. Please agree to share these details with the team.');
    }
    const result = await pool.query(`INSERT INTO feedback_messages (user_id, name, email, subject, message)
      VALUES ($1, $2, $3, $4, $5) RETURNING id::text`, [req.user?.id || null, name, email, subject, message]);
    res.status(201).json({ reference: result.rows[0].id });
  }

  async function profile(req, res) {
    const profile = await users.findProfile([req.user.id]);
    res.json({ profile: publicUser(profile.rows[0]), avatar: profile.rows[0].avatar });
  }

  async function updateProfile(req, res) {
    const name = clean(req.body.name, 120);
    const phone = clean(req.body.phone, 40);
    const bio = clean(req.body.bio, 500);
    const skills = clean(req.body.skills, 300);
    if (name.length < 2) throw httpError(400, 'Your name must contain at least two characters.');

    const avatar = req.body.avatar;
    let avatarMime = null;
    let avatarData = null;
    if (avatar !== undefined) {
      const match = typeof avatar === 'string' && avatar.match(/^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/);
      if (!match) throw httpError(400, 'Choose a PNG, JPG, or WebP profile photo.');
      avatarMime = match[1];
      avatarData = Buffer.from(match[2], 'base64');
      if (avatarData.length > 1024 * 1024) throw httpError(413, 'Choose a profile photo smaller than 1 MB.');
      if (!validImage(avatarMime, avatarData)) throw httpError(400, 'The selected file does not match a supported image format.');
    }
    const result = await users.updateProfile([name, phone, bio, skills, avatarMime, avatarData, req.user.id]);
    res.json({ profile: publicUser(result.rows[0]) });
  }

  async function applyVolunteer(req, res) {
    const interest = clean(req.body.interest, 140);
    const availability = clean(req.body.availability, 140);
    const skills = clean(req.body.skills, 500);
    const ssuCollaboration = req.body.ssuInterest === 'yes';
    if (!interest || !availability) throw httpError(400, 'Choose a volunteer interest and availability.');
    const result = await pool.query(
      `INSERT INTO volunteer_applications (user_id, interest, availability, skills, ssu_collaboration)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id::text, interest, availability, skills, ssu_collaboration AS "ssuCollaboration",
                 status, submitted_at AS "submittedAt"`,
      [req.user.id, interest, availability, skills, ssuCollaboration]
    );
    res.status(201).json({ application: result.rows[0] });
  }

  async function siteContent(req, res) {
    const result = await pool.query(
      `SELECT sc.homepage_title AS "homepageTitle",
              sc.homepage_summary AS "homepageSummary",
              (SELECT COUNT(DISTINCT user_id)::integer
               FROM ssu_registrations
               WHERE attendance IN ('Checked in', 'Checked out')) AS "volunteersServed"
       FROM site_content sc WHERE sc.id = 1`
    );
    if (!result.rowCount) throw new Error('Homepage content settings have not been initialized.');
    const { volunteersServed, ...siteContent } = result.rows[0];
    res.json({ siteContent, metrics: { volunteersServed } });
  }

  async function memberActivity(req, res) {
    const [applications, registrations] = await Promise.all([
      pool.query(
        `SELECT id::text, interest, availability, skills, ssu_collaboration AS "ssuCollaboration",
                status, submitted_at AS "submittedAt"
         FROM volunteer_applications WHERE user_id = $1 ORDER BY submitted_at DESC`,
        [req.user.id]
      ),
      pool.query(
        `SELECT e.id::text AS "eventId", e.title, e.event_date::text AS date, e.location,
                r.attendance, r.registered_at AS "registeredAt"
         FROM ssu_registrations r JOIN ssu_events e ON e.id = r.event_id
         WHERE r.user_id = $1 ORDER BY r.registered_at DESC`,
        [req.user.id]
      )
    ]);
    res.json({ applications: applications.rows, registrations: registrations.rows, donations: [] });
  }
  function checkout(req, res) {
    res.status(503).json({ error: 'Online donations are unavailable until BNB merchant payment verification is configured. No payment or donation record was created.' });
  }
  return { feedback, profile, updateProfile, applyVolunteer, siteContent, memberActivity, checkout };
}
module.exports = { createApiController };
