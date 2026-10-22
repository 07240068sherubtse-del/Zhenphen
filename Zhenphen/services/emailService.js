const path = require('path');
const { httpError } = require('../middleware/api');
const nodemailer = require('nodemailer');
const { appBaseUrl } = require('../config/runtime');

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character]);
}


function configure() {
  const { EMAIL_SMTP_HOST, EMAIL_SMTP_PORT, EMAIL_SMTP_USER, EMAIL_SMTP_PASSWORD, EMAIL_FROM } = process.env;
  const port = Number(EMAIL_SMTP_PORT || 587);
  let baseUrl;
  try {
    baseUrl = new URL(appBaseUrl());
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


function createEmailService() {
  return {
    configure,
    async sendVerification(account, code, { mailer, from }) {
    return mailer.sendMail({
      from, to: account.email, subject: 'Your Zhenphen verification code',
      attachments: [{ filename: 'zhenphen-logo.png', path: path.join(__dirname, '../public/assets/Zhenphen Association logo.png'), cid: 'zhenphen-logo', contentType: 'image/png', contentDisposition: 'inline' }],
      text: `Hello ${account.name},\n\nYour Zhenphen verification code is: ${code}\n\nEnter this code on the website to verify your email. It expires in 10 minutes. If you did not create an account, ignore this message.`,
      html: `<div style="background:#f1f5ef;padding:32px;font-family:Arial,sans-serif;color:#193d33"><div style="max-width:480px;margin:auto;background:#fffefa;padding:36px;border-radius:20px"><img src="cid:zhenphen-logo" alt="Zhenphen Association" width="120" style="display:block;height:auto;margin-bottom:24px"><h1>Verify your email</h1><p>Hello ${escapeHtml(account.name)},</p><p>Enter this code on the Zhenphen verification screen:</p><p style="font-size:36px;font-weight:bold;letter-spacing:8px">${code}</p><p>This code expires in 10 minutes and works once. After verification, you will be redirected to login.</p><p>If you did not create an account, ignore this email.</p></div></div>`
    });
    },
    async sendPasswordReset(account, link, { mailer, from }) {
    return mailer.sendMail({
      from,
      to: account.email,
      subject: 'Reset your Zhenphen password',
      text: `Hello ${account.name},\n\nUse this one-time link within 30 minutes to reset your password:\n${link}\n\nIf you did not request a password reset, you can ignore this email.`,
      html: `<p>Hello ${escapeHtml(account.name)},</p><p>Use this one-time link within 30 minutes to reset your Zhenphen password:</p><p><a href="${escapeHtml(link)}">Reset my password</a></p><p>If you did not request a password reset, you can ignore this email.</p>`
    });
    }
  };
}
module.exports = { createEmailService };
