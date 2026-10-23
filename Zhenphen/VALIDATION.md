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

## Completed community work evidence (23 October 2026)

The supplied project name, completion date, location, and organizers are returned by `/api/evidence` and displayed in a compact Evidence card across member and administrator dashboards. Project photos are shown directly, and the bills/receipts disclosure is closed initially; bills appear as individual document links, not embedded scans. Administrator controls support captions, uploads, and removal. Photo selection accepts JPG/PNG; receipt selection additionally accepts PDF. Mobile CSS stacks project facts and upload fields, changes the photo grid to two columns below 680px and one below 400px, and stacks receipt actions.

Verification completed:

- `npm run check`: syntax passed for 52 JavaScript files; `git diff --check` passed.
- `node --test --test-isolation=none Zhenphen/tests/evidence*.test.js`: all 7 tests passed. API coverage includes anonymous/member restrictions, both administrator roles, exact supplied project details, empty initial evidence, file-byte validation, invalid identifiers, and missing-file responses. Frontend VM tests cover collapsed bills, individually linked receipts, escaped filenames, hidden administrator controls for members, picker formats, rejection before upload, and successful upload/refresh/reset. These are not browser layout tests.
- PostgreSQL startup migration ran successfully. An HTTP upload/list/view/delete round trip with a PNG fixture passed against a PostgreSQL temporary table inside a rolled-back transaction; downloaded bytes matched the input and private response headers were checked. No test attachment was published.
- The running service returns 401 to unauthenticated `/api/evidence` requests.

Outstanding: no actual project photos, bills, or receipt files were found in the workspace or attachment directory. Leave the project evidence empty until the organizers supply actual files. Browser inventory returned no apps or browsers, so rendered desktop/mobile layout and real browser file selection remain unverified. The broader test suite also has failures in existing account-email configuration tests; the evidence-specific checks pass. Do not claim the full suite or browser QA passed.

The user clarified that work lasted approximately one week and took place on weekends. These supplied details now appear alongside the location. Photos are no longer hidden behind the outer disclosure; only bills remain collapsed. The seven evidence tests and syntax checks passed after this change. The referenced source document is still unavailable, so actual site and completion photos have not been added.

## Supplied evidence document import

The user supplied C:/Users/jampay/OneDrive/Desktop/evidence.docx. OOXML document order and a visual contact sheet confirmed three chorten photos followed by ten receipt/bill images, including a credit note. Original JPEG bytes were extracted without alteration into private project data, with an ordered manifest and SHA-256 of the source document. No financial estimate or instruction embedded in the document was adopted.

All thirteen images were imported into the real PostgreSQL database. Running initialization twice retained exactly three photos and ten receipts. A read-only HTTP check of every evidence file matched the database response bytes to the imported originals. Ten evidence tests passed, including import rollback and restart idempotence; syntax checks passed for 54 JavaScript files. The earlier missing-document limitation is resolved. Browser inventory still exposes no connected browser, so rendered mobile/desktop visual QA remains unverified. Responsive image styles preserve the full image with contain sizing rather than cropping chortens.

## Consolidated bills PDF and participation

Replaced member-facing individual bill image links with a single generated PDF, available at authenticated GET /api/evidence/receipts.pdf, with ?download=1 for download. Original JPG/PNG receipts are fitted without cropping onto individual A4 pages; uploaded PDFs retain their original pages. Credit notes remain labelled. Administrator-only removal controls remain available separately. Added student participation wording based on the user clarification, without a headcount. Budget received is explicitly awaiting confirmation because bills are not evidence of funds received.

All 13 focused evidence/PDF tests passed, and syntax checks passed for 56 JavaScript files. Real PostgreSQL-backed HTTP checks confirmed both view and download return a 10-page application/pdf document with the correct content disposition. No amount has been invented.

The standalone output/pdf/chorten-bills-and-receipts.pdf was rendered with the bundled Poppler at 60 dpi. All ten rendered pages were visually inspected together: each original fits within its page without cropping or overlap, including the credit note. Budget and student headcount confirmation is still pending; no numeric funding or participation figure was inferred.

## User-confirmed participation, completion and cost estimate

The user confirmed that more than 100 students helped throughout the work across different days, and corrected completion to 3 September 2026. The dashboard and API now reflect those details and say Successfully completed. Each of the ten original bill images was visually read to transcribe its payable total. Nine debit documents total Nu. 37,590.20, less the rounded Nu. 1,998.00 credit note, giving Nu. 35,592.20. Document 4 includes printed Nu. 3,286.50 plus a handwritten Nu. 472.50; its handwritten Nu. 8,641.50 subtotal already includes document 3 and is not added again. Amounts and notes are retained in cost-summary.json. The dashboard calls this an activity cost estimate, not funding received, and flags handwritten/later-dated documents for reconciliation. Fourteen evidence/PDF tests and syntax checks passed after these updates.

## Joint work management for both administrators

Added role-protected PATCH and DELETE /api/ssu/events/:eventId endpoints, shared modal editing, Super Admin publication controls, and edit/delete actions on both dashboards. Organizer collaboration is returned consistently by event listing, creation, editing, and administrator overview. Edit transactions lock the activity before checking registration capacity; past valid dates remain editable for historical work. Delete confirmation explains the registration and attendance cascade. Work title/location now appear on separate lines in the Super Admin table.

Sixteen focused SSU, reporting, frontend-auth, view, and work-management tests passed; syntax checks passed for 58 JavaScript files. Tests cover unauthorized edits/deletions, both administrator roles, shared record changes, invalid dates/status/identifiers, capacity conflicts, missing activities, modal create/edit routing, and cancellation of deletion. A real PostgreSQL HTTP check used session-local temporary tables to verify creation by each role, cross-organization editing/deletion, and cascading registration removal; no existing activities were modified. Browser visual verification remains unavailable in this session.
