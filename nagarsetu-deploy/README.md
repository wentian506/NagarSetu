# NagarSetu

A bridge between citizens and city services. Civic service desk for Chandigarh, in English, Hindi and Punjabi.
Hackathon prototype. Not an official government service. Not an emergency service.

This folder has everything needed to run and deploy the site. It works in two modes:

| Mode | What you get | Use it for |
|---|---|---|
| **Demo mode** (default) | Everything runs in the browser. Demo accounts. Data resets on reload. | Judges' demo, quick preview, free static hosting |
| **Server mode** | FastAPI backend with a database. Real accounts with hashed passwords, tickets that persist, server-side rules and deadline worker. | A real pilot or a persistent demo |

## Contents

| Path | Purpose |
|---|---|
| `index.html`, `css/`, `js/`, `favicon.svg` | The front end. `js/i18n.js` holds the three languages, `js/chatbot.js` the help assistant |
| `config.js` | Front-end settings: `USE_API`, `API_BASE_URL`, `GOOGLE_MAPS_API_KEY` |
| `backend/app/store.py` | All business rules (sign-in, ticket numbers, assignment, transitions, escalation, audit chain) |
| `backend/app/main.py` | FastAPI routes. It also serves the front end and a generated `/config.js` |
| `backend/tests/` | Unit tests for the rules and HTTP tests for the API |
| `backend/.env.example` | Settings template |
| `Dockerfile`, `docker-compose.yml`, `render.yaml` | Full-stack deployment |
| `Dockerfile.static`, `nginx.conf`, `netlify.toml`, `vercel.json`, `.github/workflows/pages.yml` | Static (demo mode) deployment |

## Quick start (5 steps)

1. **Unzip** the folder and open a terminal inside it.
2. **Try the demo (no install):** run `python3 -m http.server 8080` and open http://localhost:8080. Data resets on reload. Demo accounts only work in this mode, so never show it as the real service.
3. **Run the real engine:** copy `backend/.env.example` to `backend/.env` and set `SECRET_KEY` (a long random text), `ADMIN_PASSWORD` and `STAFF_PASSWORD`. Then run `docker compose up -d --build`.
4. **Open** http://localhost:8000 and check http://localhost:8000/api/health. It should say `"ok": true` and `"audit_chain_ok": true`.
5. **Go public safely:** put HTTPS in front of port 8000 (section 3), back up the data volume, and read section 9 before you change anything.

## 1. Try it locally

**Demo mode** (no install):

    python3 -m http.server 8080
    # open http://localhost:8080

Demo accounts: resident = any name and made-up 10-digit mobile; staff = `san01` `san02` `ele01` `ele02` `rod01` `rod02` with password `staff123`; admin = `admin` / `admin123`.

**Server mode:**

    cd backend
    python3 -m venv .venv && source .venv/bin/activate
    pip install -r requirements.txt
    cp .env.example .env            # then edit it, see "Settings" below
    set -a; source .env; set +a
    uvicorn app.main:app --port 8000
    # open http://localhost:8000

On first start the server creates the admin account and six staff accounts and **prints their passwords once** if you did not set `ADMIN_PASSWORD` and `STAFF_PASSWORD`. Residents create their own account on the sign-in page (mobile number, name, password of 8 or more characters).

Run the tests (from `backend/`):

    python -m unittest discover -s tests -p test_store.py -v    # rules, needs only PyJWT
    pytest tests/test_api.py                   # HTTP layer, needs requirements.txt

## 2. Settings (server mode)

| Variable | Meaning |
|---|---|
| `SECRET_KEY` | Signs login tokens. Set a long random value. If empty, one is generated and stored in the database |
| `ADMIN_PASSWORD`, `STAFF_PASSWORD` | Passwords used when the accounts are first created |
| `GOOGLE_MAPS_API_KEY` | Turns on the live Google map (see section 5) |
| `NOTIFY_WEBHOOK_URL`, `NOTIFY_WEBHOOK_TOKEN` | Where escalation messages are sent (see section 7) |
| `NAGARSETU_DB` | Database file path. Default `data/nagarsetu.db` |
| `CORS_ORIGINS` | Comma-separated front-end addresses, only if the front end is hosted separately from the API |

Staff and admin passwords are changed only at account creation in this version. To reset them, stop the server, delete the user row or the database file, set new variables and restart.

## 3. Deploy: full stack (server mode)

