# Build-Tech Pro — Full Sweep Prompt for Claude Code

Save this file as `SWEEP.md` in the repo root. Run the phases one at a time.
Do **not** paste all of it as one message — Claude Code works far better on one phase per session.

---

# PART A — SETUP BEFORE YOU RUN ANYTHING

Do these five things first. They take twenty minutes and they are the difference
between a useful sweep and a mess.

### 1. Get it into git

```bash
mkdir buildtech-pro && cd buildtech-pro
# copy the contents of the latest zip in here
git init
git add -A
git commit -m "Baseline: deployed build 2026-09-10e"
gh repo create buildtech-pro --private --source=. --push
```

Every change from here is a commit you can revert. Without this you have no undo.

### 2. Create an isolated database

In the Supabase dashboard, create a **branch** of project `zlyqecpsgzgbpbikrlro`
(or a second free project and run the schema into it).

Then make a local config that points at it:

```js
// config.local.js  — never commit this
window.BT_CONFIG = {
  SUPABASE_URL: "https://YOUR-BRANCH-REF.supabase.co",
  SUPABASE_KEY: "sb_publishable_YOUR_BRANCH_KEY"
};
```

Add to `.gitignore`: `config.local.js`

**Nothing in this sweep touches production. That is a hard rule, stated again in the prompt.**

### 3. Serve it locally

```bash
npx serve . -p 5173
```

### 4. Give Claude Code the tools it needs

```bash
claude mcp add supabase --scope project \
  -- npx -y @supabase/mcp-server-supabase@latest \
  --project-ref=YOUR-BRANCH-REF

claude mcp add playwright --scope project \
  -- npx -y @playwright/mcp@latest
```

The Supabase MCP lets it read the real schema and RLS policies instead of guessing.
The Playwright MCP lets it drive the app in a real browser — click, type, submit, read
the screen — which is what "end to end testing" actually means.

### 5. Create `CLAUDE.md` in the repo root

```md
# Build-Tech Pro

A single-file ERP for a UAE protective-coatings importer and applicator.
The entire application is `index.html` — ~13,800 lines, React via `htm` template
literals, no build step, no bundler, no JSX. Vendored libraries in `vendor/`.
Backend is Supabase; all authorisation lives in Postgres RLS, not the frontend.

## Non-negotiable rules
- Never point at the production Supabase project. Only the branch in `config.local.js`.
- No build step. No npm packages in the app. No JSX. Match the existing `htm` style exactly.
- Every record is scoped to an office (Dubai / Belgium). Never bypass office scoping.
- Never leave `console.log`, `debugger`, TODO markers, or commented-out code.
- Never invent a table or column. Verify against the live schema via the Supabase MCP.
- Money: EUR list → supply discount → AED conversion → margin → sell price. Do not alter
  this chain without being asked.
- Match the existing code's voice: plain-English comments explaining *why*, not *what*.
```

---

# PART B — THE PHASE PROMPTS

Run each in a fresh Claude Code session. Start each with `/clear`.

---

## PHASE 0 — Map the territory

```
Read index.html completely. It is ~13,800 lines and it is the entire application —
do not skim it, do not sample it, read all of it.

Then produce docs/MAP.md containing:

1. A numbered inventory of every top-level component: name, line range, what it is for
   in one sentence, and which Supabase tables and views it touches.
2. The complete list of Supabase tables, views and RPC functions referenced anywhere
   in the file, with the components that use each one.
3. The navigation structure: every tab, every sub-view, and how a user reaches it.
4. Any component that is defined but never rendered anywhere — dead code.
5. The office-scoping mechanism: how the office filter is applied on reads and how
   office_id is stamped on writes. List any table read or written WITHOUT office scoping.
6. The permission model: every role, and exactly what each role can and cannot do.
7. The money pipeline: every place a price, cost, margin, VAT or currency conversion
   is calculated, with line numbers.

Write only the map. Change no code in this phase. Where you are unsure, say so
explicitly rather than guessing.
```

---

## PHASE 1 — Verify the schema actually matches the code

