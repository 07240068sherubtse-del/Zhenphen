const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const path = require('path');
const nodemailer = require('nodemailer');
const { rateLimit } = require('express-rate-limit');
const { pool } = require('../db');
const { requireAuth, requireRole, asyncRoute, httpError } = require('../middleware/api');

const router = express.Router();
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: true, legacyHeaders: false, message: { error: 'Too many requests. Please wait and try again later.' } });
const registerLimiter = rateLimit({ windowMs: 60 * 60 * 1000, limit: 5, standardHeaders: true, legacyHeaders: false, message: { error: 'Too many requests. Please wait and try again later.' } });
const applicationLimiter = rateLimit({ windowMs: 60 * 60 * 1000, limit: 10, standardHeaders: true, legacyHeaders: false, message: { error: 'Too many requests. Please wait and try again later.' } });
const passwordResetLimiter = rateLimit({ windowMs: 60 * 60 * 1000, limit: 5, standardHeaders: true, legacyHeaders: false, message: { error: 'Too many requests. Please wait and try again later.' } });
const memberQuery = 'SELECT id, name, email, role, member_type AS "memberType", phone, bio, skills, created_at AS "createdAt" FROM users';
const passwordResetAccepted = 'If an account exists for that address, password reset instructions will be sent.';

function clean(value, maxLength) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function publicUser(user) {
  return {
    id: String(user.id),
    name: user.name,
    email: user.email,
    role: user.role,
    memberType: user.memberType,
    phone: user.phone,
    bio: user.bio,
    skills: user.skills
  };
}

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254;
}

function passwordResetMailConfig() {
  const { EMAIL_SMTP_HOST, EMAIL_SMTP_PORT, EMAIL_SMTP_USER, EMAIL_SMTP_PASSWORD, EMAIL_FROM } = process.env;
  const port = Number(EMAIL_SMTP_PORT || 587);
  let baseUrl;
  try {
    baseUrl = new URL(require('../config/runtime').appBaseUrl());
  } catch {
    throw httpError(503, 'Account email is not configured. Ask the site administrator to configure SMTP and APP_BASE_URL.');
  }
  if (!EMAIL_SMTP_HOST || !EMAIL_SMTP_USER || !EMAIL_SMTP_PASSWORD || !EMAIL_FROM
      || !Number.isInteger(port) || port < 1 || port > 65535
      || !['http:', 'https:'].includes(baseUrl.protocol)
      || (process.env.NODE_ENV === 'production' && baseUrl.protocol !== 'https:')
      || baseUrl.username || baseUrl.password) {
    throw httpError(503, 'Account email is not configured. Ask the site administrator to configure SMTP and APP_BASE_URL.');
  }
  return {
    mailer: nodemailer.createTransport({
      host: EMAIL_SMTP_HOST,
      port,
      secure: process.env.EMAIL_SMTP_SECURE === 'true' || port === 465,
      auth: { user: EMAIL_SMTP_USER, pass: EMAIL_SMTP_PASSWORD },
      requireTLS: process.env.NODE_ENV === 'production',
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 15000
    }),
    from: { name: 'Zhenphen', address: EMAIL_FROM },
    baseUrl: baseUrl.origin
  };
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character]);
}

function validImage(mime, data) {
  if (mime === 'image/png') return data.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  if (mime === 'image/jpeg') return data[0] === 255 && data[1] === 216 && data.at(-2) === 255 && data.at(-1) === 217;
  return mime === 'image/webp' && data.toString('ascii', 0, 4) === 'RIFF' && data.toString('ascii', 8, 12) === 'WEBP';
}

async function currentUser(userId) {
  const result = await pool.query(`${memberQuery} WHERE id = $1`, [userId]);
  return result.rows[0] || null;
}

router.get('/auth/session', asyncRoute(async (req, res) => {
  if (!req.session.userId) return res.json({ user: null });
  const user = await currentUser(req.session.userId);
  if (!user) {
    req.session.destroy(() => {});
    return res.json({ user: null });
  }
  res.json({ user: publicUser(user) });
}));

const feedbackLimiter = rateLimit({ windowMs: 60 * 60 * 1000, limit: 5, standardHeaders: true, legacyHeaders: false, message: { error: 'Too many requests. Please wait and try again later.' } });
router.post('/feedback', feedbackLimiter, asyncRoute(async (req, res) => {
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
}));

