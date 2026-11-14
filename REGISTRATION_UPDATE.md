# Registration and meter assignment update

New subscribers no longer need a meter number to create an account.

1. Enter personal details and credentials, choose the generator/service area, and enter the installation address. Email is optional.
2. Submit registration. The system creates an active account and a pending application together.
3. Log in immediately. The dashboard shows **Awaiting meter assignment**, the selected generator, provider and installation address.
4. The **responsible generator owner or an administrator** opens **Subscriber applications**. Owners see applications for their own generators; administrators see all applications.
5. Select the application, enter a unique meter number, choose an active plan for the requested generator and enter the initial reading.
6. The system links the meter, subscriber profile and subscription, records the assigning user, and notifies the subscriber. The dashboard updates without requiring another login; Refresh status is also available while pending.

Meter assignment is independent of login. It can happen after registration whether or not the subscriber has logged in yet.

## Upgrade an existing installation

Keep your existing database and backend `.env` configuration. From `backend/`, install the dependencies and run:

```text
npm ci
npm run db:migrate
```

Migration `002_subscriber_applications.sql` adds the application table. The migration runner applies all migrations in order; running it again is safe. Do not re-seed an existing working database for this update.

From `frontend/`, run `npm ci` and `npm run build` for a deployed build, then restart the application. The existing development commands also continue to work. On Windows, extract the project to a short path such as `C:\Projects\PowerShare` to avoid Windows dependency path-length limits.

For a new installation, follow the main README's database setup instructions. Owner-created accounts for existing subscribers continue to work.

## Editable activity diagrams

- `docs/activity-diagrams/Registration _ Activity Diagram.drawio`: registration ends with immediate access to the login page.
- `docs/activity-diagrams/Meter Assignment _ Activity Diagram.drawio`: separate assignment by the responsible generator owner or an administrator.
- `docs/activity-diagrams/Login _ Activity Diagram.drawio`: login workflow.

Each file contains editable draw.io shapes and connectors. All decision diamonds contain questions; there are no empty merge diamonds.

## Verified on 17 October 2026

- Source QA: 172/172 tests; architecture, syntax, API contract and requirements checks pass.
- Live HTTP, MySQL and Socket.IO suite: 52/52 tests, including 8 registration/assignment tests.
- Existing scripted E2E workflow: 20/20 checks; database smoke checks pass with 23/23 required tables before and after the live run.
- Real browser flow: register without a meter, immediate login, pending dashboard, owner assignment, subscriber update without logging in again, and administrator visibility. The new pending dashboard also renders in Arabic on mobile with RTL and no horizontal page overflow.
- Production frontend build completes with CI lint checks enabled. Dependency/browser-data deprecation notices were emitted; there were no compilation or lint failures.
- Upgrade from the supplied ZIP's original schema: migrations applied twice and existing user preserved.
- Both updated activity diagrams decoded and rendered with the installed draw.io graph engine.

Tests used a separate local MySQL 8.0.42 database on Windows. Node 24.19.0 was used for targeted/browser checks and the build; npm's source/E2E gate used Node 22.23.2. The broader original QA review remains recorded in `qa/`; its real-photo OCR and UAT follow-ups are unchanged.
