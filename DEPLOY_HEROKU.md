# Deploy the tested QA fixes to the existing PowerShare app

The supplied source includes the account-first registration flow, strong password validation, private upload routing and the reports database pool fix. The live site tested on 14 November 2026 runs the previous build. Existing account passwords are kept. New accounts and password changes use at least eight characters with upper/lowercase letters, a number and a symbol, without spaces.

## Update the code

1. Keep a verified structure-and-data backup of the existing JawsDB schema. Keep credentials and backups outside Git.
2. Use the folder containing the root package.json, backend and frontend as your repository root. Commit the provided source to the branch connected to the existing `powersharelb` Heroku app.
3. In Heroku, confirm `JAWSDB_URL` is still attached, `NODE_ENV=production`, `SERVE_FRONTEND=true`, and `FRONTEND_ORIGIN` is the live HTTPS origin. Keep the existing JWT secrets and administrator account. Set `DB_POOL_SIZE=2` for this single web process. This is a per-process connection budget, so allow for any additional dynos and one-off commands in the hosted account limit.
4. Enable maintenance mode while deploying the branch and applying the schema update. Wait for a successful build/release.

```bash
heroku maintenance:on --app powersharelb
```

Deploy the branch from the Heroku Deploy tab, then run the additive/idempotent migrations:

```bash
heroku run --app powersharelb -- npm --prefix backend run db:migrate
heroku run --app powersharelb -- npm run test:db
heroku restart --app powersharelb
heroku maintenance:off --app powersharelb
```

Run each command separately and check its result. Migration 003 makes the provider/address optional at account creation and adds the `unselected` application status. It preserves existing application rows and meter assignments. Migrations were executed twice successfully in the isolated MySQL QA database.

This update uses migrations. Do not run `db:reset`, `db:init` or `db:seed:demo` on the deployed database. They are initialization/fixture commands for a separate test database. Do not recreate the administrator account or replace current credentials.

## Verify this deployed release

- Open `/api/ready` and confirm readiness, then sign in with the existing administrator.
- Register a fresh QA subscriber without a provider or installation address using a strong password. Sign in and choose a provider/address. Verify staff can assign that subscriber a meter and plan.
- Create a QA generator. Its creation form contains generator details, with meter creation on the dedicated meter screens.
- Open owner/admin reports for a selected month. Check the logs and hosted database quota if `DATABASE_BUSY` persists. The smaller pool passed a restricted-connection MySQL test locally; the exact hosted account quota still needs checking after deployment.
- Check a private `/uploads/meters/...` URL: it must return 404, without a successful React page or private image bytes.
- Check account creation/password changes, support keyboard actions, audit actor names, Arabic navigation and mobile layouts.

The packaged execution evidence distinguishes the old deployed build from the patched local build. Only a deployed retest can close that distinction. Azure work-item import is separate from application deployment.
