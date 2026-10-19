# Zhenphen Association — community platform

Responsive community platform using Express and PostgreSQL for member accounts, profiles, volunteer applications, SSU events, registrations, and attendance. The original logo is included byte-for-byte unchanged and is never cropped, recolored, filtered, or distorted.

## Run locally

1. Install Node.js 20 or newer and PostgreSQL.
2. Create a PostgreSQL database and copy `.env.example` to `.env`.
3. Set `DATABASE_URL` and a unique `SESSION_SECRET` of at least 32 random characters.
4. From the `Zhenphen` folder, run `npm ci` to install the app dependencies. Then run `npm run dev` either from the repository root or from the `Zhenphen` folder, and open `http://localhost:3000`.

The repository-root `package.json` forwards `dev`, `start`, and `check` commands to the Express app in `Zhenphen/`. The root folder does not install the app dependencies; install them from `Zhenphen/`.

The server applies the initial database schema at startup and serves the preserved page filenames from `views/`.

## Accounts and roles

Students must sign up with an email in the format `12345678.sherubtse@rub.edu.bt`, using their own 8-digit student number. Community supporters may register with any valid email address. Both use a password of at least 12 characters and later sign in with that same email. The server enforces the student email format, stores bcrypt password hashes, and uses HTTP-only, server-side PostgreSQL sessions. Accounts cannot choose administrative roles. Provision separate Super Admin and SSU administrator accounts with `SITE_ADMIN_EMAIL` / `SITE_ADMIN_PASSWORD` and `SSU_ADMIN_EMAIL` / `SSU_ADMIN_PASSWORD`; the Super Admin workspace manages account roles and homepage copy, while SSU event operations stay in their separate workspace. Never commit administrator secrets. Once bootstrap accounts exist, remove the bootstrap secrets from the deployment environment.

## Pages

- Home, About, Community, Contact
- Financial and Clothing Donation, Clothing Drive, Ration Support
- Volunteer Registration
- Login, Join the Community, Password Recovery, Logout
- Member Overview, Financial Transparency, Ration Tracking
- My Donations, Volunteer Activity, Profile
- Separate student, supporter, Super Admin, and SSU administrator dashboards
- Privacy / Terms and Image Credits

## Live features

- Account registration, sign-in/out, role authorization, member profiles, and profile photo storage
- Persistent SSU opportunities, student registrations, capacity enforcement, sign-up controls, attendance check-in/out, and volunteer applications
- Server-recorded sign-in heartbeats and SSU reporting across devices, including per-member attended activity counts, per-work check-in totals, attendance CSV exports in both admin dashboards, and a unique-volunteers-served total. Attendance includes members recorded as checked in or checked out; registrations alone are not counted as attendance.
- Public SSU opportunity listings and role-specific dashboards
- SSU-published service activities are presented as joint collaborations with Zhenphen Association
- Homepage volunteer total counts distinct people checked in or checked out of SSU activities; other impact figures remain illustrative

## Files and editing

`public/styles.css` and `public/css/` contain shared and dashboard styles. `public/app.js` loads the feature modules in order. `public/js/live.js` connects the browser UI to the server API. `routes/api.js` implements account, profile, member, and public homepage-content endpoints; `routes/admin.js` serves Super Admin account-role and homepage-content management; `routes/ssu.js` and `controllers/ssuController.js` implement the role-restricted SSU opportunity and attendance workflows. `migrations/001_initial.sql` defines PostgreSQL records. Each HTML page in `views/` declares its route using `data-page`.

## Deploy on Render

1. Push this repository to a private GitHub repository controlled by the organization.
2. In Render, create a Blueprint from that repository and set the repository root to this project folder if prompted. Review the plan and monthly price before confirming. `render.yaml` provisions a Singapore web service and persistent PostgreSQL database.
3. Add unique `SSU_ADMIN_EMAIL` and `SSU_ADMIN_PASSWORD` values and separate `SITE_ADMIN_EMAIL` and `SITE_ADMIN_PASSWORD` values in Render's private environment settings. Use unique passwords of at least 12 characters. Do not put production secrets in Git.
4. Deploy and verify `/health` reports `"database":"connected"`. Sign up with a student account, publish an SSU event, register from a second device/browser, and verify the admin counts and attendance.
5. Configure a custom domain and HTTPS, backups, database retention, administrator access, and approved privacy/consent terms before inviting real members.

## Payment and remaining launch requirements

**Online donations are disabled.** A BNB account number by itself cannot initiate or verify a digital payment. No payment or donation record is created by the site. Enable giving only after BNB provisions an approved merchant gateway and supplies its integration documentation, test environment, merchant identifiers, signature/webhook requirements, and production credentials. Store credentials as private Render environment variables; do not post account or merchant details in this repository or chat.

Password recovery uses one-time links that expire after 30 minutes. Configure `EMAIL_SMTP_HOST`, `EMAIL_SMTP_PORT` (usually `587`), `EMAIL_SMTP_SECURE` (`true` only when using implicit TLS, usually port `465`), `EMAIL_SMTP_USER`, `EMAIL_SMTP_PASSWORD`, `EMAIL_FROM`, and `APP_BASE_URL` (`https://` in production) in the private environment settings before it can send mail. Never commit or share SMTP credentials. Other general-purpose contact, clothing, and ration forms are not connected to administrator workflows and are intentionally not presented as successful submissions. Before public launch, verify email delivery, privacy/consent/retention policies, and any needed review and moderation workflows. Homepage impact figures remain illustrative and must be replaced with authorized real data.

## Images

The About page uses a photograph of Trashigang Dzong in eastern Bhutan by Christopher J. Fynn, licensed under CC BY-SA 3.0; attribution and license links appear on the Image Credits page. The school-meal photograph is credited to the World Food Programme and is illustrative, not a Zhenphen activity. Verify permission for all supplied project images and the original logo before public use.


New registrations require email verification before login. Registration sends a branded, single-use link valid for 24 hours; only the SHA-256 token hash is stored. Configure the same EMAIL_SMTP_* settings, EMAIL_FROM, and APP_BASE_URL described above. If SMTP is unavailable, registration fails without saving the account. Users can request another email at /join.html?resend=1. Existing accounts retain access. The verification column and token table are added automatically at startup by the idempotent schema migration.
