# Deploy PowerShare on Heroku

These steps deploy the React site and Express API together on the existing `powersharelb` app. The JawsDB add-on stays attached. The database reset is a separate command that replaces all tables and views in the selected database with the new PowerShare tables and default settings. Run it only if that database is dedicated to PowerShare.

## 1. Prepare the GitHub branch

1. Extract the ZIP. Use the folder containing `package.json`, `backend/` and `frontend/` as the repository root.
2. Commit the contents to a private GitHub repository or to a replacement branch such as `heroku-update` in your existing repository. The root `package.json` and `package-lock.json` are already included. Keep the `.gitignore` and both subfolders' lockfiles. Keep your `.env` files, passwords, and database backups out of Git.
3. Install the [Heroku CLI](https://devcenter.heroku.com/articles/heroku-cli) and run `heroku login` in the VS Code terminal.

## 2. Take the app offline and make a backup

```bash
heroku maintenance:on --app powersharelb
heroku ps --app powersharelb
heroku ps:scale web=0 --app powersharelb
```

The screenshot shows one web dyno. If your app configuration has changed, record the current dyno counts and pause any other processes or scheduled jobs that write to this database during the reset.

In Heroku, open **Resources → JawsDB MySQL** to see the database connection details. In MySQL Workbench, connect to that server and use **Server → Data Export**. Select the exact JawsDB schema, choose **Dump Structure and Data** and **Export to Self-Contained File**, then start the export. Save the backup and check that the export succeeded.

## 3. Set the Heroku config vars

Click **Open app** on the Heroku dashboard to find the current canonical site URL. Open **Settings → Config Vars** and set these values.

| Key | Value |
|---|---|
| `NODE_ENV` | `production` |
| `SERVE_FRONTEND` | `true` |
| `FRONTEND_ORIGIN` | The live HTTPS origin, with no trailing slash or path |
| `JWT_SECRET` | The first new random secret |
| `JWT_REFRESH_SECRET` | The second new random secret |

Generate two secrets on your computer with this command and use one line per setting. Changing the secrets signs out old sessions and prevents a token issued for an old account ID from authenticating after IDs are reused.

```bash
node -e "const c = require('node:crypto'); console.log(c.randomBytes(32).toString('hex')); console.log(c.randomBytes(32).toString('hex'));"
```

The code uses `JAWSDB_URL` supplied by the add-on, even if old `DB_*` vars are still present. Confirm that `JAWSDB_URL` is present. Heroku supplies `PORT` at runtime.

## 4. Deploy the new branch

In the **Deploy** tab of **powersharelb**, connect your GitHub repository. Under **Manual deploy**, select the branch containing the prepared files and click **Deploy Branch**. If the old branch has automatic deploys enabled, disable them while switching branches so a later push cannot re-deploy the older version.

Wait for the build and release to succeed. If Heroku asks you to set a classic buildpack, choose `heroku/nodejs` under **Settings → Buildpacks**. If a build fails, resolve it before resetting JawsDB.

## 5. Reset the database and create the admin

Run the preview from your local terminal. It lists the database host, name, tables, and views.

```bash
heroku run --app powersharelb -- npm run db:reset
```

Check that the host and database name match the JawsDB dashboard and that the backup covers the objects in the preview. Then replace `YOUR_JAWSDB_DATABASE_NAME` below with the real name. **This permanently deletes the current data from that schema, including users, bills and payments.** You can recover the old data from the backup.

```bash
heroku run --app powersharelb -- npm run db:reset -- --confirm=YOUR_JAWSDB_DATABASE_NAME
heroku run --app powersharelb -- npm run test:db
heroku run --app powersharelb -- npm run db:admin
```

Run one command at a time and check the result before continuing. The smoke test should report **25/25 required tables**. The last command prints the username `admin` and a random password in your attached terminal. Save the password privately. Use the attached `heroku run` command shown above so the password is returned to your terminal.

## 6. Bring the site back online

```bash
heroku ps:scale web=1 --app powersharelb
heroku ps --app powersharelb
heroku maintenance:off --app powersharelb
```

Wait for the web dyno to show **up** before turning maintenance off. Open your app and add `/api/ready` to its URL. It should return `"status":"ready"`. Then open the homepage and log in with the new admin password. Add an owner and an active generator before trying subscriber registration.

If the web dyno crashes, run `heroku logs --tail --app powersharelb`. A Heroku code rollback and a JawsDB restore are separate operations. After a reset, restoring the old release's data requires importing your backup.

## References

- [Heroku Node.js builds](https://devcenter.heroku.com/articles/nodejs-classic-buildpack-builds)
- [Heroku GitHub deploys](https://devcenter.heroku.com/articles/github-integration)
- [Heroku maintenance mode](https://devcenter.heroku.com/articles/maintenance-mode)
- [Heroku one-off dynos](https://devcenter.heroku.com/articles/working-with-one-off-dynos)
- [JawsDB connection and backups](https://devcenter.heroku.com/articles/jawsdb)
- [MySQL Workbench export and import](https://dev.mysql.com/doc/workbench/en/wb-admin-export-import-management.html)
