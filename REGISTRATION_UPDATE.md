# Account-first registration and meter assignment

Updated requirement: 14 November 2026.

1. Create an account with personal details, optional email, language and a strong password. No generator, installation address or meter is needed at this point.
2. Sign in immediately. The subscriber dashboard offers provider/service-area selection and an installation-address field.
3. Submit the request. The application now shows **Awaiting meter assignment**.
4. The responsible owner or an administrator opens **Subscriber applications**, chooses an eligible plan, supplies a unique subscriber meter and initial reading, and saves.
5. The subscriber refreshes the dashboard to access the assigned subscription. Other owners cannot view or assign this request.

Password requirements apply to all new accounts and password changes: at least eight characters, uppercase/lowercase letters, a number and a symbol, with no spaces. Existing credentials are preserved. Registration does not depend on any provider being available.

## Upgrade an existing installation

Keep the current database and credentials. Install dependencies, run `npm run db:migrate` from backend, build the frontend and restart. Migration 003 adds the unselected stage without deleting existing accounts or assignments. Run migrations again safely if needed. Use **DEPLOY_HEROKU.md** for the existing deployment. Initialization/reset/demo-seeding commands are only for a separate test database.

The source QA, live-MySQL, API, frontend component and Chromium tests were rerun on the patched source. See the separately supplied QA package for exact results, environments, bugs and retests. Those local results do not mean the old deployed build has been updated.

## Diagrams

The Registration draw.io file now describes account creation before provider choice. Provider selection after login is documented in `qa/client-requirements-update.md`. Meter Assignment remains a separate staff workflow. Original Azure Sprints 1–5 and their diagrams were not changed.

## Historical verification for the earlier registration flow

The following earlier results describe the prior provider-at-registration design and are retained as history only.

### Verified on 17 October 2026

- Source QA: 172/172 tests; architecture, syntax, API contract and requirements checks pass.
- Live HTTP, MySQL and Socket.IO suite: 52/52 tests, including 8 registration/assignment tests.
- Existing scripted E2E workflow: 20/20 checks; database smoke checks pass with 23/23 required tables before and after the live run.
- Real browser flow: register without a meter, immediate login, pending dashboard, owner assignment, subscriber update without logging in again, and administrator visibility. The new pending dashboard also renders in Arabic on mobile with RTL and no horizontal page overflow.
- Production frontend build completes with CI lint checks enabled. Dependency/browser-data deprecation notices were emitted; there were no compilation or lint failures.
- Upgrade from the supplied ZIP's original schema: migrations applied twice and existing user preserved.
- Both updated activity diagrams decoded and rendered with the installed draw.io graph engine.

Tests used a separate local MySQL 8.0.42 database on Windows. Node 24.19.0 was used for targeted/browser checks and the build; npm's source/E2E gate used Node 22.23.2. The broader original QA review remains recorded in `qa/`; its real-photo OCR and UAT follow-ups are unchanged.
