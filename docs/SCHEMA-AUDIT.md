# Build-Tech Pro — Schema audit (Phase 1)

Compared: `index.html` build `2026.09.10-e` against the **production** project
`zlyqecpsgzgbpbikrlro` (Postgres 17.6, PostgREST 14.5), read on 2026-09-10.

**How the schema was read.** Branching is not available on the Free plan and no second
project existed, so the schema was read from production in two read-only passes: the
Management API's generated types, bucket list and auth config (plain GETs), then, with the
owner's approval, catalogue queries through the API's SQL endpoint, which executes as
`supabase_read_only_user` and cannot write. Only `pg_catalog` / `information_schema` were
read, plus approximate row counts from `pg_stat_user_tables`. No business data was read.
Raw outputs are in `docs/schema/`; the readable summaries used here are `columns.txt`,
`constraints.txt`, `functions.txt`, `triggers.txt`, `rls.txt`, `views.txt`.

Ranking: **BREAKS** (users hit it today) / **RISK** (breaks under some input or path) /
**COSMETIC**.

---

## Inventory

| | Count | Notes |
|---|---|---|
| Base tables | 45 | Every table the code names exists. Two the code never uses: `applied_migrations` (8 rows), `product_transport` (8 rows; only in the backup list). |
| Views | 23 | All 19 the code queries exist. Four exist unused: `approval_progress`, `commitments_outstanding`, `stale_inquiries`, `visit_scoreboard`. `correspondence_feed` is named in `OFFICE_OWNED` (index.html 1942) but does not exist; harmless because nothing queries it. |
| Functions | 15 | 4 RPCs the code calls (`next_quotation_reference` in two overloads, `next_po_reference`, `next_invoice_reference`, `receive_po_line`), `is_owner`, 9 trigger functions, 1 event trigger. Argument names match the calls. |
| Triggers | 20 in `public` | Listed in section 9. |
| Enums | 12 | Every status/kind list in the code matches its enum exactly. |
| Storage buckets | 6 | `product-docs`, `shipment-docs`, `approval-docs`, `commitment-docs`, `po-docs`, `scope-docs`. All private, no size limit, no MIME restriction. |
| Users | 4 | First created 2026-09-01, latest 2026-09-09. |
| Data volume | small | 133 products, 259 packs, 61 product documents, 68 clients, 67 visits, 3 quotations (18 sections, 128 lines), 1 project, 1 purchase order (6 lines), 2 shipments (28 lines), 24 expenses, 0 invoices, 530 activity-log rows. |

---

## 1. Columns the frontend reads or writes that do not exist

| # | Rank | Where | What | Effect |
|---|---|---|---|---|
| 1.1 | **BREAKS** | `OrderPage.load`, index.html 6089 | `.from('purchase_order_lines').select('*, products(name,unit_label)')` — `products` has no `unit_label` column | PostgREST rejects a select that names an unknown embedded column, so this query returns an error and no rows. The error is never checked (6090 only checks `po.error`), so every order page opens with "Nothing on this order yet", an order value of 0 and 0% received, whatever is on the order. Receiving, editing lines and reading a proforma into an order all start from this empty list. Production has one order with six lines to see it on. |
| 1.2 | **RISK** | `Operations`, 3100 | `i.last_activity` on rows from `inquiries` — no such column | The "No movement on … for a fortnight" queue item can never fire. The `stale_inquiries` view (with `days_quiet`) exists and is never used; it is presumably what this was meant to read. |
| 1.3 | COSMETIC | `Commitments`, 11899 | `r.notes` on rows from `commitment_totals` — the view has no `notes` column (the base table does) | Notes on a supplier quotation are never shown. |

Everything else the code names, in selects, filters, embeds, inserts and updates, exists,
and every embed (`clients(name)`, `products(*)`, `quotation_lines(*)`, `partners(name)`,
`projects(name)`, `warehouses(name)`, `quotations(reference)`, `product_packs(*)`,
`product_aliases(alias)`, `product_documents(id)`, `inquiries(...)`) has a matching
foreign key.

---

## 2. Columns that exist but the frontend never uses

Never mentioned anywhere in the script:

| Table | Columns |
|---|---|
| `activity_log` | `actor`, `row_id` (both written by the trigger, never shown) |
| `applied_migrations` | whole table |
| `clients` | `created_by`, `sector` |
| `commitments` | `expense_id` |
| `correspondence` | `inquiry_id`, `logged_by` |
| `inquiries` | `lost_reason`, `owner_id` |
| `invoices` | `created_by` |
| `product_transport` | whole table; only the `product_transport_summary` view is read |
| `products` | `net_kg_per_pack` |
| `projects` | `inquiry_id` |
| `quotations` | `created_by`, `inquiry_id` |
| `settings` | `updated_by` |
| `stock_movements` | `created_by` |

