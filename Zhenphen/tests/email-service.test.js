const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { mailEnvironment, emailService, mailFetch, testMailSecret } = require('./email-helpers.cjs');

beforeEach(t => mailEnvironment(t));
const account = { name: '<Test & User>', email: 'recipient@example.com' };

test('Apps Script configuration keeps the branded sender and public origin without exposing secrets', t => {
  mailEnvironment(t, { NODE_ENV: 'production' });
  const mail = emailService(mailFetch());
  const config = mail.configure();
  assert.deepEqual(config.from, { name: 'Zhenphen' });
  assert.equal(config.baseUrl, 'https://site.example.com');
  assert.equal(typeof config.mailer.sendMail, 'function');
  assert.ok(!JSON.stringify(config).includes(testMailSecret));
});

test('Apps Script configuration rejects invalid endpoints, missing or short secrets and unsafe production origins', async t => {
  const cases = [
    { MAIL_WEB_APP_URL: undefined },
    { MAIL_WEB_APP_URL: 'not-a-url' },
    { MAIL_WEB_APP_URL: 'http://script.google.com/macros/s/TEST/exec' },
    { MAIL_WEB_APP_URL: 'https://attacker.example/macros/s/TEST/exec' },
    { MAIL_WEB_APP_URL: 'https://script.google.com.attacker.example/macros/s/TEST/exec' },
    { MAIL_WEB_APP_URL: 'https://script.google.com/macros/s/TEST/dev' },
    { MAIL_SECRET: undefined }, { MAIL_SECRET: '' }, { MAIL_SECRET: 'short' },
    { baseUrl: 'not-a-url' }, { baseUrl: 'ftp://site.example.com' },
    { baseUrl: 'http://site.example.com', NODE_ENV: 'production' },
    { baseUrl: 'https://user:password@site.example.com' }
  ];
  for (const [index, { baseUrl, ...environment }] of cases.entries()) {
    await t.test(`invalid configuration ${index + 1}`, child => {
      mailEnvironment(child, { NODE_ENV: 'production', ...environment });
      const mail = emailService(() => { throw new Error('Configuration checks must not make requests'); }, baseUrl);
      assert.throws(() => mail.configure(), error => error.status === 503 &&
        error.message === 'Account email service is not configured.' && !error.message.includes(testMailSecret));
    });
  }
});

test('verification sends the Apps Script JSON contract with code, escaped HTML and original base64 inline logo', async () => {
  let message;
  const mail = emailService(mailFetch(payload => { message = payload; }));
  const result = await mail.sendVerification(account, '012345', mail.configure());
  assert.deepEqual(result, { ok: true });
  assert.equal(message.secret, testMailSecret);
  assert.equal(message.to, account.email);
  assert.equal(message.subject, 'Your Zhenphen verification code');
  assert.match(message.body, /012345/);
  assert.match(message.body, /10 minutes/);
  assert.match(message.htmlBody, /&lt;Test &amp; User&gt;/);
  assert.match(message.htmlBody, /cid:zhenphen-logo/);
  assert.equal(message.attachments.length, 1);
  assert.deepEqual(message.attachments[0], {
    filename: 'zhenphen-logo.png', contentType: 'image/png', cid: 'zhenphen-logo',
    content: fs.readFileSync(path.resolve(__dirname, '../public/assets/Zhenphen Association logo.png')).toString('base64')
  });
  assert.equal(message.attachments[0].path, undefined);
});

test('password recovery sends its six-digit code and expiry using Apps Script body fields', async () => {
  let message;
  const mail = emailService(mailFetch(payload => { message = payload; }));
  await mail.sendPasswordReset(account, '012345', mail.configure());
  assert.equal(message.to, account.email);
  assert.equal(message.subject, 'Reset your Zhenphen password');
  assert.match(message.body, /012345/);
  assert.match(message.body, /30 minutes/);
  assert.match(message.htmlBody, /&lt;Test &amp; User&gt;/);
  assert.deepEqual(message.attachments, []);
});

test('Apps Script HTTP failures, rejected delivery and unreadable JSON fail without provider details', async t => {
  const responses = [
    { ok: false, json: async () => ({ ok: true, error: 'private-provider-detail' }) },
    { ok: true, json: async () => ({ ok: false, error: 'private-provider-detail' }) },
    { ok: true, json: async () => ({ ok: 'true' }) },
    { ok: true, json: async () => null },
    { ok: true, json: async () => { throw new Error('private-provider-detail'); } }
  ];
  for (const [index, response] of responses.entries()) {
    await t.test(`delivery failure ${index + 1}`, async () => {
      const mail = emailService(async () => response);
      await assert.rejects(mail.sendVerification(account, '012345', mail.configure()), error =>
        error.message === 'Email service could not send the message.');
    });
  }
});

test('transport rejection propagates so controllers can roll back and remove unsent codes', async () => {
  const failure = new Error('mock network unavailable');
  const mail = emailService(async () => { throw failure; });
  await assert.rejects(mail.sendPasswordReset(account, '012345', mail.configure()), error => error === failure);
});
