# Zhenphen Association

Express/PostgreSQL community platform. The existing page layouts, styles, and association logo are preserved. Backend-connected means the implementation exists; it does not mean the deployed database or email delivery has been verified.

## Feature status

| Feature | Current implementation |
| --- | --- |
| Signup, verification, resend, login/logout | PostgreSQL accounts, bcrypt hashes, HTTP-only server sessions, SMTP verification links. New accounts must verify before login. Existing accounts predating verification retain access. |
| Password recovery | SMTP link valid for 30 minutes, hashed tokens, single-use reset, all account sessions revoked after reset. |
| Profile and photo | Authenticated database updates; email and role cannot be changed through profile updates. PNG/JPEG/WebP header checks, maximum 1 MB. |
| Student applications | Authenticated student submissions and own activity history are stored. Administrative reporting includes counts. No application review/status assignment or placement workflow is implemented. |
| SSU events | Database event publishing, public upcoming opportunities, student registrations, capacity checks, open/closed status, work status, attendance, and browser-generated attendance CSV. |
| Super Admin | Account roles, homepage content, counts, and private contact feedback. SSU administrators cannot use these endpoints. Both administrator roles can manage SSU events through the backend. |
| Contact | Public consent-based submission stored in PostgreSQL; Super Admin can read it. This does not send contact emails or provide a staff reply workflow. |
| Online donations | Disabled with HTTP 503. No payment or donation record is created. Member donation history is empty. |
| Financial transparency | Sample totals, charts, ledger entries, and CSV. No verified financial ledger, receipts, reconciliation, or live payment integration. |
| Clothing/ration requests | Unavailable previews; submission buttons disabled, no staff request or collection workflow. Ration distribution tables are fictional browser-only samples. |
| Organization information | Contact arrangements, service eligibility, partnership authorization, privacy/retention rules, and image rights need organizational review. |

## Repository layout and local setup

The repository root contains forwarding npm commands and the canonical `render.yaml`. The Express application, dependency lockfile, schema, tests, public assets, and environment example are in `Zhenphen/`. The nested `Zhenphen/render.yaml` is an equivalent compatibility copy; use the root Blueprint for new deployments. Scaffold files such as `models/User.js`, `middleware/auth.js`, and `config/index.js` are not the active database/authentication implementation.

1. Install Node.js 20+ (Render is pinned to Node 22) and PostgreSQL.
2. From the repository root, run `npm --prefix Zhenphen ci`.
3. Copy `Zhenphen/.env.example` to `Zhenphen/.env`. Use a dedicated local database and replace placeholders privately. Never put real credentials in documentation, Git, a ZIP, or chat.
4. Set `DATABASE_URL`, a random `SESSION_SECRET` of at least 32 characters, and `APP_BASE_URL`. For local laptop-only use, the URL can be `http://localhost:3000`.
5. Run `npm run dev` or `npm start` from the repository root or app directory. The app loads `.env` from its own directory. Database schema migration runs at startup. The configured port must be free; the app no longer silently switches ports and leaves email links pointing to the wrong server.
6. Configure SMTP before testing signup or recovery. Missing/invalid email configuration produces an error; signup rolls back if sending fails. A successful SMTP call means the mail transport accepted the message, not proof of inbox delivery.

For a phone on the same Wi-Fi, use the laptop's reachable LAN address in both the browser and local `APP_BASE_URL`, including the correct port. `localhost` on a phone refers to the phone. For links that work across networks, deploy to a public HTTPS domain. After changing the base URL, restart/redeploy and request a new email; old emails retain their original address.

## Environment variables

All user-configured names are in `.env.example`; values there are harmless examples.

| Variable | Purpose |
| --- | --- |
| `NODE_ENV` | `development` locally; `production` on Render. |
| `PORT` | Local port, default 3000. Render supplies its service port. |
| `DATABASE_URL` | Required private PostgreSQL connection string. |
| `DATABASE_SSL` | Use `true` for production TLS with certificate verification; local PostgreSQL may use `false`. |
| `PG_POOL_SIZE` | Optional pool size, default 10. |
| `SESSION_SECRET` | Private stable random string, at least 32 characters in production. Rotating it signs users out. |
| `APP_BASE_URL` | Website origin only, without a path/query/credentials. Production requires public HTTPS and rejects localhost/loopback. Set to the actual Render service URL or approved custom domain. |
| `RENDER_EXTERNAL_URL` | Platform-provided fallback only when `APP_BASE_URL` is absent. Not a secret and not needed locally. Explicit incorrect `APP_BASE_URL` is rejected, not silently overridden. |
| `EMAIL_SMTP_HOST`, `EMAIL_SMTP_PORT` | SMTP endpoint and port, normally 587 or 465. |
| `EMAIL_SMTP_SECURE` | `true` for implicit TLS; port 465 also selects implicit TLS. Port 587 normally uses STARTTLS. |
| `EMAIL_SMTP_USER`, `EMAIL_SMTP_PASSWORD` | Private provider-authorized SMTP credentials. Gmail may require a provider-issued app password. |
| `EMAIL_FROM` | Plain sender mailbox authorized by the SMTP provider. Display name is Zhenphen. The recipient is the signup/recovery address, not this sender. |
| `SITE_ADMIN_EMAIL`, `SITE_ADMIN_PASSWORD`, `SITE_ADMIN_NAME` | Optional initial Super Admin provisioning. Name has a default. Email/password must be supplied together. |
| `SSU_ADMIN_EMAIL`, `SSU_ADMIN_PASSWORD`, `SSU_ADMIN_NAME` | Optional initial SSU administrator provisioning. Use a different mailbox from Super Admin. |
| `NODE_VERSION` | Render build setting pinned to 22 in the Blueprint. |

