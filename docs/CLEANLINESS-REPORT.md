# Phase 7 — proof there is no trace

The tests run against the isolated test project (`otwzrmwvvrtjosxgqhkb`), never production
(`zlyqecpsgzgbpbikrlro`). This report proves the test database carries no leftover test data
and the shipped files carry no test or debug artefacts.

Last run: 11 September 2026, after the whole suite passed on the reviewer's machine with
Charles's decisions applied (24 per-fix and per-decision browser checks, then the 14
end-to-end journeys, then `tests/cleanliness_check.js`).

## 1 & 2. No ZZTEST rows anywhere; no orphans in the audit tables

Every record any test creates carries the tag `ZZTEST`. After the suite, a scan looks in
**every text column of every base table** for anything still tagged, and the run fails if it
finds any. The end-to-end suite's global teardown prints:

```
E2E teardown: zero ZZTEST rows remain in any table.
```

`node tests/cleanliness_check.js` re-runs the same scan on demand and also checks the audit
tables (`activity_log`, `correspondence`) specifically. Result of the run for this report:

- **ZZTEST rows anywhere:** none.
- **Every transaction table is empty** — clients, field_visits, inquiries, quotations,
  quotation_sections, quotation_lines, projects, payment_milestones, purchase_orders,
  purchase_order_lines, shipments, shipment_lines, invoices, invoice_lines, invoice_payments,
  stock, stock_movements, bank_accounts, partners, payroll, commitments, correspondence: all
  **0**. The test project holds only reference data: 133 products, 259 packs, 61 product
  documents, 2 warehouses.
- **activity_log and correspondence referencing ZZTEST:** 0.
- **activity_log** fills up during testing (the log records every create and delete
  automatically): 239 rows after the first full run, 68 and then 71 after the runs on
  11 September.
  Because the test project has no real business activity, all of them were test noise
  pointing at now-deleted records, and would have shown as recent activity on the "Latest
  changes" screen. They were cleared each time; the log now reads **0**.

The scan helper it uses is created and dropped in the same call, so it leaves no trace of
its own.

## 3. Counters that advanced and cannot be rolled back

Deleting a test's rows does not un-issue a number. Quotation and invoice numbers are drawn
from per-office counters that only ever move forward, so any quotation a test saved
advanced its office's counter for good.

| Office | Quotation numbers → next | Invoice numbers → next | Order numbers → next |
|---|---|---|---|
| Dubai (DXB) | 744 | 1 | 1 |
| Bruges (BRU) | 1 | 7 | 2 |

Dubai's quotation counter advanced from 732 to **744** during the sweep: twelve quotation
numbers are now permanently used and cannot be reissued. Bruges issued six invoice numbers
(next is 7) and one order number (next is 2). Orders got their own per-office series in
migration 0072. On the test project these gaps mean nothing; on production they would be
missing numbers a client or auditor would notice.

**This is the single strongest reason these tests must never run against the live system.**
On the test project it is harmless; on production it would burn real quotation and invoice
numbers that Charles's clients and auditors would notice were missing. The suite is built so
it *cannot* reach production: the served page refuses any config but the test project, and
the SQL helper is hard-wired to the test project's ref with a token that cannot see
production.

## 4. The shipped codebase carries no test or debug artefacts

Grepped across the shipped files (`index.html`, `config.js`, `sw.js`, `_headers`,
`manifest.webmanifest`):

| Looked for | Hits |
|---|---|
| `console.log` / `console.warn` / `console.error` | 0 |
| `debugger` | 0 |
| `TODO` / `FIXME` / `XXX` / `HACK` | 0 |
| `test@` / `example.com` | 0 |
| `localhost` | 0 |
| commented-out code (`// const`, `// return`, `// await`, …) | 0 |
| `ZZTEST` (test tag) | 0 |
| the test project ref (`otwzrmwvvrtjosxgqhkb`) | 0 |
| hardcoded credential / token | 0 |

The only Supabase reference in a shipped file is the production URL and publishable anon key
in `config.js`, which is correct — that is what the app ships with. The publishable key is
designed to be public; all authorisation is in the database.

## 5. Local secrets are not in the shipped set and are gitignored

`.env.local` (the test token and test logins) and `config.local.js` (the test project URL
and key) are both listed in `.gitignore` and are not among the shipped files. The test
project's URL and keys appear only in those two local files and in the test harness under
`tests/`, never in `index.html` or `config.js`.

## 6. No test-only code paths, feature flags or debug UI in `index.html`

There is no `ZZTEST`, no `example.com`, no test project reference, and no `debug` token in
`index.html`. The only `window.__` globals are the app's own (`window.__BT_LINK`,
`window.__BT_INSTALL` for the PWA install prompt, `window.__BT_T` for translations) — not
flags or test hooks. Nothing in the shipped file behaves differently under test.

## 7. What changed in `index.html`, in plain English

Phases 0–4 (map, schema audit, security audit, findings, the refresh investigation) and the
Phase 5 fixes A–D (the currency, office, numbering, held-stock, atomic-save, invoice-office
and empty-order fixes, plus migrations 0059–0067) were applied earlier and are recorded in
`docs/FINDINGS.md`, `docs/SECURITY-AUDIT.md` and `docs/SCHEMA-AUDIT.md`. This session added
the remaining Phase 5 work:

- **E (F-072):** a "New product" path — a reusable modal on the catalogue and a product
  picker on each quotation section that can also create a product on the spot.
- **F (Charles's item 1):** a technical/safety data-sheet completeness flag on the catalogue
  grid, the product page, the shipping request, a "Missing sheets" catalogue filter, and a
  home-screen queue row.
- **G (Charles's item 6):** three quotation-editor conveniences — a new section defaults its
  area from the previous one, a single "Save & PDF" action, a teaching placeholder on the
  spec-note box — and one CSS line so the colour blocks print without the dialog toggle.
  **The printed quotation sheet, its layout and wording are byte-for-byte unchanged**, proven
  by comparing the print template block before and after.

No `console.log`, `debugger`, `TODO`, or commented-out code was left behind. No new npm
dependency, build step or JSX was introduced. The migrations added in this and earlier
sessions were applied to the **test project only**.