router.post('/auth/register', registerLimiter, asyncRoute(async (req, res) => {
  const name = clean(req.body.name, 120);
  const email = clean(req.body.email, 255).toLowerCase();
  const password = typeof req.body.password === 'string' ? req.body.password : '';
  const memberType = clean(req.body.memberType, 80);
  if (name.length < 2 || !validateEmail(email) || password.length < 12 || password.length > 128 || Buffer.byteLength(password, 'utf8') > 72) {
    throw httpError(400, 'Enter your name, a valid email, and a password with 12-128 characters (at most 72 UTF-8 bytes).');
  }
  if (!['Sherubtse College student', 'Community supporter / donor'].includes(memberType)) {
    throw httpError(400, 'Choose a valid member type.');
  }
  if (memberType === 'Sherubtse College student' && !/^\d{8}\.sherubtse@rub\.edu\.bt$/.test(email)) {
    throw httpError(400, 'Sherubtse students must use an email with 8 digits followed by .sherubtse@rub.edu.bt.');
  }
  const mailConfig = passwordResetMailConfig();
  const role = memberType === 'Sherubtse College student' ? 'student' : 'supporter';
  const passwordHash = await bcrypt.hash(password, 12);
  const interest = clean(req.body.interest, 140);
  const ssuCollaboration = req.body.ssuInterest === 'yes';
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query(
      `INSERT INTO users (name, email, password_hash, role, member_type, email_verified)
       VALUES ($1, $2, $3, $4, $5, FALSE)
       RETURNING id, name, email, role, member_type AS "memberType", phone, bio, skills`,
      [name, email, passwordHash, role, memberType]
    );
    const initialInterest = role === 'student' && interest !== 'Not applying for a volunteer role yet'
      ? interest
      : (role === 'student' && ssuCollaboration ? 'Social Service Unit coordination interest' : '');
    if (initialInterest) {
      await client.query(
        `INSERT INTO volunteer_applications (user_id, interest, availability, ssu_collaboration)
         VALUES ($1, $2, 'To be confirmed', $3)`,
        [result.rows[0].id, initialInterest, ssuCollaboration]
      );
    }
    await sendVerification(client, result.rows[0], mailConfig);
    await client.query('COMMIT');
    return res.status(201).json({ message: `We sent a verification link to ${email}. Open it within 24 hours to activate your account.` });
  } catch (error) {
    await client.query('ROLLBACK');
    if (error.code === '23505') throw httpError(409, 'An account with this email already exists.');
    throw error;
  } finally {
    client.release();
  }
}));

async function sendVerification(client, account, { mailer, from, baseUrl }) {
  const token = crypto.randomBytes(32).toString('hex');
  const hash = crypto.createHash('sha256').update(token).digest('hex');
  const link = new URL('/join.html', baseUrl);
  link.searchParams.set('token', token);
  // Keep earlier links valid if delivery of a replacement fails.
  await client.query('DELETE FROM email_verification_tokens WHERE expires_at < NOW()');
  await client.query(`INSERT INTO email_verification_tokens (token_hash, user_id, expires_at)
    VALUES ($1, $2, NOW() + INTERVAL '24 hours')`, [hash, account.id]);
  try {
    await mailer.sendMail({
      from, to: account.email, subject: 'Welcome to Zhenphen - verify your email',
      attachments: [{
        filename: 'zhenphen-logo.png',
        path: path.join(__dirname, '../public/assets/Zhenphen Association logo.png'),
        cid: 'zhenphen-logo',
        contentType: 'image/png',
        contentDisposition: 'inline'
      }],
      text: `Hello ${account.name},\n\nWelcome to the community! Verify your email within 24 hours:\n${link}\n\nIf you did not create an account, ignore this message.`,
      html: `<div style="background:#f1f5ef;padding:32px;font-family:Arial,sans-serif;color:#193d33"><div style="max-width:480px;margin:auto;background:#fffefa;padding:36px;border-radius:20px"><img src="cid:zhenphen-logo" alt="Zhenphen Association" width="120" style="display:block;width:120px;max-width:100%;height:auto;margin:0 0 24px"><p style="letter-spacing:3px;font-size:12px">ZHENPHEN &middot; COMMUNITY FIRST</p><h1>A little kindness.<br>A new beginning.</h1><p>Hello ${escapeHtml(account.name)},</p><p>Welcome to the community. Confirm your email to activate your account and take your first step with us.</p><p style="margin:32px 0"><a href="${escapeHtml(link.toString())}" style="background:#193d33;color:white;padding:16px 24px;border-radius:10px;text-decoration:none;display:inline-block">Verify my email</a></p><p>This link expires in 24 hours and works once.</p><p style="font-size:12px;color:#68756c">If the button does not work, copy this link into your browser:<br>${escapeHtml(link.toString())}</p><p style="font-size:12px;color:#68756c">If you did not create this account, you can ignore this email.</p></div></div>`
    });
  } catch (error) {
    await client.query('DELETE FROM email_verification_tokens WHERE token_hash = $1', [hash]);
    console.error('Verification email delivery failed:', error.code || 'SMTP_ERROR');
    throw httpError(503, 'We could not send the verification email. Please try again shortly.');
  }
}

