const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { load } = require('./helpers.cjs');

function service(sendMail = async () => {}) {
  let options;
  const loaded = load('services/emailService.js', {
    nodemailer: { createTransport: value => { options = value; return { sendMail }; } },
    '../config/runtime': { appBaseUrl: () => 'https://site.example.com' }
  });
  return { mail: loaded.createEmailService(), options: () => options };
}

test('email service configures authenticated TLS SMTP and branded sender without exposing credentials', t => {
  const original = { ...process.env };
  t.after(() => { process.env = original; });
  Object.assign(process.env, {
    NODE_ENV: 'production', EMAIL_SMTP_HOST: 'smtp.example.com', EMAIL_SMTP_PORT: '465',
    EMAIL_SMTP_USER: 'test-only-user', EMAIL_SMTP_PASSWORD: 'test-only-placeholder', EMAIL_FROM: 'sender@example.com'
  });
  const { mail, options } = service();
  const config = mail.configure();
  assert.equal(options().secure, true);
  assert.equal(options().requireTLS, true);
  assert.equal(options().port, 465);
  assert.deepEqual(config.from, { name: 'Zhenphen', address: 'sender@example.com' });
  assert.equal(config.baseUrl, 'https://site.example.com');
  assert.equal(config.password, undefined);
  delete process.env.EMAIL_SMTP_PASSWORD;
  assert.throws(() => mail.configure(), error => error.status === 503 && !error.message.includes('test-only-user'));
});

test('verification mail keeps code, expiry, escaped name and existing inline logo', async () => {
  let message;
  const { mail } = service();
  await mail.sendVerification({ name: '<Test & User>', email: 'recipient@example.com' }, '012345', {
    from: { name: 'Zhenphen', address: 'sender@example.com' }, mailer: { sendMail: async value => { message = value; } }
  });
  assert.equal(message.to, 'recipient@example.com');
  assert.match(message.text, /012345/);
  assert.match(message.text, /10 minutes/);
  assert.match(message.html, /&lt;Test &amp; User&gt;/);
  assert.match(message.html, /cid:zhenphen-logo/);
  assert.ok(fs.existsSync(message.attachments[0].path));
});

test('reset email preserves configured URL and delivery failure reaches controller for cleanup', async () => {
  let message;
  const { mail } = service();
  const account = { name: '<Test>', email: 'recipient@example.com' };
  const config = { from: 'sender@example.com', mailer: { sendMail: async value => { message = value; } } };
  await mail.sendPasswordReset(account, 'https://site.example.com/forgot-password.html?token=test', config);
  assert.equal(message.to, account.email);
  assert.match(message.text, /https:\/\/site.example.com\/forgot-password.html/);
  assert.match(message.text, /30 minutes/);
  assert.match(message.html, /&lt;Test&gt;/);
  config.mailer.sendMail = async () => { throw new Error('Test mail transport failure'); };
  await assert.rejects(mail.sendPasswordReset(account, 'https://site.example.com', config), /transport failure/);
});