```
Using the Supabase MCP against the BRANCH project only, pull the full schema:
every table, column, type, nullability, default, foreign key, index and constraint,
plus every view and RPC.

Compare it against docs/MAP.md and against index.html itself. Produce docs/SCHEMA-AUDIT.md
listing, with line numbers for every finding:

1. Columns the frontend reads or writes that DO NOT EXIST in the database.
2. Columns that exist but are never used anywhere.
3. Type mismatches — a numeric column being sent a string, a date column being sent
   a formatted display string, a boolean being sent 'true' as text.
4. NOT NULL columns with no default that some code path can fail to supply.
5. Foreign keys the frontend can violate.
6. Any table missing an office_id where the code assumes one exists, or the reverse.
7. Numeric columns storing money: check precision. Money must never be a float.
8. Every view the frontend selects from: confirm it exists and returns the columns used.

Rank each finding: BREAKS (users hit this today) / RISK (will break under some input)
/ COSMETIC. Change no code yet.
```

---

## PHASE 2 — Security and RLS

```
This app ships a publishable anon key to the browser. That is correct by design, which
means EVERY authorisation rule must live in Postgres RLS. Any rule enforced only in
JavaScript is not enforced at all — anyone can open the console and bypass it.

Using the Supabase MCP on the branch, list the RLS policies on every table. Then produce
docs/SECURITY-AUDIT.md answering:

1. Which tables have RLS DISABLED. For each, state exactly what an anonymous user with
   the publishable key could read or write.
2. For each table with RLS on: quote the policy and state in plain English who can do what.
3. Find every rule the frontend enforces that the database does not. Specifically check:
   - Can a non-owner role write to `settings` or change pricing dials?
   - Can a Dubai user read or write Belgium records, or the reverse?
   - Can any signed-in user read salaries, partner ledger entries, or bank balances?
   - Can stock marked as Civil-Defence-blocked be issued anyway via a direct API call?
   - Can quotation approval status be changed by someone not allowed to approve?
4. Are there RPC functions running as SECURITY DEFINER that skip RLS?
5. Is any secret, service key, token or password present anywhere in the shipped files?

For each gap, write the exact SQL policy that would close it. Do not apply anything yet.
```

---

## PHASE 3 — Logic and correctness audit

```
Now hunt for actual bugs. Read for correctness, not style. Produce docs/FINDINGS.md
with every issue numbered, given a line number, a severity, a plain description of what
goes wrong for the user, and a proposed fix.

Cover all of the following systematically:

MONEY
- Trace the full price chain: EUR list price → supply discount → AED conversion →
  margin → sell price. Verify it end to end with a worked example and state the result.
- Floating point on money: find every place a price is added, multiplied or compared
  using JS floats. Rounding must be explicit and applied once, at the right moment.
- VAT: applied at the correct rate for the correct office, on the correct base, and
  never applied twice.
- Consumption rates: kg/m² × area → quantity → pack sizes. Check the rounding-up to
  whole pails, and check what happens with zero, negative and non-numeric input.
- Margin calculation: confirm whether it is margin (profit ÷ sell) or markup
  (profit ÷ cost). Getting these confused is a classic and expensive error.
- Purchase orders must be commitments, not expenses. Verify they cannot leak into
  expense totals before a supplier invoice exists.
- Currency: confirm no place mixes EUR and AED in the same sum.

STATE AND DATA
- Every async call: what happens on failure? Find every unhandled promise, every
  empty catch block, every place an error is swallowed silently.
- Race conditions: two saves in flight, a stale read overwriting a newer write.
- Every `.filter()`, `.map()`, `.reduce()` on data that could be null or undefined.
- Every date: check timezone handling. This app runs in Dubai (UTC+4) and Belgium
  (UTC+1/+2). A date stored as UTC and displayed locally will show the wrong day.
- Optimistic UI updates that are not rolled back when the write fails.

OFFICE SCOPING
- Every read that should be office-filtered but is not.
- Every write that should stamp office_id but does not.
- What the "BOTH" mode does to writes — a record created in BOTH mode must not end up
  with a null or wrong office.

FORMS AND VALIDATION
- Every input field in the application. For each: is it validated? What happens on
  empty, on zero, on negative, on a very large number, on text in a number field,
  on 5000 characters in a short text field, on emoji, on Arabic text, on a leading
  apostrophe, on a date in 1900 or 2200?
- Required fields that are not actually enforced.
- Numeric fields that accept text and then produce NaN downstream.

DEAD AND DUPLICATE
- The unused Dashboard component that Operations replaced — confirm it is unreferenced.
- The two overlapping sales funnels (Visits and Pipeline) — document the overlap and
  what data can become inconsistent between them.
- Any other unreachable code, unused state, unused imports, duplicated logic.

Rank everything: CRITICAL (data loss, money wrong, security) / HIGH (feature broken)
/ MEDIUM (broken under some input) / LOW (cosmetic).
Change no code in this phase. The list is the deliverable.
```