All options run one container. Keep **one instance only**, because the database is SQLite and the deadline worker runs inside the app.

### Docker Compose on any server or VPS

    cp backend/.env.example backend/.env       # edit the values
    docker compose up -d --build

The site is on port 8000 and the database lives in the `nagarsetu-data` volume. Put a reverse proxy in front for HTTPS, for example Caddy with two lines in `Caddyfile`:

    your-domain.example {
        reverse_proxy localhost:8000
    }

Back up the volume regularly. It holds all tickets and accounts.

### Render

1. Push this folder to a GitHub repository.
2. In Render choose New, then Blueprint, and select the repository. `render.yaml` sets up the web service and a 1 GB disk.
3. Fill in `ADMIN_PASSWORD`, `STAFF_PASSWORD` and optionally `GOOGLE_MAPS_API_KEY` when asked. The disk requires a paid instance type, so check Render's current plans.

### Railway, Fly.io or similar

Deploy from the `Dockerfile`, attach a volume at `/data`, set the variables above, and expose port 8000.

## 4. Deploy: static demo mode only (free)

Nothing runs on a server, and data resets on reload. `config.js` keeps `USE_API: false`.

- **Netlify:** drag this folder onto https://app.netlify.com/drop. `netlify.toml` is already set up.
- **Vercel:** run `npx vercel --prod` in this folder. No build command is needed.
- **GitHub Pages:** push to `main`, open Settings, Pages, and set Source to GitHub Actions. `.github/workflows/pages.yml` publishes it.
- **Docker:** `docker build -f Dockerfile.static -t nagarsetu-demo .` then `docker run -p 8080:80 nagarsetu-demo`.

To point a statically hosted front end at a backend hosted elsewhere, set in `config.js`:

    window.NS_CONFIG = { USE_API: true, API_BASE_URL: "https://your-api.example", GOOGLE_MAPS_API_KEY: "" };

and set `CORS_ORIGINS` on the backend to your front-end address.

## 5. Turn on the live Google map

1. In Google Cloud Console create a project and enable **Maps JavaScript API**.
2. Create an API key. Billing must be enabled, and Google's pricing and free allowance can change, so check its current terms.
3. Under Application restrictions choose **Websites** and add your site address, for example `https://your-domain.example/*` (and `http://localhost:8000/*` for testing).
4. Under API restrictions allow only **Maps JavaScript API**.
5. Server mode: set `GOOGLE_MAPS_API_KEY` in the environment. Demo mode: put it in `config.js`.

A browser key is visible to anyone who opens the site, so the website restriction in step 3 is what protects it. Without a key the site uses its built-in map and "Open in Google Maps" links.

## 6. What the server does

- Sign-in with scrypt-hashed passwords and signed tokens that last 12 hours. Login attempts are rate limited.
- Every confirmed ticket gets a number (`ticket001`), appears in the department console and goes to the least busy staff member in the matching team.
- Staff see and change only their own tickets. Only the admin can reassign tickets or change routing and deadlines. Residents see only their own tickets.
- Anyone can track a ticket by number and sees only its status and public notes.
- A background job checks every 30 seconds and escalates late tickets (team reminder at 100% of the deadline, supervisor at 125%, department head at 150%). It never closes or rejects a ticket.
- Every action is written to a hash-chained audit log. `/api/health` reports whether the chain is intact.

## 7. New in this version

- **Languages.** A language box in the header switches the whole site between English, Hindi and Punjabi. The choice is remembered. All text lives in `js/i18n.js` as `[english, hindi, punjabi]` rows, so adding a language or fixing a word means editing one row. The translations are first drafts: have fluent speakers review them before real use. System audit lines stay in English on purpose.
- **Help assistant.** A round button at the bottom-right of every dashboard page opens a small chat. It explains how to apply, track and reopen, how long things take, categories, sign-in, location and language, in the user's language. If the message contains a ticket number (for example `ticket003`) it looks the ticket up. It sends emergencies to 112 and says plainly when it has no reviewed answer. It is a rule-based assistant, not an AI model, and nothing leaves the browser. Edit its answers in `js/chatbot.js`.
- **Citizen reopen.** A resident can reopen their own resolved ticket with "Not fixed? Reopen this ticket". The deadline clock restarts, escalation resets, staff are notified and the audit log records it.
- **Escalations reach real people.** Every escalation and reopen is queued in an outbox. Set `NOTIFY_WEBHOOK_URL` (and optionally `NOTIFY_WEBHOOK_TOKEN`) and the server POSTs JSON `{text, ticket, level}` to it every 30 seconds, with up to 5 retries. Point it at Slack, n8n, Make, or an SMS or WhatsApp gateway you have a contract with. `/api/health` shows `notify_pending`.
- **Public numbers.** `GET /api/analytics` returns totals, overdue, escalated, average resolve hours and the share of tickets closed within deadline. It has no personal data.
- **Audit anchor.** `GET /api/audit/head` returns the latest hash of the audit chain. Publish it somewhere outside the server (a daily post or a public repository commit) so that rewriting history becomes detectable. A hash chain on its own is tamper-evident, not tamper-proof.

