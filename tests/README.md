# Build-Tech Pro — tests

Everything here runs against the **test** Supabase project (`otwzrmwvvrtjosxgqhkb`), never
production. Two safety walls enforce that:

- `tests/serve.js` serves the app but answers `/config.js` with `config.local.js`, which
  points at the test project. The shipped `config.js` (production) is never served while the
  test server is running, so a browser on `http://127.0.0.1:5173` can only reach the test
  database. Both `smoke.js` and every check refuse to run if the page's config is not the
  test project.
- `tests/lib.js`'s `sql()` helper is hard-wired to the test project ref and uses the
  test-only token in `.env.local`, which cannot see production.

## What's here

| File | What it is |
|---|---|
| `serve.js` | Static server that swaps in `config.local.js`. `node tests/serve.js [port]`. |
| `smoke.js` | Signs in and shows the catalogue. `WHO=OWNER node tests/smoke.js`. |
| `lib.js` | Shared helpers: `sql`, `login`, `go`, `settle`, `lit`. |
| `checks.js` | One browser check per Phase 5 fix and per applied decision (24 of them). `node tests/checks.js [name…]`. |
| `scope_engine.js` / `scope_fixture.js` | The scope reader lifted out of `index.html`, checked against a hand-verified fixture for the Waterfront Market BOQ. `node tests/scope_fixture.js`. |
| `apply_migrations.py` | Applies `migrations/*.sql` to the test project. `python3 tests/apply_migrations.py`. |
| `e2e/` | The end-to-end journey suite (Phase 6), run with the Playwright test runner. |

## Setup

1. `.env.local` in the repo root (gitignored) holds the test-project token and the two
   test logins:
   ```
   SUPABASE_SWEEP_TOKEN=sbp_…            # test project only
   SWEEP_OWNER_EMAIL=sweep-owner@example.com
   SWEEP_OWNER_PASS=…
   SWEEP_FULL_EMAIL=sweep-full@example.com
   SWEEP_FULL_PASS=…
   ```
2. `config.local.js` in the repo root (gitignored) sets `window.BT_CONFIG` to the test
   project's URL and publishable key; `serve.js` refuses to start without it.
3. Install the browser once: `cd tests && node_modules/.bin/playwright install chromium`.
4. Start the server: `node tests/serve.js` (the e2e runner starts it for you if it isn't up).

## Running

```bash
node tests/serve.js &                     # or let the e2e runner do it
node tests/checks.js                       # the 24 per-fix checks
node tests/scope_fixture.js                # the offline scope reader fixture
cd tests/e2e && ../node_modules/.bin/playwright test    # the seven journeys
```

## The seven journeys (`e2e/`)

| Spec | Journey |
|---|---|
| `01-lifecycle` | client → visit → inquiry → quotation (3 lines / 2 sections) → project → milestones → order → stock in/out → invoice → payment, checking the quotation arithmetic, the invoice balance before and after payment, and stock on hand. |
| `02-office-isolation` | a Dubai record and a Bruges record; each shows only in its own office view, both in the company view, each labelled in its own currency; the company view says where new records go. |
| `03-permissions` | only an owner can approve an order (attacked through the page's own client, not just the UI); held stock cannot be issued; owner-only controls are hidden from a full user; and a Bruges user can neither read nor write a Dubai record, while an owner sees both (the office walls of migration 0068). |
| `04-input-abuse` | empty, zero, negative, enormous, non-numeric and awkward text (emoji, Arabic, an apostrophe, a quote) on the new-product and stock forms; each is refused or handled safely, with no NaN and no blank screen. |
| `05-session-refresh` | a hard refresh keeps you signed in; unsaved editing survives a refresh and is offered back; signing out in one tab logs the other out. |
| `06-failure-offline` | a forced server error and an offline network both show a clear error and write nothing silently; the app recovers when back online. |
| `07-charles-path` | the whole reported journey: paste the BOQ → read it → create the draft → check the lines → save → shipping request → order → approve → print, asserting real values at each step. |

### How the isolation guarantee works

- Every record a test writes carries the tag **`ZZTEST`** in a field the app already has
  (a reference, a name, a description). The tag is defined in `e2e/helpers/run.js`.
- Each spec's `afterAll` calls `purge()`, which deletes every tagged row in dependency
  order (payments before invoices, lines before orders, and so on).
- After the whole suite, `e2e/global-teardown.js` runs `scan()` — a function that looks in
  **every text column of every base table** for anything still tagged `ZZTEST`. If it finds
  any, or cannot clean them, the run **fails loudly** with the list of `table.column=count`.
  The scan helper is created and dropped in the same breath, so it leaves no trace of its own.

This is why the tests can run against a real database and still promise that nothing is left
behind. Counters that only move forward — quotation and invoice numbers — are the one thing a
delete cannot undo, which is the single strongest reason these tests never run against
production. See `docs/CLEANLINESS-REPORT.md`.