Administrator provisioning is create-only. Restarting does not reset passwords, merge/delete users, or promote an existing mailbox. Once a role already has an administrator, bootstrap leaves it unchanged. Remove bootstrap email/password settings after initial provisioning and manage roles in the Super Admin workspace. New student accounts require exactly eight digits followed by `.sherubtse@rub.edu.bt`. Supporters may use other valid addresses. Passwords require 12-128 characters with at most 72 UTF-8 bytes because bcrypt has a 72-byte input limit.

Verification links last 24 hours. Confirmation invalidates all verification links for that account. Recovery links last 30 minutes; successful reset invalidates all reset links and existing sessions. Failed resend delivery preserves earlier unexpired links. Links use random tokens with only SHA-256 hashes stored. Verification messages embed the existing association logo; Gmail's sender avatar is separately controlled by the provider/account.

## Render Blueprint deployment

1. Create a Blueprint from this repository with Blueprint path **`render.yaml`** at repository root. Both Blueprint copies specify **`rootDir: Zhenphen`**, relative to the repository root. Do not add a second `Zhenphen` prefix to build/start commands.
2. The service runs **`npm ci`** and **`npm start`** inside `Zhenphen/`, with health check `/health`. The Blueprint provisions a Singapore PostgreSQL service and web service. Review hosting costs before creating resources.
3. Configure SMTP values and `APP_BASE_URL=https://YOUR-ACTUAL-SERVICE.onrender.com` privately in Render. Use the assigned address, not an assumed service name. Use the approved HTTPS custom domain when available. The database URL is provided by the Blueprint and the session secret is generated. Never deploy the local `.env`.
4. Optionally provide separate initial administrator credentials. Deploy and confirm `/health` reports `database: connected`. Check logs without sharing credentials or tokens.
5. Test signup, inbox delivery, verification on a phone, resend, login, recovery, profile, SSU publishing/registration/capacity/attendance, and role denial using dedicated staging accounts. See `VALIDATION.md`.
6. Configure backups and restore testing, authorized contact channels, privacy/consent/retention, and staff operating procedures before inviting real members. No deployment was performed as part of this audit.

The production base URL cannot be hardcoded here because the deployed service/custom domain has not been supplied. Startup now validates it, and Render's platform URL is a fallback when an explicit value is not set.

## Checks, tests, and release

From either the repository root or app folder:

- `npm run check`: parse all project JavaScript files without starting the app or reading secrets.
- `npm test`: isolated HTTP route tests with fake database/mail dependencies; no `.env`, real database, or real SMTP transport. These are backend behavior tests, not PostgreSQL integration or browser tests.
- `npm run release`: create `dist/zhenphen-release.zip` at repository root, excluding `.env`, hidden private folders, `.git`, `node_modules`, logs, and previous ZIPs. Only `.env.example` is included. Build a fresh archive after each change; do not manually ZIP the workspace.

See `VALIDATION.md` for actual audit results and the remaining manual checks. PostgreSQL migrations, transaction locking under real concurrency, provider email delivery, Render provisioning, and browser/mobile layout still require staging validation.

## Payments and organizational requirements

BNB merchant gateway approval, integration documentation, credentials, signed callback/webhook verification, receipts, and reconciliation are required before enabling real giving. An account number alone is not a gateway. Do not collect bank/card details or claim a donation succeeded. Financial sample data must not be published as verified organizational results.

Confirm image rights before launch. The association logo is preserved. Trashigang Dzong imagery credits Christopher J. Fynn under CC BY-SA 3.0 via Image Credits; the WFP school-meal image is illustrative and is not a Zhenphen activity. Privacy and retention text still requires organizational approval.