## 8. Known limits

- SQLite on one instance. Move to PostgreSQL before a larger pilot.
- Resident sign-in uses mobile number and password, with no SMS or OTP check. Add OTP through a licensed SMS provider.
- Ticket numbers are sequential, so the public tracker shows only status and public notes.
- Photos are optional (up to 3 JPEGs, shrunk on the device) and are stored inside SQLite, which is fine for a pilot; move them to object storage for scale. There is no real integration with the city's complaint systems.
- Escalation messages need a webhook you configure. Without `NOTIFY_WEBHOOK_URL` they only stay in the outbox and audit log.
- The assistant is rule-based and covers a fixed list of topics.
- Hindi and Punjabi are unreviewed drafts. The "What is inside" and "Targets" landing sections are translated, but demo-account hints on the sign-in page are English.
- Landmark coordinates are approximate. The deadlines (24, 48 and 72 hours) and team names are prototype values until the department verifies them.
- Tests: 22 rule tests and 2 API tests pass (`python -m unittest discover -s tests -p "test_*.py"` and `pytest tests/test_api.py`). The browser code was checked with a headless test, not on real phones.

## 9. Updating, backup and rollback

- **Change code safely:** copy the folder first, change one thing, run the tests (section 1), then deploy. Check `/api/health` after every deploy.
- **Update a Docker server:** replace the files, then run `docker compose up -d --build`. The database lives in the `nagarsetu-data` volume and is kept.
- **Update on Render:** push to the GitHub repository. Render rebuilds on its own.
- **Back up:** copy the database file (`/data/nagarsetu.db` in the container) every day to a safe place, and keep at least 7 copies. Test a restore once.
- **Roll back:** keep the previous folder or Git tag. Redeploy it. The database format has only grown by new tables, so older code still opens it.
- **Where to edit what:** deadlines and teams in the admin screen; words and translations in `js/i18n.js`; chatbot answers in `js/chatbot.js`; colours at the top of `css/styles.css`; business rules in `backend/app/store.py`.
- **Secrets:** never commit `backend/.env`. Rotate `SECRET_KEY` (this signs everyone out) and passwords if you think they leaked.

## Honesty statement

NagarSetu is a hackathon proposal and prototype. It does not file real Chandigarh complaints, and it does not claim faster resolution than government portals. Real filing needs an authorised, tested integration.


## AI-assisted staff assignment (Gemini)

New tickets are first routed by the department rules (category to team, least busy staff member). If a Gemini key is set, Gemini then chooses which staff member in that same team should take the ticket, using each person's open and overdue ticket counts, and writes a one-line reason that staff and admins can read. The AI cannot change the category, team, deadline or status, its answer is checked against the real staff list, and if the key is missing or the call fails the rule-based pick simply stays. Admins can always reassign by hand.

- **Server mode (Render, Docker):** set `GEMINI_API_KEY` (and optionally `GEMINI_MODEL`, default `gemini-2.5-flash`) as an environment variable. `/api/health` reports `ai_assign: true` when it is on.
- **Static demo (Netlify):** set `GEMINI_API_KEY` under Site settings > Environment variables. The function `netlify/functions/assign.js` calls Gemini on the server side. Functions deploy with Git-based deploys or the Netlify CLI; a plain drag-and-drop of the folder may not include them, and without them the demo just uses the rule-based pick. Set `aiAssignUrl: ''` in `config.js` to turn the call off.
- **Never** put the key in `config.js`, `index.html` or any file the browser downloads, and never commit it. Check the model name in Google AI Studio, since Google retires models over time.
- Ticket text is sent to Google when the AI is on. Say so in your privacy notice before a real pilot.