router.post('/auth/verification/resend', passwordResetLimiter, asyncRoute(async (req, res) => {
  const email = clean(req.body.email, 255).toLowerCase();
  if (!validateEmail(email)) throw httpError(400, 'Enter a valid email address.');
  const config = passwordResetMailConfig();
  const result = await pool.query('SELECT id, name, email FROM users WHERE email = $1 AND email_verified = FALSE', [email]);
  if (result.rows[0]) await sendVerification(pool, result.rows[0], config);
  res.status(202).json({ message: 'If this account needs verification, a new link has been sent. Check your inbox and spam folder.' });
}));

router.post('/auth/verification/confirm', passwordResetLimiter, asyncRoute(async (req, res) => {
  const token = typeof req.body.token === 'string' ? req.body.token : '';
  if (!/^[a-f0-9]{64}$/.test(token)) throw httpError(400, 'This verification link is invalid. Request a new email.');
  const hash = crypto.createHash('sha256').update(token).digest('hex');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const account = await client.query(`SELECT u.id FROM users u
      JOIN email_verification_tokens t ON t.user_id = u.id
      WHERE t.token_hash = $1 AND t.expires_at > NOW() AND u.email_verified = FALSE
      FOR UPDATE OF u`, [hash]);
    if (!account.rowCount) throw httpError(400, 'This verification link has expired or was already used. Request a new email.');
    await client.query('UPDATE users SET email_verified = TRUE, updated_at = NOW() WHERE id = $1', [account.rows[0].id]);
    await client.query('DELETE FROM email_verification_tokens WHERE user_id = $1', [account.rows[0].id]);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
  res.json({ message: 'Your email is verified. You can now sign in and join the community.' });
}));

router.post('/auth/login', loginLimiter, asyncRoute(async (req, res) => {
  const email = clean(req.body.email, 255).toLowerCase();
  const password = typeof req.body.password === 'string' ? req.body.password : '';
  if (!validateEmail(email) || !password || password.length > 128 || Buffer.byteLength(password, 'utf8') > 72) {
    throw httpError(400, 'Enter a valid email and password.');
  }
  const result = await pool.query(
    `SELECT id, name, email, role, member_type AS "memberType", phone, bio, skills, password_hash, email_verified
     FROM users WHERE email = $1`,
    [email]
  );
  const account = result.rows[0];
  if (!account || !(await bcrypt.compare(password, account.password_hash))) {
    throw httpError(401, 'Email or password is incorrect.');
  }
  if (!account.email_verified) throw httpError(403, 'Verify your email before signing in. Visit the sign-up page to resend your verification email.');
  await establishSession(req, account);
  res.json({ user: publicUser(account) });
}));

router.post('/auth/password-reset/request', passwordResetLimiter, asyncRoute(async (req, res) => {
  const email = clean(req.body.email, 255).toLowerCase();
  if (!validateEmail(email)) throw httpError(400, 'Enter a valid email address.');
  const { mailer, from, baseUrl } = passwordResetMailConfig();
  const result = await pool.query('SELECT id, name, email FROM users WHERE email = $1', [email]);
  const account = result.rows[0];
  if (!account) return res.status(202).json({ message: passwordResetAccepted });

  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const resetUrl = new URL('/forgot-password.html', `${baseUrl}/`);
  resetUrl.searchParams.set('token', token);
  await pool.query('DELETE FROM password_reset_tokens WHERE expires_at < NOW()');
  await pool.query(
    `INSERT INTO password_reset_tokens (token_hash, user_id, expires_at)
     VALUES ($1, $2, NOW() + INTERVAL '30 minutes')`,
    [tokenHash, account.id]
  );

  try {
    const link = resetUrl.toString();
    await mailer.sendMail({
      from,
      to: account.email,
      subject: 'Reset your Zhenphen password',
      text: `Hello ${account.name},\n\nUse this one-time link within 30 minutes to reset your password:\n${link}\n\nIf you did not request a password reset, you can ignore this email.`,
      html: `<p>Hello ${escapeHtml(account.name)},</p><p>Use this one-time link within 30 minutes to reset your Zhenphen password:</p><p><a href="${escapeHtml(link)}">Reset my password</a></p><p>If you did not request a password reset, you can ignore this email.</p>`
    });
  } catch (error) {
    await pool.query('DELETE FROM password_reset_tokens WHERE token_hash = $1', [tokenHash]);
    console.error('Password reset email delivery failed:', error.code || 'SMTP_ERROR');
    throw httpError(503, 'The reset email could not be sent. Check the email service configuration and try again.');
  }
  res.status(202).json({ message: passwordResetAccepted });
}));

