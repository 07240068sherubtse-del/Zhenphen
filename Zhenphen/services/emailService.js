const fs = require('fs');
const path = require('path');
const { httpError } = require('../middleware/api');
const { appBaseUrl } = require('../config/runtime');

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[character]);
}

function configure() {
  const { MAIL_WEB_APP_URL, MAIL_SECRET } = process.env;
  let endpoint;
  let baseUrl;

  try {
    endpoint = new URL(MAIL_WEB_APP_URL);
    baseUrl = new URL(appBaseUrl());
  } catch {
    throw httpError(503, 'Account email service is not configured.');
  }

  if (
    endpoint.protocol !== 'https:' ||
    endpoint.hostname !== 'script.google.com' ||
    !endpoint.pathname.endsWith('/exec') ||
    !MAIL_SECRET ||
    MAIL_SECRET.length < 32 ||
    !['http:', 'https:'].includes(baseUrl.protocol) ||
    (process.env.NODE_ENV === 'production' && baseUrl.protocol !== 'https:') ||
    baseUrl.username ||
    baseUrl.password
  ) {
    throw httpError(503, 'Account email service is not configured.');
  }

  const mailer = {
    async sendMail({ to, subject, text, html, attachments = [] }) {
      const encodedAttachments = attachments.map(item => ({
        filename: item.filename,
        contentType: item.contentType || 'application/octet-stream',
        cid: item.cid || null,
        content: fs.readFileSync(item.path).toString('base64')
      }));

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          secret: MAIL_SECRET,
          to,
          subject,
          body: text || '',
          htmlBody: html || '',
          attachments: encodedAttachments
        })
      });

      const result = await response.json().catch(() => null);

      if (!response.ok || !result || result.ok !== true) {
        throw new Error('Email service could not send the message.');
      }

      return result;
    }
  };

  return {
    mailer,
    from: { name: 'Zhenphen' },
    baseUrl: baseUrl.origin
  };
}

function createEmailService() {
  return {
    configure,

    async sendVerification(account, code, { mailer, from }) {
      return mailer.sendMail({
        from,
        to: account.email,
        subject: 'Your Zhenphen verification code',
        attachments: [{
          filename: 'zhenphen-logo.png',
          path: path.join(__dirname, '../public/assets/Zhenphen Association logo.png'),
          cid: 'zhenphen-logo',
          contentType: 'image/png',
          contentDisposition: 'inline'
        }],
        text: `Hello ${account.name},

Your Zhenphen verification code is: ${code}

Enter this code on the website to verify your email. It expires in 10 minutes. If you did not create an account, ignore this message.`,
        html: `<div style="background:#f1f5ef;padding:32px;font-family:Arial,sans-serif;color:#193d33"><div style="max-width:480px;margin:auto;background:#fffefa;padding:36px;border-radius:20px"><img src="cid:zhenphen-logo" alt="Zhenphen Association" width="120" style="display:block;height:auto;margin-bottom:24px"><h1>Verify your email</h1><p>Hello ${escapeHtml(account.name)},</p><p>Enter this code on the Zhenphen verification screen:</p><p style="font-size:36px;font-weight:bold;letter-spacing:8px">${escapeHtml(code)}</p><p>This code expires in 10 minutes and works once. After verification, you will be redirected to login.</p><p>If you did not create an account, ignore this email.</p></div></div>`
      });
    },

    async sendPasswordReset(account, code, { mailer, from }) {
      return mailer.sendMail({
        from,
        to: account.email,
        subject: 'Reset your Zhenphen password',
        text: `Hello ${account.name},

Enter this 6-digit verification code on the website within 30 minutes to reset your password:
${code}

If you did not request a password reset, you can ignore this email.`,
        html: `<p>Hello ${escapeHtml(account.name)},</p><p>Enter this verification code on the website to reset your Zhenphen password. It expires in 30 minutes and works once.</p><p style="font-size:32px;font-weight:bold;letter-spacing:6px">${escapeHtml(code)}</p><p>If you did not request a password reset, you can ignore this email.</p>`
      });
    }
  };
}

module.exports = { createEmailService };s