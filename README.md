# PowerShare — Generator Management System

For the existing Heroku app and its JawsDB database, see [Deploying PowerShare on Heroku](DEPLOY_HEROKU.md).

PowerShare is a web-based generator management platform designed for private generator operations in Lebanon. It supports four roles: **Administrator, Generator Owner, Collector, and Subscriber**.

## Registration update — 17 October 2026

Subscribers create an account without a provider, installation address or meter number and can log in immediately. They choose a provider and address after signing in. The responsible generator owner or an administrator assigns the meter separately. Owners can access only applications for their own generators. Existing databases require `npm run db:migrate` before starting the updated app. See [REGISTRATION_UPDATE.md](REGISTRATION_UPDATE.md) for the flow, upgrade steps, editable activity diagrams and current test results.

## Architecture

The backend follows the required three-layer architecture:

```text
React Frontend
      |
      v
PL — Presentation Layer
Routes + Controllers
      |
      v
BLL — Business Logic Layer
Services + Domain Rules
      |
      v
DAL — Data Access Layer
Repositories + Database Access
      |
      v
MySQL 8
```

The PL does not access the DAL directly. `npm run check` enforces this dependency rule automatically.

## Main Features

- Secure login, registration, profile and password management
- Role-Based Access Control for Admin, Owner, Collector and Subscriber
- Admin dashboard, users, owners, generators, reports, settings and audit logs
- Generator and main-meter management
- Subscriber, subscription and ampere-plan management
- Monthly pricing and historical exchange-rate preservation
- Meter reading and meter image OCR workflow
- Automatic subscriber identification by meter number
- Consumption calculation and invoice generation
- LBP/USD billing, fixed billing, partial payments and balances
- Collector assignments, collections, ledger and settlements
- Subscriber portal with bills, consumption, payments and outages
- One-time and recurring outages
- Real-time in-app notifications with authenticated Socket.IO delivery, unread badges, and support tickets
- Period reports and analytics with billing status, payment methods, generator/owner performance, collector performance, outstanding accounts, platform fees, support status, printing and CSV export
- Responsive desktop/mobile UI and RTL direction support
- Simulated online-payment flow for QA/demo use

## Quality Assurance

QA is part of the implementation rather than an afterthought.

Run the complete automated QA gate from `backend/`:

```bash
npm run qa
```

It performs:

1. PL/BLL/DAL architecture validation
2. JavaScript syntax validation
3. Frontend/backend API contract validation
4. Requirements Traceability Matrix validation
5. Automated unit/integration tests

The `qa/` directory contains:

- `requirements.json` — requirement IDs mapped to implementation and tests
- `requirements-traceability.md` — readable traceability matrix
- `manual-test-cases.md` — system/UI/UAT test cases
- `test-plan.md` — QA strategy and exit criteria
- `defect-log.md` — defects found and resolutions
- `test-execution-report.md` — current execution status

### Optional live database QA

After MySQL is configured and dependencies are installed:

```bash
npm run test:db
```

This checks required tables and important integrity conditions such as orphan role profiles, bill/payment reconciliation, carry-forward lineage, collector payment/settlement ledger links, invalid financial values, reversed meter readings and duplicate active meter numbers.


## Original QA Checkpoint (independent QA review, 4 October 2026)

Verified by execution against MySQL 8.0 (not only by source inspection):

| Gate | Result |
|---|---|
| `npm run qa` (architecture, syntax, API contract, traceability, unit + contract tests) | 169/169 pass |
| `npm run qa:live` – DB smoke test (before and after live tests) | pass (22/22 tables, extended integrity checks) |
| `npm run qa:live` – live E2E workflow | 20/20 |
| `npm run qa:live` – live HTTP + MySQL + Socket.IO suite (`tests/live`) | 44/44 |
| Browser (Chromium) – 4 roles x EN/AR x desktop/tablet/mobile, 72 page loads | all render; RTL correct 36/36; no page-level horizontal overflow; owner billing flow completed through the UI |
| Fresh frontend `npm ci` + `CI=true npm run build` | compiled, 0 warnings |

**About the test levels.** `tests/unit` are real unit tests of BLL domain rules. `tests/integration` are *static contract* checks: they inspect source text (for example, that a query exists) and run without a database. They are useful as tripwires but cannot prove behavior. `tests/live` drives the real API (HTTP, MySQL, Socket.IO, uploads, OCR) with no mocks. Every High/Critical defect from the review has a live regression test that failed before its fix.

