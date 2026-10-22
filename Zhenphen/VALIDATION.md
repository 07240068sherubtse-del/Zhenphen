# Validation record

Audit date: 21 October 2026. This replaces obsolete prototype validation claims. No claim is made that historical browser checks apply to the current backend.

## Automated checks actually run

- `npm run check`: 48 application, frontend, script, and test JavaScript files parse successfully.
- `npm test`: 38 tests passed, with zero failures. These exercise actual Express routers over isolated local HTTP requests. Database queries and mail delivery use explicit in-memory doubles; password hashing is substituted in most route tests; registration, reset, and credential tests use the real bcrypt library. No test loads `.env`, starts the production server, connects to PostgreSQL, or sends email.
- `npm run release`: generated a release ZIP. Archive integrity and entries checked separately; no `.env`, `.git`, or `node_modules` included, and `.env.example` included.
- Git ignore checks confirm private environment files and installed dependencies remain excluded.

The Windows sandbox initially prevented the Node test runner from spawning (`EPERM`). The tests were rerun with approved execution outside that sandbox. Expected SMTP error messages in negative tests are simulated failures.

## Automated behavior coverage

- Signup recipient routing, server-selected student role, hashed verification token, inline logo, commit, SMTP-failure rollback, eight-digit student address rule, supporter email acceptance.
- Verification malformed/used token rejection, account verification, all account verification tokens removed, transaction rollback, and query expiry/locking conditions.
- Resend generic unknown-account response and preservation of earlier links when delivery fails.
- Login wrong-password/unverified-account denial, successful verified login without a password hash in the response, real bcrypt credential comparison, bcrypt byte-limit validation, and repeated-attempt rate limiting.
- Password recovery unknown-account response, delivery-failure cleanup, earlier-link preservation, password reset validation, single-use token consumption, all reset links/session revocation, and rollback on replay.
- Profile restricted-field handling, invalid avatar rejection, student application submission, and supporter application denial.
- Payments remain unavailable and execute no database writes.
- Anonymous/supporter SSU access denial, student publishing denial, administrator date/capacity validation, registration row lock/capacity/duplicate/closed/past/work-status behavior.
- Attendance invalid state rejection, in-progress requirement, check-in before checkout, and completed-work denial.
- Super Admin restrictions, invalid role rejection, self-demotion prevention, and create-only administrator bootstrap without destructive merges or credential overwrite.
- Production base URL validation and Render platform URL fallback.

Mocks prove route decisions and the SQL issued; they do not prove SQL execution, migration compatibility, database constraint behavior, row-lock concurrency, cookie-store persistence, production bcrypt cost, SMTP inbox receipt, or browser behavior. The project does not yet include a real PostgreSQL integration test harness.

## Changes requiring staging verification

Use a separate staging deployment/database and mailboxes controlled by the team. Never test destructive or concurrent flows against production records.

1. Install with `npm ci` in `Zhenphen/`; configure private staging environment values; start the app and verify `/health`. Restart to verify idempotent migration and that bootstrap leaves existing users/passwords unchanged.
2. Register a student with a real eight-digit college email. Reject seven/nine digits and Gmail under the student option. Register a supporter with a controlled non-college mailbox. Confirm success shows the actual recipient and no login before verification.
3. Read the verification email on a phone and enter its code on the website. Confirm the logo, correct sender, public HTTPS host, single-use code verification, login redirection, expired-code error, and resend behavior. Request two links, verify one, and ensure the other fails. Test SMTP failure in staging and check account rollback/clear error.
4. Request password recovery for known and unknown mailboxes. Check the neutral response, 30-minute expiry, valid reset, all previous links invalidated, and existing sessions rejected after reset. Test failed replacement delivery while an earlier link exists.
5. Update profile text and a valid photo; reject unsupported/oversized photos. Confirm data persists after reload in a separate browser. Confirm client attempts to change email/role through profile do not succeed.
6. Submit a student volunteer application and confirm it appears in own activity and administrator counts. Confirm anonymous/supporter denial. Application placement/review is an organizational/manual process, not an implemented approval workflow.
7. Publish an upcoming SSU event as an administrator. Register a student once; reject duplicate, full, closed, past, in-progress, and completed registrations. Race two students for the final place using separate sessions to validate PostgreSQL locking.
8. Set work In progress; check a registered student in then out; reject checkout before check-in and updates outside In progress. Confirm public/student views do not expose attendee personal data, administrative counts update, and attendance CSV matches the database.
9. Try protected API requests as anonymous, student, supporter, and SSU administrator. Only Super Admin may manage roles/homepage/feedback; both administrator roles may manage SSU events. Verify self-demotion fails and cross-origin mutations fail.
10. Confirm online checkout returns unavailable and creates no payment/donation record. Financial totals/CSV and ration records must remain visibly sample data. Clothing/ration forms must show unavailable and never report a successful request.
11. Check contact submission, consent validation, Super Admin feedback visibility, logout, session expiry, navigation, and responsive layouts at phone and desktop widths. No current browser visual QA was performed by this audit.
12. Confirm Render Blueprint uses repository `render.yaml`, `rootDir: Zhenphen`, build `npm ci`, start `npm start`, private environment values, and an assigned HTTPS `APP_BASE_URL`. Request fresh emails after URL changes.

## Not tested or approved

No migration run or full PostgreSQL-backed account workflow, real SMTP or inbox delivery, public deployment, payment provider, mobile/browser visual pass, restore drill, legal/privacy approval, image-rights approval, or organizational partnership authorization was tested or approved. These remain launch conditions; passing unit/route checks does not establish production readiness.

## Local-server follow-up