Generic names that are never set for the table in question:

- `purchase_orders.shipment_id`, `expenses.shipment_id` — the PO↔shipment and
  expense↔shipment links the schema provides are used by no screen. (`project_actuals`
  reads shipments by `project_id` instead.)
- `scope_documents.client_id` — never written; free-text `client_name` is used.
- `offices.country`, `offices.phone`, `offices.is_active` — never read.
- `product_documents.issued_on`, `uploaded_by`, `notes`; every `*_documents.notes`;
  `invoice_payments.note`; `expenses.notes`; `stock.unit`; `product_packs.note`.
- `commitment_lines` — never inserted. The Commitments panel says "Lines can be typed in
  once it is saved" (11815) but no screen adds lines. **RISK**: a promise the UI cannot
  keep; production already has 10 lines that must have been loaded from outside the app.
- `commitments.expense_id` — never written, and the database CHECK
  `commitments_settled_has_an_expense` requires it for status `settled`. The UI refuses
  `settled` (11776) and says to do it "from Money out", where there is no control. A
  commitment can never be settled through the app. **RISK**.
- The three `inquiry_id` columns (projects, quotations, correspondence) are the schema's
  link between the Pipeline funnel and the rest of the system. Nothing sets them: the root
  of the "two overlapping funnels" item for Phase 3.
- `created_by` on clients, invoices, quotations, stock movements and `logged_by` on
  correspondence are never stamped, so "who created it" exists only in `activity_log`, and
  only for the nine tables that have a log trigger (section 9).
- View columns available but unused: `project_totals.gross_profit`, `total_cost`, `paid`,
  `milestone_total`; `invoice_totals.subtotal`, `vat`; `purchase_order_totals.fully_received`,
  `value`; `visit_funnel.jobs`, `job_value`, `open_inquiries`, `accepted_quotations`;
  `document_watch.days_left`; most of `catalogue_pricing`; `stock_detail.product_dcd_expiry`,
  `warehouse_cert_expiry`.

---

## 3. Type mismatches

Column types and precision are now known. The code converts almost every numeric write
with `Number()`, `num()` or `nz()` and every date comes from an `<input type="date">` as
ISO `YYYY-MM-DD`, so the common mistakes (formatted dates, `'true'` as text) are absent.
What remains:

| # | Rank | Where | Issue |
|---|---|---|---|
| 3.1 | **RISK** | `OfficesPanel`, 7144 and 7185 | `offices.vat_rate` (`numeric(6,4)`, NOT NULL) is edited in a `type="text"` box and written as `nz(n.vat_rate)`. `nz("0,05")` is `Number("0,05")` = `NaN`, serialised as `null`, refused by NOT NULL. A Belgian owner typing the rate with a comma gets "That did not save" with a Postgres message; typing "5" instead of "0.05" silently sets 500% VAT. |
| 3.2 | **RISK** | `Settings`, 7330 | `settings.value` is `text`, so `supply_discount`, `eur_aed_rate`, `default_margin`, `vat_rate` are free text parsed with `Number()` at every read. A comma or a space makes them `NaN`, and `NaN` propagates into every price. No validation on save. |
| 3.3 | COSMETIC | `Commitments`, 11764 | `eur_aed_rate` written as the literal `4.27` for EUR commitments. The generated column `amount_aed` also falls back to 4.27 when the rate is null, so the app and the database share the same stale constant rather than the settings rate. |
| 3.4 | — | `OfficesPanel`, 7145 | `quote_digits: Number(n.quote_digits)||4` — no input exists for it; harmless. |
| 3.5 | — | Booleans | `dcd_certified`, `is_dangerous`, `dcd_approved`, `vat_applies`, `provided` are written as real booleans. Correct. |
| 3.6 | — | Enums and CHECKs | `STAGES`, `PSTATUS`, `POSTATUS`, `SSTATUS`, `SMODE` (empty sent as `null`), `ISTATUS`, `CSTATUS`, `AKINDS`, `ASTATUS`, `QSTATUS`, expense and payroll `kind` all match their enums. `quotations.currency` (AED/EUR), `language` (en/nl/fr), `price_mode` (spread/discount), `spec_equivalents.confidence` (firm/likely/weak) all match their CHECK constraints. |
| 3.7 | — | Timestamps | `correspondence.occurred_at` written as local noon → ISO, a valid `timestamptz`. `settings.updated_at` as `toISOString()`. Types correct; the timezone question belongs to Phase 3. |