Defects DEF-051 to DEF-075 are recorded in `qa/defect-log.md`: 22 fixed, DEF-063 (password policy) deferred pending a client decision, DEF-073 (untranslated Arabic labels on several pages) and DEF-074 (bidi rendering of amounts) open. Remaining manual work: real meter-photo OCR and role-based UAT. The full review is in `qa/qa-review-report.md`.

## Requirements

- Node.js 18 or newer
- npm
- MySQL 8

## Database Setup

1. Copy `backend/.env.example` to `backend/.env`.
2. Set the database credentials and secure JWT secrets.
3. Run `npm run db:init` from `backend/` to create the PowerShare schema on a new database.
4. **Existing databases** created from an earlier schema: run `npm run db:migrate` once. `db:init` uses `CREATE TABLE IF NOT EXISTS` and never alters existing tables; migration 001 repairs orphaned carried balances and adds the invoice-lineage and meter-reading constraints; migration 002 adds subscriber applications for registration before meter assignment.
5. For a local demonstration or QA database only, run `npm run db:seed:demo`.

The core schema deliberately does **not** create known demo users. `db:seed:demo` refuses to run with `NODE_ENV=production`.

For production, both JWT secrets must be separate strong values of at least 32 characters. The server refuses to start in production when weak/default secrets are used. Refresh tokens are delivered through an HttpOnly cookie rather than browser storage, and password changes invalidate previously issued sessions.

## Backend

```bash
cd backend
npm install
npm run qa
npm start
```

Default development API address:

```text
http://localhost:5000
```

Liveness endpoint:

```text
GET /api/health
```

Database readiness endpoint:

```text
GET /api/ready
```

`/api/ready` returns HTTP 503 when MySQL is unavailable, which is useful for deployment and QA health checks.

## Frontend

Open another terminal:

```bash
cd frontend
npm install
npm start
```

Default React development address:

```text
http://localhost:3000
```

The frontend proxies API requests to `http://localhost:5000` during development.

The frontend is a **Create React App** project (`react-scripts` 5). Use `npm ci` for an exact install. `npm run build` produces `frontend/build/`; with `CI=true` (as on GitHub Actions) lint warnings are treated as errors, and the current source builds with zero warnings.

## Environment Variables

Use `backend/.env.example` as the reference. Important values include:

- `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`
- `JWT_SECRET`, `JWT_REFRESH_SECRET`
- `ACCESS_TOKEN_MINUTES`, `REFRESH_TOKEN_DAYS`
- `FRONTEND_ORIGIN`
- `UPLOAD_DIR` (meter photos; never served publicly)
- `DEFAULT_USD_LBP_RATE`
- `OCR_TIMEOUT_MS` (optional, default 45000). The English OCR model is bundled (`@tesseract.js-data/eng`), so OCR needs no internet access.

## QA Exit Criteria

PowerShare is considered ready for acceptance only when:

- `npm run qa` passes
- No Critical or High defects remain open
- Every proposal requirement is traceable to implementation and test cases
- Live MySQL smoke testing passes
- Manual responsive/UI/security test cases pass
- Role-based UAT is completed for Admin, Owner, Collector and Subscriber


## Live QA environment

```bash
cd backend
npm run db:init
npm run db:seed:demo   # local/QA only
npm run qa
npm run qa:live
```

`qa:live` runs the DB smoke test, the E2E workflow, the live suite (`npm run test:live`) and the DB smoke test again, so the integrity checks also validate the data the live tests created. It requires a running MySQL server with the QA demo seed.

## Optional single-service production deployment

PowerShare can be deployed as one Node service so the React application, REST API and Socket.IO endpoint share the same origin.

```bash
cd frontend
npm install
npm run build

cd ../backend
npm install
# configure .env, including SERVE_FRONTEND=true
npm start
```

When `SERVE_FRONTEND=true`, startup fails if `frontend/build/index.html` is missing. This prevents accidentally deploying an API with a missing or unbuilt user interface. API routes remain under `/api`, while React handles the remaining browser routes.


## Continuous Integration

`.github/workflows/qa.yml` provides a repeatable CI quality gate. It starts MySQL 8, installs exact dependencies with `npm ci`, initializes a clean CI database, verifies that the demo seed and weak JWT secrets are refused in production, loads the QA demo seed, runs `npm run qa` plus `npm run qa:live`, and performs a fresh React production build (`CI=true`) in a separate job.
