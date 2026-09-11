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

## The invoice reader

Money out has "Read an invoice": a PDF, a photo, or a screenshot dropped on the form or
pasted with Ctrl+V fills the cost in, for a person to check before Add cost. The reading is
done by the Supabase Edge Function in `supabase/functions/read-invoice`, which calls Claude
(`claude-opus-5`) and only answers a signed-in user.

It needs one secret on the Supabase project, `ANTHROPIC_API_KEY`, from console.anthropic.com.
Set it in Supabase, Edge Functions, Secrets; or put it in `.env.local` and run
`bash tests/deploy_live.sh`, which sets it. Until it is set, the button says the reader is
not switched on yet and nothing else changes. Reading one invoice costs a few US cents.

To deploy the function by hand:

```
SUPABASE_ACCESS_TOKEN=... npx supabase@2 functions deploy read-invoice --project-ref zlyqecpsgzgbpbikrlro --use-api
```

If the site moves to another address, set `ALLOWED_ORIGINS` on the function to the new
address, or the browser will refuse to call it.

## Zips

```
git archive --format=zip -o site.zip HEAD _headers config.js index.html sw.js manifest.webmanifest logo.png logo-mark.png fonts icons vendor
```