---

## 4. NOT NULL columns with no default that a code path can fail to supply

Every insert was checked against the columns that are NOT NULL without a default. All are
supplied, from validated fields or literals:

| Table | Required on insert | Supplied by |
|---|---|---|
| `approvals` | `title` | validated, 13091 |
| `bank_accounts` | `name` | literal, 12359 |
| `clients` | `name` | validated, 3914; `newName.trim()`, 3512 |
| `commitments` | `amount`, `supplier`, `title` | validated, 11755–11757 |
| `correspondence` | `summary` | validated, 5402 |
| `expenses` | `amount`, `description` | validated, 12076–12077 |
| `field_visits` | `client_id`, `visit_date` | 3518–3519 |
| `inquiries` | `client_id`, `project_name` | validated, 3431–3432 |
| `invoice_lines` | `description`, `invoice_id` | 12514–12518, `''` on add |
| `invoice_payments` | `amount`, `invoice_id` | 12627 |
| `invoices` | `reference` | RPC result, 12502 — **but see SECURITY-AUDIT 4: the RPC returns NULL for non-owners**, so the insert fails on this column |
| `partners` | `name` | literal, 12232 |
| `payment_milestones` | `name`, `project_id` | `''`, 4262 |
| `payroll` | `amount`, `person` | validated, 12241–12242 |
| `product_wordings` | `product_id`, `wording` | 11122–11123 |
| `project_materials` | `description`, `project_id` | 4150–4152, 4254 |
| `projects` | `name` | validated, 4133 |
| `purchase_order_lines` | `description`, `po_id` | 5851–5853, 6190, 6239–6241 |
| `purchase_orders` | `reference` | RPC result, 5804 |
| `quotation_lines` | `description`, `position`, `section_id` | 11101 |
| `quotation_sections` | `position`, `quotation_id`, `title` | 11099 |
| `quotations` | `eur_aed_rate`, `reference` | 11076–11079 — same RPC problem as invoices for non-owners |
| `scope_documents` | `file_name` | 10134 |
| `shipment_lines` | `description`, `shipment_id` | 6670–6671, 6789 |
| `shipments` | `reference` | validated, 6646 |
| `spec_equivalents` | `term` | validated, 10188 |
| `stock_movements` | `direction`, `product_id`, `quantity`, `warehouse_id` | validated, 4487–4494 |
| `warehouses` | `name` | literal, 4513 — **RISK**: `warehouses.name` is UNIQUE across both offices, so pressing "Add warehouse" twice before renaming fails, and Dubai and Belgium cannot both have a warehouse called "Main store" |

`quotation_lines.description` and `project_materials.description` are NOT NULL but the
app writes `''` freely, so "required" means non-null, not non-empty.

---

## 5. Foreign keys and what deleting does

ON DELETE rules are now known. What matters is where the frontend ignores the database's
answer or lets a cascade run unannounced.

| # | Rank | Where | What happens |
|---|---|---|---|
| 5.1 | **RISK** | `QuotationEditor.remove`, 11145 | `delete()` result ignored. Sections and lines CASCADE; `projects`, `purchase_orders`, `shipments`, `invoices`, `correspondence`, `scope_documents` are SET NULL. The delete succeeds and silently unlinks any project, order or shipment built from that quotation. The scope-document rule "a quotation was built from it, so it stays" (8231) becomes void the moment the quotation is deleted. |
| 5.2 | **RISK** | `InvoicePage.remove`, 12639 | Result ignored. Lines and payments CASCADE. `payment_milestones.invoice_ref` (text) and `invoiced_on` are never cleared, so the milestone still reads as invoiced. |
| 5.3 | **RISK** | `Clients.removeClient`, 3782–3808 | `inquiries` and `projects` are RESTRICT, `quotations` and `invoices` default (also restrict); the count check covers exactly those four, so the guard is right. `correspondence` and `field_visits` CASCADE, which the warning states. `approvals`, `shipments` and `scope_documents` are SET NULL silently: a shipment for that client loses its client with no mention. |
| 5.4 | **RISK** | `Banks.del`, 12364; `People.delPartner`, 12238 | Results ignored. `expenses`, `payroll`, `invoice_payments` → bank account SET NULL; `expenses.paid_by_partner_id`, `payroll.partner_id` → SET NULL. Deleting a bank account detaches every payment and cost ever recorded against it; `cash_position` then no longer accounts for them. Deleting a partner detaches their funded costs and drawings from the ledger. A single `confirm()` guards both. |
| 5.5 | **RISK** | `ProjectPage.delMil`, 4265 | Result ignored; `invoices.milestone_id` SET NULL. Deleting an invoiced milestone silently breaks the invoice's link. |
| 5.6 | — | `OrderPage.remove`, 6271 | Trigger `po_no_delete_once_received` refuses once anything is received (the UI checks the same). Lines and documents CASCADE. Correct. |
| 5.7 | — | `ApprovalPage.remove`, 13188 | Documents and requirements CASCADE. Result ignored but nothing else references approvals. |
| 5.8 | — | Products and warehouses | Not deletable from the UI. If deleted in SQL: `stock`, packs, aliases, documents, transport rows, wordings, equivalents and approvals CASCADE; `stock_movements` RESTRICT on warehouse, CASCADE on product (a deleted product erases its movement history). |
| 5.9 | — | `expenses` delete, 12101; `inquiries` delete, 3445 | Results shown. `commitments.expense_id` SET NULL, but the CHECK then forbids the commitment staying `settled`, so deleting the expense behind a settled commitment fails with a constraint error the user sees verbatim. |

