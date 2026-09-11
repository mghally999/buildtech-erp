# Deploying Build-Tech Pro

There is no build step. The site is the files in the repo root (`index.html`, `config.js`,
`sw.js`, `_headers`, `manifest.webmanifest`, the logos, `fonts/`, `icons/`, `vendor/`).
The database is a Supabase project; its changes are the numbered files in `migrations/`.

## Automatically, from GitHub

`.github/workflows/deploy.yml` runs on every push to `main` (and on demand under
Actions, "deploy", "Run workflow"). It applies any migration not yet recorded in the live
project's `applied_migrations`, then publishes the site to the Cloudflare Worker named in
`wrangler.toml`. It does nothing until these are set on the repository:

| Where | Name | Value |
|---|---|---|
| Settings, Secrets and variables, Actions, **Variables** | `DEPLOY_ENABLED` | `yes` |
| Settings, Secrets and variables, Actions, **Secrets** | `SUPABASE_ACCESS_TOKEN` | a Supabase personal access token with write access (Supabase, Account, Access tokens) |
| Secrets | `SUPABASE_PROJECT_REF` | `zlyqecpsgzgbpbikrlro` |
| Secrets | `CLOUDFLARE_API_TOKEN` | a token from the Cloudflare account that owns the Worker, with permission "Workers Scripts: Edit" |
| Secrets | `CLOUDFLARE_ACCOUNT_ID` | that account's id (Cloudflare dashboard, Workers & Pages, right-hand column) |

Take a backup of the live database before the first run (Supabase, Database, Backups).

## By hand

1. Supabase SQL editor: run `migrations/0059_…` to `migrations/0074_…` in order.
2. Cloudflare: publish the site files (or the `buildtech-site-*.zip` built by
   `git archive`, see below) to the Worker.

Either way, after the first sign-in: Settings, "Who can get in": give Chris owner rights
and set each Belgian colleague's office to Bruges. Then Settings, The document: the Dubai
TRN. Authentication settings on Supabase: sign-up off, minimum password length 8.

## Zips

```
git archive --format=zip -o site.zip HEAD _headers config.js index.html sw.js manifest.webmanifest logo.png logo-mark.png fonts icons vendor
```
