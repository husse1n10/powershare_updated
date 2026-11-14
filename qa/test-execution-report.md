# PowerShare QA Test Execution Report

## Registration update — 17 October 2026

Windows / MySQL 8.0.42, using isolated QA databases. Source QA: **172/172** plus all gates. Live suite: **52/52**, including **8/8** registration/assignment tests. Scripted E2E: **20/20**. DB integrity checks: pass with **23/23** required tables before and after the suite. CI frontend build: compiled. Browser registration, immediate login, owner assignment, same-session subscriber update and admin visibility: pass, zero page errors. Arabic pending dashboard: RTL/mobile checked, no horizontal page overflow. Original-schema upgrade applied twice: pass, existing user preserved. Updated draw.io diagrams: decoded and rendered successfully. Backend clean `npm ci` verified after restoring missing optional platform entries for sharp; existing pinned package versions were preserved.

See `REGISTRATION_UPDATE.md` for upgrade steps and the precise scope of this rerun. The following sections preserve the original review as historical evidence.

---

**Checkpoint:** independent QA review, 4 October 2026
**Environment:** Ubuntu 24.04, Node 22.22 / npm 10.9, MySQL 8.0.46 (root/root, database `powershare_ci`, same settings as the CI workflow), Chromium 141 (Playwright).
**Rule applied:** a result is reported as passed only if it was executed in this environment.

## 1. Automated results (final run, fresh database)

| Level | Command | Result |
|---|---|---|
| Architecture gate (PL → BLL → DAL, 62 files incl. middleware, app.js, server.js) | `npm run check` | PASS |
| JavaScript syntax | `npm run check` | PASS |
| Frontend/API route contract | `npm run check:api` | PASS (110 calls / 96 routes) |
| Requirements traceability | `npm run check:requirements` | PASS (51/51) |
| Unit tests (BLL domain rules) | `npm test` | 74/74 |
| Static contract tests (source inspection, no DB) | `npm test` | 95/95 |
| DB smoke test (before live tests) | `npm run test:db` | PASS, 22/22 tables, all integrity checks |
| Scripted E2E workflow (HTTP + MySQL) | `npm run test:e2e:live` | 20/20 |
| Live suite (HTTP + MySQL + Socket.IO + uploads + OCR) | `npm run test:live` | 44/44 |
| DB smoke test (after live tests, validates their data) | `npm run test:db` | PASS |
| Production guards | seed with `NODE_ENV=production`; server with weak/default JWT secrets | both refused |
| Migration 001 on a database built from the original schema | `npm run db:migrate` (twice) | PASS, repairs orphaned debt, idempotent |
| Frontend clean install + production build, `CI=true` | `npm ci && npm run build` | Compiled, 0 warnings |

`npm run qa` total: **169/169**. Live total: **64/64** (E2E 20 + live 44).

**Before/after evidence:** the live suite was run against the pre-fix code (original + DEF-051 only). 15 tests failed and the upload suite crashed on the OCR hang (DEF-067). All pass after the fixes.

## 2. Browser execution (Chromium, backend serving the fresh build with `SERVE_FRONTEND=true`)

| Check | Result |
|---|---|
| Login for Admin, Owner, Collector, Subscriber | 4/4, each lands on its dashboard |
| Socket.IO websocket established after login | 4/4 roles |
| Pages loaded (4 roles, EN and AR) | 72 page loads (36 per language), no route-guard redirects, no failed API calls |
| `dir` attribute | `rtl` on 36/36 Arabic loads, `ltr` on 36/36 English loads |
| Horizontal page overflow at 1366, 820 and 390 px | none (document never wider than viewport; the only off-screen element is the closed mobile sidebar drawer) |
| Arabic labels | 18/36 Arabic loads still show English UI labels → DEF-073 (open) |
| Unread notification badge | shown (owner: 2) |
| Owner billing flow through the UI | save monthly price → Add Reading (stored previous pre-filled) → generate invoice → 201; database amounts verified (2,774,000 LBP incl. carried balance) |
| Console errors | only the Google Fonts stylesheet, blocked by this sandbox's network proxy (environment, not an application defect) |

Screenshots reviewed: Owner Bills desktop/mobile (AR), Plan Pricing (EN), Completed view after generation.

## 3. Pages with untranslated labels in Arabic (DEF-073)

Admin: dashboard fee table, Users, Generators, Reports, Settings, Audit. Shared by all roles: Notifications, Support. Owner: Collector Assignments, Outages, Reports, invoice-label settings.

## 4. Not executed (reported as pending, not passed)

- OCR on real meter photographs (only a synthetic meter image was used: meter number and reading read correctly at 86% confidence, subscriber identified, temporary files deleted).
- Collector and Subscriber flows **through the browser UI** (payment modal, settlement request, invoice print). These flows were executed at API level by the E2E and live suites.
- Stored/reflected XSS testing and deliberate brute-force testing of the login limiter.
- Role-based User Acceptance Testing with real users.
- A run of `.github/workflows/qa.yml` on GitHub itself (its steps were reproduced locally and pass).

## 5. QA decision

No Critical or High defect is open. The automated, live, build and browser gates pass. The project is **ready for demonstration**. It is **not yet ready for final acceptance** until UAT, real-photo OCR testing and DEF-073 are completed.
