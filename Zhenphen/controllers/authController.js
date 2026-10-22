const { clean, publicUser, validateEmail } = require('../utils/account');
const { httpError } = require('../middleware/api');

function createAuthController({ users, emailService, bcrypt = require('bcryptjs'), crypto = require('crypto') }) {
  const passwordResetAccepted = 'If an account exists for that address, password reset instructions will be sent.';
  async function currentUser(userId) {
    const result = await users.findPublicById([userId]);
    return result.rows[0] || null;
  }


  function verificationHash(email, code) {
    if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32) {
      throw httpError(503, 'Account verification requires a configured SESSION_SECRET of at least 32 characters.');
    }
    return crypto.createHmac('sha256', process.env.SESSION_SECRET).update(`${email}:${code}`).digest('hex');
  }


  async function sendVerification(client, account, { mailer, from }) {
    const code = crypto.randomInt(0, 1000000).toString().padStart(6, '0');
    const hash = verificationHash(account.email, code);
    await client.pruneVerification();
    await client.createVerification([hash, account.id]);
    try {
      await emailService.sendVerification(account, code, { mailer, from });
      await client.replaceVerification([account.id, hash]);
      await client.resetVerificationAttempts([account.id]);
    } catch (error) {
      await client.removeVerification([hash]);
      console.error('Verification email delivery failed:', error.code || 'SMTP_ERROR');
      throw httpError(503, 'We could not send the verification code. Please try again shortly.');
    }
  }


  async function establishSession(req, user) {
    await new Promise((resolve, reject) => req.session.regenerate(error => error ? reject(error) : resolve()));
    req.session.userId = String(user.id);
    await new Promise((resolve, reject) => req.session.save(error => error ? reject(error) : resolve()));
  }


  async function session(req, res) {
    if (!req.session.userId) return res.json({ user: null });
    const user = await currentUser(req.session.userId);
    if (!user) {
      req.session.destroy(() => {});
      return res.json({ user: null });
    }
    res.json({ user: publicUser(user) });
  }

  async function register(req, res) {
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
    const mailConfig = emailService.configure();
    const role = memberType === 'Sherubtse College student' ? 'student' : 'supporter';
    const passwordHash = await bcrypt.hash(password, 12);
    const interest = clean(req.body.interest, 140);
    const ssuCollaboration = req.body.ssuInterest === 'yes';
    const client = await users.connect();
    try {
      await client.begin();
      const result = await client.createUnverified([name, email, passwordHash, role, memberType]);
      const initialInterest = role === 'student' && interest !== 'Not applying for a volunteer role yet'
        ? interest
        : (role === 'student' && ssuCollaboration ? 'Social Service Unit coordination interest' : '');
      if (initialInterest) {
        await client.createInitialApplication([result.rows[0].id, initialInterest, ssuCollaboration]);
      }
      await sendVerification(client, result.rows[0], mailConfig);
      await client.commit();
      return res.status(201).json({ message: `We sent a 6-digit verification code to ${email}. Enter it within 10 minutes to activate your account.` });
    } catch (error) {
      await client.rollback();
      if (error.code === '23505') throw httpError(409, 'An account with this email already exists.');
      throw error;
    } finally {
      client.release();
    }
  }

  async function resendVerification(req, res) {
    const email = clean(req.body.email, 255).toLowerCase();
    if (!validateEmail(email)) throw httpError(400, 'Enter a valid email address.');
    const config = emailService.configure();
    const client = await users.connect();
    try {
      await client.begin();
      const result = await client.findUnverifiedForUpdate([email]);
      if (result.rows[0]) await sendVerification(client, result.rows[0], config);
      await client.commit();
    } catch (error) {
      await client.rollback();
      throw error;
    } finally { client.release(); }
    res.status(202).json({ message: 'If this account needs verification, a new code has been sent. Check your inbox and spam folder.' });
  }

  async function verifyEmail(req, res) {
    const email = clean(req.body.email, 255).toLowerCase();
    const code = typeof req.body.code === 'string' ? req.body.code.trim() : '';
    if (!validateEmail(email) || !/^\d{6}$/.test(code)) throw httpError(400, 'Enter your signup email and the 6-digit verification code.');
    const hash = verificationHash(email, code);
    const client = await users.connect();
    let invalid = false;
    try {
      await client.begin();
      const account = await client.lockVerificationAccount([email]);
      const user = account.rows[0];
      if (!user || user.email_verification_attempts >= 5) {
        invalid = true;
      } else {
        const token = await client.findValidVerification([user.id, hash]);
        if (!token.rowCount) {
          await client.incrementVerificationAttempts([user.id]);
          invalid = true;
        } else {
          await client.markVerified([user.id]);
          await client.clearVerification([user.id]);
        }
      }
      await client.commit();
    } catch (error) {
      await client.rollback();
      throw error;
    } finally { client.release(); }
    if (invalid) throw httpError(400, 'This code is incorrect, expired, already used, or has too many attempts. Request a new code if needed.');
    res.json({ message: 'Your email is verified. Redirecting to login.', redirect: 'login.html' });
  }

  async function login(req, res) {
    const email = clean(req.body.email, 255).toLowerCase();
    const password = typeof req.body.password === 'string' ? req.body.password : '';
    if (!validateEmail(email) || !password || password.length > 128 || Buffer.byteLength(password, 'utf8') > 72) {
      throw httpError(400, 'Enter a valid email and password.');
    }
    const result = await users.findForLogin([email]);
    const account = result.rows[0];
    if (!account || !(await bcrypt.compare(password, account.password_hash))) {
      throw httpError(401, 'Email or password is incorrect.');
    }
    if (!account.email_verified) throw httpError(403, 'Verify your email before signing in. Visit the sign-up page to resend your verification email.');
    await establishSession(req, account);
    res.json({ user: publicUser(account) });
  }

  async function requestPasswordReset(req, res) {
    const email = clean(req.body.email, 255).toLowerCase();
    if (!validateEmail(email)) throw httpError(400, 'Enter a valid email address.');
    const { mailer, from, baseUrl } = emailService.configure();
    const result = await users.findForRecovery([email]);
    const account = result.rows[0];
    if (!account) return res.status(202).json({ message: passwordResetAccepted });

    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const resetUrl = new URL('/forgot-password.html', `${baseUrl}/`);
    resetUrl.searchParams.set('token', token);
    await users.pruneResets();
    await users.createReset([tokenHash, account.id]);

    try {
      const link = resetUrl.toString();
      await emailService.sendPasswordReset(account, link, { mailer, from });
    } catch (error) {
      await users.removeReset([tokenHash]);
      console.error('Password reset email delivery failed:', error.code || 'SMTP_ERROR');
      throw httpError(503, 'The reset email could not be sent. Check the email service configuration and try again.');
    }
    res.status(202).json({ message: passwordResetAccepted });
  }

  async function confirmPasswordReset(req, res) {
    const token = typeof req.body.token === 'string' ? req.body.token : '';
    const password = typeof req.body.password === 'string' ? req.body.password : '';
    if (!/^[a-f0-9]{64}$/.test(token)) throw httpError(400, 'This password reset link is invalid or has expired. Request a new one.');
    if (password.length < 12 || password.length > 128 || Buffer.byteLength(password, 'utf8') > 72) {
      throw httpError(400, 'Choose a password with 12-128 characters (at most 72 UTF-8 bytes).');
    }
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const passwordHash = await bcrypt.hash(password, 12);
    const client = await users.connect();
    try {
      await client.begin();
      const result = await client.lockResetAccount([tokenHash]);
      if (!result.rowCount) throw httpError(400, 'This password reset link is invalid or has expired. Request a new one.');
      const userId = result.rows[0].user_id;
      const consumed = await client.consumeReset([tokenHash]);
      if (!consumed.rowCount) throw httpError(400, 'This password reset link is invalid or has expired. Request a new one.');
      await client.updatePasswordHash([passwordHash, userId]);
      await client.clearResets([userId]);
      await client.revokeSessions([String(userId)]);
      await client.commit();
    } catch (error) {
      await client.rollback();
      throw error;
    } finally {
      client.release();
    }
    res.json({ message: 'Your password has been changed. Sign in with your new password.' });
  }

  async function logout(req, res) {
    await users.removePresence([req.sessionID]);
    await new Promise((resolve, reject) => req.session.destroy(error => error ? reject(error) : resolve()));
    res.clearCookie('zhenphen.sid');
    res.status(204).end();
  }

  async function heartbeat(req, res) {
    await users.heartbeat([req.sessionID, req.user.id]);
    res.status(204).end();
  }
  return { session, register, resendVerification, verifyEmail, login, requestPasswordReset, confirmPasswordReset, logout, heartbeat };
}
module.exports = { createAuthController };