---

## 6. `office_id`: schema versus what the code assumes

Every base table in `OFFICE_OWNED` has `office_id uuid NOT NULL REFERENCES offices(id)`
with the same default: **the fixed id `67ec3e39-ebac-4b7a-8a50-06b96b8dad40`**, which is
one specific office (almost certainly Dubai, the original office; Phase 6 will confirm).
Every office-scoped view exposes `office_id`.

| # | Rank | Finding |
|---|---|---|
| 6.1 | **HIGH** | Sixteen tables receive inserts with no `office_id` in BOTH mode (MAP.md 5b). Each of those rows lands in the default office regardless of who created it. A Belgian user working in BOTH creates a Belgian client, cost, visit or invoice and it is filed as Dubai's, with Dubai's currency and VAT implied downstream. Three tables are protected by the trigger `office_must_match_parent` (`stock`, `stock_movements`, `project_materials` take the parent warehouse or project's office). The other thirteen are not. |
| 6.2 | **RISK** | `scope_documents.office_id` exists (nullable, no default) but the table is not in `OFFICE_OWNED`, so it is neither filtered on read (8209) nor stamped on insert (10140). The file path carries the office code, the row carries `null`. |
| 6.3 | — | `profiles.office_id` is nullable; a user with none falls back to `offices[0]` by `position` (13681). The 6.1 default and this fallback are not necessarily the same office. |
| 6.4 | — | `invoice_payments` has no `office_id` (it is a child of `invoices`) and is read directly in Operations and FinanceOverview (MAP.md 5c). Correct schema, wrong read. |

---

## 7. Money columns: precision

**Every money and quantity column is `numeric` with an explicit scale. There is not a
single `real` or `double precision` column in the schema.** Conventions:

| Kind | Type | Columns |
|---|---|---|
| Money | `numeric(14,2)` | all `amount`, `*_cost`, `value`, `sell_rate`, `cost_rate`, `rate`, `eur_total`, `opening_balance`, `share_capital`, `price_target`, `discount_amount`, weights on shipments |
| Unit prices | `numeric(14,4)` / `numeric(12,4)` | `purchase_order_lines.unit_price`, `list_price`; `product_packs.eur_per_unit`; `product_wordings.last_cost` |
| Quantities | `numeric(14,3)` / `numeric(10,3)` | every `qty_*`, `quantity`, `packs`, `weight_kg`, `pack_qty`, `coverage_*`, `volume_cbm` |
| Rates | `numeric(10,4)` for FX; `numeric(6,4)` for VAT; `numeric(5,2)` discount %; `numeric(6,3)` ownership %; `numeric(6,2)` milestone % | |
| Computed in the database | `GENERATED ALWAYS` | `purchase_order_lines.line_total = round(qty_ordered × unit_price, 2)`; `commitment_lines.amount = round(quantity × rate, 2)`; `expenses.amount_aed` and `commitments.amount_aed` = `round(amount × coalesce(eur_aed_rate, 4.27), 2)` for EUR, else `amount` |

Three consequences for Phase 3:

- The app rounds unit prices to 4 dp and quantities to 3 dp before writing (5835, 5845,
  5860), which matches the columns. Anything finer is rounded by Postgres silently.
- The two `amount_aed` columns hard-code `4.27` as the fallback FX rate, independently of
  `settings.eur_aed_rate`. The Costs screen always supplies a rate (12083), so the fallback
  only bites for rows created without one, i.e. commitments.
- View totals are plain `numeric` (unbounded scale) computed from these; the client-side
  sums in the app operate on floats and are compared to them in several places.

---

## 8. Views the frontend selects from

All 19 exist and, except for `commitment_totals.notes` (1.3), every column the code reads
is present. Twenty of the 23 views are **not** `security_invoker`; only `catalogue_pricing`,
`document_watch` and `product_transport_summary` are. Consequence in SECURITY-AUDIT 2e.

---

## 9. Triggers, and what the app assumes about them

| Table | Trigger | Effect the app relies on |
|---|---|---|
| `auth.users` | `on_auth_user_created` → `handle_new_user` | Creates the `profiles` row with role `full`. The Access list's "they appear here the moment they accept" (7095) is this. |
| `approval_requirements`, `expenses`, `field_visits`, `invoices`, `payroll`, `projects`, `quotation_lines`, `quotations`, `stock_movements` | `log_*` → `log_activity` | Fills `activity_log`. **Not** on purchase orders, order lines, invoice payments, clients, products, packs, settings, offices, partners, bank accounts, commitments, approvals, warehouses. The Settings page's claim (7025) that orders, costs and payments are logged is only partly true: costs yes, orders and payments no. |
| `quotation_lines` | `log_quotation_lines` | Because the editor deletes and re-inserts every section and line on every save (11096–11106), one save of a 128-line quotation writes ~256 log rows. Production's 530 rows after three quotations is that. **RISK** for Phase 3 (log becomes unreadable; "Latest changes" on the home screen is all line churn). |
| `approvals` | `approvals_sync` → `sync_approval_to_subject` | Marking an approval `approved` flips `products.dcd_approved` / `warehouses.dcd_certified`; the ApprovalPage message "Anything this was holding up has been released" (13182) is true. Any other status sets them back to false. |
| `inquiries`, `quotations` | `promote_prospect_on_*` | First inquiry or quotation turns a prospect into a client, which is how a company "moves here the day it is" priced (3893). |
| `profiles` | `profiles_role_is_the_owners` | Role changes need an owner. |
| `purchase_orders` | `po_no_delete_once_received` | Matches the UI's own check (6267). |
| `stock`, `stock_movements`, `project_materials` | `*_office_follows_parent` | Office copied from warehouse or project. |
| `stock_movements` | `stock_movement_applied` → `apply_stock_movement` | Upserts `stock.qty_on_hand` (unique on product + warehouse). No floor: issuing more than is held goes negative. |

CHECK constraints the UI must mirror: `projects.progress_pct` 0–100 (mirrored, 4229);
`purchase_order_lines.discount_pct` ≥ 0 and **< 100** (the implied-discount code at 5848
can round to exactly `100.00` and be refused); `qty_received ≤ qty_ordered + 0.001`;
`stock_movements.quantity > 0` (mirrored, 4490); documents need a path or a URL (mirrored);
a priced pack needs a `pack_qty`; a line cannot be both build-up and spec note (mirrored by
the button logic); a settled commitment needs an expense (see 2).

Unique constraints: `quotations(reference, revision)`, `invoices(reference)`,
`purchase_orders(reference)`, `shipments(reference)`, `warehouses(name)`,
`stock(product_id, warehouse_id)`, `product_wordings(product_id, wording)`,
`profiles(email)`, `offices(code)`. `next_po_reference` and the client-side shipment
reference are both "max + 1" with no lock, so two people creating at once produce a
duplicate and the second insert is refused (RISK, Phase 3).

---

## Also observed

- **Auth configuration**: JWT lifetime 3600 s, refresh-token rotation on with a 10 s reuse
  window, no session timebox or inactivity timeout, `disable_signup` **false**, password
  minimum length 6 (the app enforces 8), site URL and redirect allow-list both
  `https://shiny-sound-c7b3.charleseliottbas.workers.dev`, which is therefore the live
  deployment (a Cloudflare Workers domain under Charles's account). Relevant to Phases 2
  and 4.
- `profiles.role` is allowed to be `'staff'` by its CHECK; the app knows only `owner` and
  `full`.
- `applied_migrations` holds 8 names; Supabase's own `supabase_migrations` schema does not
  exist, so migrations were applied by hand in the SQL editor. The code's error messages
  refer to 0035, 0046, 0048, 0056, 0057, 0058.

## Still open

Only one item: confirming 1.1 as a user sees it, in a browser against the test project.
Everything else in this phase is now determined from the catalogues.
