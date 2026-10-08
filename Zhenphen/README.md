# Zhenphen Association — UI/UX prototype

A complete, connected front-end prototype built with HTML, CSS, and JavaScript. No build step or dependency installation is needed. The original logo is included byte-for-byte unchanged and is never cropped, recolored, filtered, or distorted.

## Open the website

1. Extract this ZIP completely.
2. Open `index.html` in a modern browser for the public design.
3. For reliable demo state across all pages, use a local server. In VS Code, open this folder and use Live Server. Alternatively, run `python -m http.server 8000` in the folder, then open `http://localhost:8000`.

The project also preserves original entry filenames: homepage.html, about.html, donation.html, moneyd.html, clothd.html, rationd.html, volunteer.html, contact.html, login.html, logout.html.

## Demo member login

Email / username: demo@zhenphen.org
Password: Together2026!

These are public prototype credentials, not a secure authentication system. You can also choose Join the Community to create a sample profile using fictional information.

Role previews are also available:

- Student: `student@zhenphen.org` / `StudentPreview2026!`
- Admin: `admin@zhenphen.org` / `AdminPreview2026!`

Admin access and all role checks are demo-only. They do not provide real authentication or authorization.

## Pages

- Home, About, Community, Contact
- Financial and Clothing Donation, Clothing Drive, Ration Support
- Volunteer Registration
- Login, Join the Community, Password Recovery, Logout
- Member Overview, Financial Transparency, Ration Tracking
- My Donations, Volunteer Activity, Profile
- Separate student, supporter, and admin dashboard previews
- Privacy / Preview Terms and Image Credits

## Interactive features

- Sticky navigation that becomes compact on scroll; keyboard-accessible fullscreen mobile menu
- Donation type tabs, preset/custom amounts, review modal, validation, and confirmation
- Clothing and ration registration, volunteer applications, and contact confirmation
- Demo member session and editable profile
- My Donations and Volunteer Activity populated from demo submissions
- Financial trend period selector, transaction filters, sample CSV export
- Searchable/filterable ration register, editable sample distribution status, summary cards, CSV export
- Empty, loading, error, success, and toast states
- Scroll reveals, animated impact figures, hover effects, and reduced-motion support

## Files and editing

`styles.css` contains the shared palette, typography, components, and responsive breakpoints. `css/dashboards.css` holds dashboard-only styles.
`app.js` is a small bootstrap that loads the application files in order. The `js/` folder separates shared utilities (`core.js`), public page templates (`pages/public.js`), member page templates (`pages/member.js`), form and interaction logic (`interactions.js`), and page startup (`site.js`).
`js/dashboards/student.js`, `js/dashboards/supporter.js`, and `js/dashboards/admin.js` hold separate role dashboard views.
Each HTML file declares its page using `data-page`; the bootstrap loads only the matching role dashboard view.
`assets/` contains the supplied logo and photographs, plus one credited illustrative Bhutan photograph.

## Prototype boundaries

No money is charged. No emails are sent. No collection is scheduled. No real accounts or authorization exist. Role-specific pages and the admin preview are only interface demonstrations; the browser can be manipulated and must never be used to protect real data. Forms use session storage only for demo contributions, volunteer interests, profile information, and ration statuses. They do not send records to a server. Passwords are never stored. Remember Me stores only the demo username in local storage. Financial and impact figures are explicitly illustrative.

This is suitable for design review and iteration, not production. A real launch needs Firebase or another backend, actual authentication and permissions, payment services, verified organization details, approved real records, and confirmed photo permissions. Read credits.html for image sources and privacy.html for preview behavior. The WFP image is illustrative and must not be presented as a Zhenphen event.

External Google Fonts are optional; system fallbacks keep the site usable offline.