---

## PHASE 4 — The refresh problem

```
The reported symptom: refreshing the page appears to sign the user out.

Investigate properly before changing anything. The login gate at the bottom of the App
component already distinguishes `session === undefined` (still checking) from
`session === null` (signed out), so the obvious cause is already handled. Look further:

1. The Supabase client is created with no options — confirm what persistSession,
   autoRefreshToken, storage and storageKey default to, and whether that default
   survives a hard refresh on this origin.
2. Where exactly is the session token stored, under what key? Read it in the browser
   and confirm it is present after a refresh.
3. sw.js: does the service worker ever serve a cached index.html or config.js in a way
   that produces a client with a different storage key or a different Supabase URL?
   Note that the SW pre-caches index.html and config.js.
4. Is the token expiring and failing to refresh? Check the token lifetime and whether
   autoRefreshToken is firing.
5. Does it happen on all browsers or only Safari/iOS? Safari's storage policies can
   evict localStorage. If so, the fix is different.
6. The onAuthStateChange handler deliberately ignores events where the user id is
   unchanged. Confirm this does not swallow a TOKEN_REFRESHED event that needs handling.

Use the Playwright MCP: sign in, hard refresh, soft refresh, refresh after 10 minutes,
open in a second tab, close and reopen the tab, go offline and back online. Report what
actually happens in each case with evidence.

Then fix the real cause. State the root cause explicitly before you write the fix.
```

---

## PHASE 5 — Apply the fixes

```
Work through docs/FINDINGS.md in severity order: all CRITICAL, then all HIGH, then
MEDIUM, then LOW.

For each fix:
1. State the finding number and the root cause in one sentence.
2. Make the minimal change that fixes it. No refactoring, no rewrites, no
   "while I was in here" improvements.
3. Match the surrounding code style exactly — same htm template literal style, same
   naming, same comment voice (plain English, explaining why not what).
4. Verify the fix in the browser via Playwright before moving on.
5. Commit separately: `fix: <finding number> — <one line>`

Absolute rules:
- No console.log, no debugger, no TODO, no commented-out code left behind.
- No new npm dependency, no build step, no JSX.
- Do not change behaviour the findings did not identify as broken.
- If a fix needs a schema change, write the SQL migration into migrations/ and apply it
  to the BRANCH only. Never to production.
- If you are unsure whether something is a bug or intended business logic, STOP and ask.
  Do not guess at how a UAE contracting business is supposed to work.

After each severity tier, run the full test suite and report pass/fail.
```

---

## PHASE 6 — End to end tests

```
Build a Playwright test suite in tests/. Use the Playwright MCP to drive a real browser
against the local app pointed at the BRANCH database.

Structure: tests/e2e/<area>.spec.js, plus tests/fixtures/ for seed data and
tests/helpers/ for login and teardown.

THE ISOLATION RULE — read this twice:
- Every test runs against the branch database. Never production.
- Every record a test creates is tagged with a run id in a field the app already has,
  e.g. a notes or reference field, in the form ZZTEST-<run-id>.
- Every test file has an afterAll that deletes every record it created, in the correct
  dependency order (payments before invoices, invoices before projects, and so on).
- A global teardown asserts that ZERO rows tagged ZZTEST remain in ANY table.
  If any remain, the run fails loudly.
- Also assert that no rows were left in activity_log, correspondence, or any audit table
  referencing test records.
- Tests never modify settings, offices, users, or the product catalogue. If a test needs
  a product, it seeds its own and removes it.

Write full end-to-end journeys, not unit tests. At minimum these six:

TEST 1 — The full job lifecycle
Sign in → create a client → log a visit → create an inquiry → build a quotation with
at least three line items across two sections → verify the calculated totals, VAT and
margin against hand-computed expected values → send for approval → approve as an owner →
convert to a project → set payment milestones → raise a purchase order → receive a
shipment → book stock in → issue stock to the project → raise an invoice → record a
payment → verify the project shows correct actual-vs-quoted cost and the correct
outstanding balance. Then tear it all down and prove nothing is left.

TEST 2 — Office isolation
Create a record in Dubai. Switch to Belgium and assert it is not visible. Switch to BOTH
and assert it is. Verify the Dubai record carries the correct currency, VAT rate and
quotation number prefix, and the Belgium one carries its own. Verify a record created
while in BOTH mode gets a valid office, not null.

TEST 3 — Permissions
Sign in as each role. Assert exactly what each can see and change. Then attempt the same
operations by calling Supabase directly from the page context, bypassing the UI entirely,
and assert RLS blocks them. A rule that only the UI enforces is a failed test.

TEST 4 — Input abuse on every form
Enumerate every input in the application. For each, submit: empty, zero, negative,
999999999999, text in a number field, 5000 characters, emoji, Arabic text, a leading
apostrophe, SQL-injection-shaped text, a date of 1900-01-01 and one of 2200-01-01.
Assert the app either rejects it with a clear message or handles it safely. Assert no
crash, no blank screen, no NaN rendered anywhere, and no silent failure where the user
believes a save succeeded and it did not.

TEST 5 — Session and refresh
Sign in, hard refresh, assert still signed in and on the same tab. Refresh mid-edit with
unsaved data and assert the documented behaviour. Two tabs open, sign out in one, assert
the other reacts correctly. Simulate an expired token and assert it refreshes rather than
dumping the user at the login screen.

TEST 6 — Failure and offline
Intercept Supabase calls and force them to fail. Assert every screen shows a clear error
and nothing silently pretends to have saved. Go offline, use the app, come back online,
assert nothing is corrupted or duplicated.

Every test must assert real values, not just "no error thrown". Include a
tests/README.md explaining how to run them and how the teardown guarantee works.
```