router.post('/auth/password-reset/confirm', passwordResetLimiter, asyncRoute(async (req, res) => {
  const token = typeof req.body.token === 'string' ? req.body.token : '';
  const password = typeof req.body.password === 'string' ? req.body.password : '';
  if (!/^[a-f0-9]{64}$/.test(token)) throw httpError(400, 'This password reset link is invalid or has expired. Request a new one.');
  if (password.length < 12 || password.length > 128 || Buffer.byteLength(password, 'utf8') > 72) {
    throw httpError(400, 'Choose a password with 12-128 characters (at most 72 UTF-8 bytes).');
  }
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const passwordHash = await bcrypt.hash(password, 12);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query(
      `SELECT u.id AS user_id FROM users u JOIN password_reset_tokens t ON t.user_id = u.id
       WHERE t.token_hash = $1 AND t.expires_at > NOW()
       FOR UPDATE OF u`,
      [tokenHash]
    );
    if (!result.rowCount) throw httpError(400, 'This password reset link is invalid or has expired. Request a new one.');
    const userId = result.rows[0].user_id;
    const consumed = await client.query('DELETE FROM password_reset_tokens WHERE token_hash = $1 AND expires_at > NOW() RETURNING user_id', [tokenHash]);
    if (!consumed.rowCount) throw httpError(400, 'This password reset link is invalid or has expired. Request a new one.');
    await client.query('UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2', [passwordHash, userId]);
    await client.query('DELETE FROM password_reset_tokens WHERE user_id = $1', [userId]);
    await client.query(`DELETE FROM user_sessions WHERE sess->>'userId' = $1`, [String(userId)]);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
  res.json({ message: 'Your password has been changed. Sign in with your new password.' });
}));

async function establishSession(req, user) {
  await new Promise((resolve, reject) => req.session.regenerate(error => error ? reject(error) : resolve()));
  req.session.userId = String(user.id);
  await new Promise((resolve, reject) => req.session.save(error => error ? reject(error) : resolve()));
}

router.post('/auth/logout', requireAuth, asyncRoute(async (req, res) => {
  await pool.query('DELETE FROM user_presence WHERE session_id = $1', [req.sessionID]);
  await new Promise((resolve, reject) => req.session.destroy(error => error ? reject(error) : resolve()));
  res.clearCookie('zhenphen.sid');
  res.status(204).end();
}));

router.post('/auth/heartbeat', requireAuth, asyncRoute(async (req, res) => {
  await pool.query(
    `INSERT INTO user_presence (session_id, user_id, last_seen) VALUES ($1, $2, NOW())
     ON CONFLICT (session_id) DO UPDATE SET user_id = EXCLUDED.user_id, last_seen = NOW()`,
    [req.sessionID, req.user.id]
  );
  res.status(204).end();
}));

router.get('/profile', requireAuth, asyncRoute(async (req, res) => {
  const profile = await pool.query(
    `SELECT id, name, email, role, member_type AS "memberType", phone, bio, skills,
            avatar_mime AS "avatarMime",
            CASE WHEN avatar_data IS NULL THEN NULL
                 ELSE 'data:' || avatar_mime || ';base64,' || encode(avatar_data, 'base64') END AS avatar
     FROM users WHERE id = $1`,
    [req.user.id]
  );
  res.json({ profile: publicUser(profile.rows[0]), avatar: profile.rows[0].avatar });
}));

router.put('/profile', requireAuth, asyncRoute(async (req, res) => {
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
  const result = await pool.query(
    `UPDATE users SET name = $1, phone = $2, bio = $3, skills = $4,
       avatar_mime = COALESCE($5, avatar_mime),
       avatar_data = COALESCE($6, avatar_data), updated_at = NOW()
     WHERE id = $7
     RETURNING id, name, email, role, member_type AS "memberType", phone, bio, skills`,
    [name, phone, bio, skills, avatarMime, avatarData, req.user.id]
  );
  res.json({ profile: publicUser(result.rows[0]) });
}));

router.post('/volunteer-applications', requireAuth, requireRole('student'), applicationLimiter, asyncRoute(async (req, res) => {
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
}));

router.post('/donations/checkout', (req, res) => {
  res.status(503).json({
    error: 'Online donations are unavailable until BNB merchant payment verification is configured. No payment or donation record was created.'
  });
});

router.get('/site-content', asyncRoute(async (req, res) => {
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
}));

router.get('/member/activity', requireAuth, asyncRoute(async (req, res) => {
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
}));

module.exports = router;