Checks were run in the actual `Zhenphen/` app directory using the agent's local PowerShell execution tool, not VS Code's integrated terminal. The existing server on localhost:3000 returned HTTP 200 with `database: connected` from `/health`. Anonymous profile, own activity, Super Admin, and SSU admin API access returned 401. Malformed verification/reset tokens returned 400; disabled checkout returned 503. These checks did not create accounts, send mail, run migrations, or verify that the existing server process had restarted with the latest code. This confirms live local database connectivity only, not full database-backed account workflows.

In VS Code choose Terminal > New Terminal, select the app directory, and run:

```powershell
Set-Location 'C:\Users\jampay\OneDrive\Desktop\Backend\Group_Project\Zhenphen-UIUX\Zhenphen'
npm run check
npm test
```

Expected: `Syntax checks passed for 48 JavaScript files`, then `tests 38`, `pass 38`, `fail 0`. Simulated SMTP failure messages belong to negative tests. If the server is already running, stop that process with Ctrl+C in its terminal before restarting the latest code with `npm start`. Success: `Zhenphen server listening on port 3000`. Keep it running. In a second integrated terminal in the same app folder run `npm run smoke:local`; all actual statuses must match the printed expected statuses, ending with `Local smoke checks passed`.

Complete the browser checklist above using a mailbox you control and a fresh test account. Register at `/join.html`, reject login before verification, read the received six-digit code, enter it on the website, and confirm redirection to login. Request recovery at `/forgot-password.html`, open the email, choose a new password privately, and confirm the old password and prior sessions no longer work. Signed-out protected pages should redirect to login; signed-in member accounts must be denied administrator APIs. Browser-only page shells are not the security boundary: the protected API denial is required.

The names required for local database and SMTP settings were present, but values and credential validity were not printed or verified. If setup fails, edit only local `.env`: `DATABASE_URL`, `SESSION_SECRET`, `APP_BASE_URL`, `EMAIL_SMTP_HOST`, `EMAIL_SMTP_PORT`, `EMAIL_SMTP_SECURE`, `EMAIL_SMTP_USER`, `EMAIL_SMTP_PASSWORD`, and `EMAIL_FROM`, following `.env.example`. For laptop-browser testing use `APP_BASE_URL=http://localhost:3000`; phone testing needs a reachable LAN/public origin. Do not share credentials or token URLs. Actual registration email receipt, valid-link verification/reset, browser protected-page behavior, and VS Code integrated-terminal execution remain user-run checks.

## EJS view conversion

Converted all 27 HTML view files to EJS, replaced the unused home scaffold with an include of the real homepage, removed static exposure of the views directory, and registered known templates as Express render routes. Existing `.html` page URLs remain supported. The added HTTP test rendered every EJS template, checked the homepage, and confirmed direct `.ejs` and unknown template requests return 404. All 38 tests passed; 36 JavaScript files passed syntax checks.

## Numeric verification update

Signup now emails a six-digit code and opens `join.html?verify=1`. Users enter their signup email and code; only successful verification redirects to `login.html?verified=1`. Codes expire after 10 minutes; five failed attempts per account lock verification until resend. Successful resend replaces old codes. A migration adds the persisted failed-attempt counter. Old verification email links no longer activate an account; request a fresh code. Automated coverage includes keyed code storage, leading-zero codes, invalid/expired/reused codes, lockout, and frontend redirects with API doubles. Inbox delivery and full browser testing still require a controlled mailbox. Password reset remains link-based.

## Authentication follow-up

Inspected the existing API, schema, live frontend, interactions, package scripts, environment example, ignore rules, and README. Reused the existing routes and preserved numeric signup verification. No new authentication routes, schema changes, deployment, or design changes were introduced in this follow-up.

Executed in the actual local app folder using the agent's PowerShell execution tool, not VS Code's integrated terminal: `npm ci` (131 packages installed, audit reported zero vulnerabilities), `npm run check`, and `npm test -- --runInBand`. The built-in Node runner supports the requested argument through `scripts/test.js`. Frontend regressions now cover poisoned browser identity, API failure, and malformed success responses. Additional backend tests verify actual bcrypt hashes, identical known/unknown resend/recovery responses, and SMTP error sanitization. Database/mail remain mocked, with no real mail or destructive data cleanup.

VS Code integrated-terminal execution, inbox delivery, actual PostgreSQL transaction/concurrency behavior, and the full browser email/reset flow are not established by these tests. The existing `.env.example` already contains the required harmless settings and was retained. The real `.env` was not edited, printed, or included in packaging.

## Backend structure refactor (22 October 2026)

Extracted the existing authentication handlers into `controllers/authController.js`, the other API callbacks into `controllers/apiController.js`, user/auth persistence into `repositories/userRepository.js`, SMTP/messages into `services/emailService.js`, and shared validation/serialization helpers into `utils/account.js`. The route file now contains wiring and middleware. This refactor did not change the database schema, frontend, response messages, or authentication paths.

Added direct tests for session regeneration/failure, logout and stale sessions; SMTP TLS configuration, sender/recipient, escaped HTML, inline logo, reset URL/expiry, and delivery failure; and transaction connection binding/parameterization. Existing HTTP tests now inject dependencies through the controller/email factories while exercising the actual repository SQL. Tests use safe mocks; no live credentials or SMTP. The local shell executes the tests from `Zhenphen/`; the agent cannot control VS Code's integrated terminal. Live inbox delivery remains unverified.

## SSU reporting exports

Added volunteer totals, member activity, and event totals CSV buttons using the existing authorized overview API. Automated tests cover unique-volunteer counting versus registrations, application totals, attendance metrics, member/event rows, CSV escaping, spreadsheet formula neutralization, and no download on failed API access. `npm run check` passed for 48 JavaScript files and `npm test -- --runInBand` passed all 38 tests in the local app folder. No real member report was downloaded or browser-verified during these tests.