---

## PHASE 7 — Prove there is no trace

```
Managers review this system. Any artefact from testing that appears on a screen is a
failure, even if the data is technically deleted.

Produce docs/CLEANLINESS-REPORT.md proving all of the following:

1. Query every table on the branch for rows matching ZZTEST or created during the test
   window. Report the count for each table. Every count must be zero.
2. Check activity_log, correspondence, and any audit or history table for orphaned
   references to deleted test records.
3. Check every sequence and counter — quotation numbers, invoice numbers, PO numbers.
   Document which ones advanced during testing and cannot be rolled back. This is the
   single strongest argument for never running these tests against production; state it.
4. Grep the entire shipped codebase for: console.log, console.warn, console.error,
   debugger, TODO, FIXME, XXX, HACK, test@, example.com, localhost, any hardcoded
   credential, and any commented-out block. Report every hit with a line number.
5. Confirm config.local.js is gitignored and that no branch credentials appear in any
   committed file.
6. Confirm the shipped index.html contains no test-only code paths, no feature flags
   left switched on, and no debug UI.
7. Diff the final index.html against the 2026-09-10e baseline and produce a plain-English
   summary of every change made, grouped by finding number.
```

---

## PHASE 8 — The report for Charles

```
Write docs/AUDIT-REPORT.md for a non-technical reader. Charles and Chris will read this.

Sections:
1. What was reviewed — scale of the codebase, what was covered.
2. What was found — grouped by severity, each described in terms of business impact,
   not code. "Quotations for Belgium were showing the Dubai VAT rate" not
   "office_id not passed to vatRate()".
3. What was fixed, with the business consequence of each fix.
4. What was found but NOT fixed, and why — decisions that need Charles, not code.
5. What testing was performed, and the explicit confirmation that it ran on an isolated
   database and left no trace on the live system.
6. The risks that remain. Be honest. Include the ones that are business decisions:
   the two overlapping sales funnels, the thin permission model, the second ledger
   duplicating Zoho, and the absence of a git history before today.
7. Recommended next steps in priority order.

No jargon. Short sentences. If a section would be empty, say so rather than padding it.
```

---

# PART C — HOW TO ACTUALLY RUN THIS

**One phase per session.** After each: `/clear`, then start the next. A 13,800-line file
plus a schema plus test output will exhaust the context otherwise, and a Claude Code
session that has run out of room starts making things up.

**Commit after every phase.** `git add -A && git commit -m "Phase N complete"`

**Read the findings yourself before Phase 5.** Some of what gets flagged as a bug will
be deliberate business logic that only Charles understands. Strike those off the list
before any code is changed.

**Use plan mode for the audit phases.** Press Shift+Tab twice to enter plan mode for
Phases 0–4, so it reads and reasons without touching files.

**Never let it near production.** If at any point Claude Code proposes running something
against `zlyqecpsgzgbpbikrlro`, stop it.

**Expected effort:** Phases 0–4 roughly a day. Phase 5 depends entirely on what is found.
Phases 6–8 roughly two days. Budget a week for the whole sweep.
