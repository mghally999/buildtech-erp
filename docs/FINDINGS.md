# Build-Tech Pro — Findings (Phase 3)

Build `2026.09.10-e`. Line numbers refer to `index.html`. Database facts come from the
production catalogue exports in `docs/schema/` (Phase 1 and 2); no data was read, so
anything described as "in production" is what the schema and row counts imply.

Severity: **CRITICAL** = data loss, money wrong, or security. **HIGH** = a feature is
broken. **MEDIUM** = broken under some input or path. **LOW** = cosmetic or tidy-up.

Numbering is stable: Phase 5 commits refer to `F-nnn`. Findings that are really database
fixes carry the SECURITY-AUDIT reference they came from, so this file is the single list.

No code was changed in this phase.

---

## A. Money

### A1. The price chain, worked end to end

Assumed settings (the code's own defaults; the live values were not read):
`supply_discount = 0.70`, `eur_aed_rate = 4.27`, `default_margin = 0.45`, VAT 5% (Dubai).
Product: a 25 kg pail listed at EUR 282.50 (`product_packs.eur_total`), so
`eur_per_unit` = EUR 11.30/kg; consumption "Approx. 2,50 kg/m²" on the spec line.
Section: Supply and Install, 500 m².

| Step | Where | Arithmetic | Result |
|---|---|---|---|
| List per unit | `packList` 10963–10967 | cheapest priced pack, `eur_per_unit` | EUR 11.30 / kg |
| Cost per unit | `packCost` 10970–10971 | 11.30 × (1 − 0.70) × 4.27 | AED 14.4753 / kg |
| Consumption | `parseConsumption` 7594–7609 | "2,50 kg/m²" → 2.5 | 2.5 kg / m² |
| Cost per m² | `sectionCost` 10992, rounded at 11011 | 14.4753 × 2.5 = 36.18825 | **AED 36.19** |
| Sell per m² at 45% margin | `sellFrom` 10558–10560, `atMargin` 11001 | 36.19 ÷ (1 − 0.45) = 65.8 | **AED 65.80** |
| Margin check | `lineMargin` 11037 | (65.80 − 36.19) ÷ 65.80 | 45.0% (mark-up 81.8%) |
| Subtotal | 10829 | 500 × 65.80 | AED 32,900.00 |
| VAT | 10906 | 32,900 × 0.05 | AED 1,645.00 |
| Total | 10907 | | **AED 34,545.00** |
| Printed sheet | 10911–10915 | lines rounded to whole units first | 32,900 / 1,645 / 34,545, identical here |
| Database, same product | `catalogue_pricing` view | `round(11.30 × 0.30 × 4.27 × 2.5, 2)` = 36.19; `sell = 36.19 ÷ 0.55 + install_rate` | 36.19 and 65.80 (+ install rate) |

The chain is correct, applied once, in the right order, and the browser and the database
agree on it. Margin means profit ÷ sell everywhere (`lineMargin`, `secMargin`, project
`marginPct` 4217, `project_actuals` view, `catalogue_pricing`), and the mark-up mode
(`cost × (1 + m)`) is clearly labelled and never mixed with it. The findings below are
about what happens around that chain, not inside it.

### A2. Findings

| # | Sev | Lines | What goes wrong for the user | Proposed fix |
|---|---|---|---|---|
| **F-001** | **CRITICAL** | `quotation_totals` view; used at 8304–8305, 4125–4130 | The database view sums `quantity × sell_rate` over every non-spec line, **including build-up lines**. The editor excludes build-up from the subtotal (10828–10829) and the printed sheet excludes them (11605). So the Quotations list shows a subtotal and margin that include the product lines under each priced line, and **a project created from a quotation takes that inflated figure as its contract value** (4129). For a section priced once at 32,900 with its products beneath as build-up, the list and the new project can show 65,800. | Change the view to `AND l.is_costing = false` in the subtotal (keep build-up in `cost_total`). Migration in `migrations/`. |
| **F-002** | **CRITICAL** | 12502–12511, 12764–12768, 12800, 12809, 12815–12818 | Every invoice takes its number from the global `settings` series, its VAT rate from `settings.vat_rate` (default 0.05), and its printed letterhead, TRN, bank details and terms from `settings` (Dubai's), and writes the amount in dirhams and fils. A Belgian invoice would go out as Build-Tech Protection Materials L.L.C, TRN, 5% VAT, AED wording, Dubai numbering. Not yet hit: production has 0 invoices. | Give invoices the same office treatment as quotations: `office_id`, `currency`, `vat_rate` from the office; letterhead via `oc()`; number via an office-aware RPC (`next_invoice_reference(p_office)` with a per-office counter); `inWords` per currency. |
| **F-003** | **CRITICAL** | `cash_position` view (spent = `expenses.amount_aed`), 12079–12088, 12244–12247, `partner_ledger` | Money out is stored and totalled in dirhams only. A EUR cost is converted to `amount_aed` at entry and that AED figure is subtracted from the bank account it was paid from. For a Belgian EUR account, a EUR 100 cost reduces the balance by 427. Payroll has no currency at all (labelled "Amount (AED)"). The partner ledger, project actuals and every finance card inherit this. Belgium's books cannot be kept in this module as built. | Decision for Charles: either Finance is Dubai-only (say so on screen and hide it for the Belgian office) or the module gains a currency per row and per bank account, with totals per currency. Not a code-only fix. |
| **F-004** | **HIGH** | 4019, 4022–4025, 4905–4906, 5544, 6298, 6595, 6616, 6823–6912, 12187, 11981–11994, 12371–12401, 11800–11866, 3025–3034, 3158–3171 | `AED()`, `AED0()`, `AED2()` label a number with the **viewing office's** currency unless told otherwise (2864–2870). Every figure that is AED by nature (catalogue prices converted at the FX rate, `catalogue_pricing.cost_aed`, `value_aed`, `landed_cost`, `amount_aed`, bank balances, commitments) is shown as "EUR 1,234" when the Belgium office is selected. The number is dirhams; the label says euros. | Pass `'AED'` explicitly wherever the value is AED by construction, or convert to the office currency at the record's rate before formatting. |
| **F-005** | **HIGH** | 3025–3034, 4063, 5513, 6579–6580, 11930–11976, 12437–12440 | In the BOTH view, `invoice_totals.outstanding`, `cash_position.balance`, `projects.value`, `quotation_totals.subtotal`, `purchase_order_totals.value_aed` and so on are summed across both offices with no conversion and labelled AED. EUR and AED are added as if equal. | In BOTH, either convert EUR rows at the settings rate before summing (and say so), or show two totals. |
| **F-006** | **HIGH** | 3037–3039, 11954–11958 | `new Date(y, m, 1).toISOString().slice(0,7)`: local midnight on the 1st converts to the previous day in UTC for anyone east of Greenwich. In Dubai (+4) and Belgium (+1/+2) the twelve month keys are all one month early, so the money in/out chart and the sparklines are labelled a month behind and the current month never appears. | Build keys with local parts: `` `${y}-${String(m+1).padStart(2,'0')}` ``. |
| **F-007** | **HIGH** | 7330, 5612–5616, 7793, 10152–10156, 10958–10959, 13670 | `settings.value` is text with no validation on save. A value such as `70%`, `0,70` or `4,27 ` becomes `NaN` through `Number()`. For `supply_discount` and `default_margin`, `NaN` is truthy, so the `||` fallbacks do not catch it and `NaN` reaches every cost and sell rate; costs simply stop being filled and nothing says why. (`eur_aed_rate` is the one that does fall back, silently, to 4.27.) | Validate the pricing group on save (numeric, sensible range), and parse with a helper that falls back on `NaN`. |
| **F-008** | **HIGH** | 11101–11104, 8251, 4145–4152, 6655–6673, `stock_position` view | The editor resolves products by name for costing but **never writes `quotation_lines.product_id`**. Consequences: project materials created from a quotation have no product, so `stock_position.committed` is always 0 and "Short for committed work" can never fire; shipment lines copied from a quotation carry no product, so HS/UN codes are not copied and the "Product paperwork already on file" panel is empty; the scope reader's "has been quoted before" signal (8251) is always empty. | On save, set `product_id` from `findProduct(plainText(l.description))` for build-up and spec lines that resolve. |
| **F-009** | **MEDIUM** | 3030–3031, 3124 | "Committed out" and "On order" on the home screen count purchase orders in every status except received/cancelled, so **draft** orders count as money committed. The rail badge and the old Dashboard use `open_order_lines`, which excludes drafts. Two answers to one question. | Filter to `['sent','confirmed','part']`, matching the view. |
| **F-010** | **MEDIUM** | `project_totals` view, 4063–4073, 4218–4222 | Projects report "Invoiced, not paid" from milestone dates (`invoiced_on` / `paid_on`, net of VAT, ignoring partial payments), while Finance reports it from `invoice_totals`. A milestone half-paid shows fully outstanding on Projects and half on Finance; the milestone is only marked paid when a single payment covers the whole invoice (12631). | Derive project outstanding from invoices linked to the project, or mark the milestone paid from `invoice_totals.outstanding <= 0` in a trigger. |
| **F-011** | **MEDIUM** | 7641–7643, 5616, 5703–5711 | `cargoFromQuotation` always converts at `eur_aed_rate`, even for a EUR quotation (the editor uses fx = 1 for EUR, 10959). The New order preview "What each section costs us" for a Belgian quotation is therefore in dirhams, labelled EUR (F-004). | Pass the quotation's currency into `cargoFromQuotation` and use fx = 1 for EUR. |
| **F-012** | **MEDIUM** | `catalogue_pricing` view vs 11001 | The catalogue's suggested "Sell … / m²" adds `install_rate_aed` after the margin; the editor's auto-sell (`atMargin`) never adds it. Two different suggested prices for the same product on two screens. | Decide which is right (probably the editor's, with install as a separate priced line) and align the view. |
| **F-013** | **MEDIUM** | 7659–7666 | The take-off takes the section area as `Math.max` of the m² lines with no lower bound. A negative quantity (the inputs have no `min`) gives negative kg, negative pack counts and negative weights on the freight request. | Treat quantities ≤ 0 as unreadable (add to `unresolved`). |
| **F-014** | **LOW** | 11764, generated columns on `expenses` and `commitments` | EUR commitments are stored at a hard-coded 4.27, and both `amount_aed` generated columns fall back to 4.27 when the rate is null, independently of `settings.eur_aed_rate`. | Send the settings rate from the app; consider the generated-column fallback a Phase 5 migration. |
| **F-015** | **LOW** | 7391–7392, 10959 | Settings says "Quotations keep the rate that applied on their issue date." Typed costs do persist, but "Cost it from the specification" and the auto-fill use today's rate, not `quotations.eur_aed_rate`, which is stored and never read. | Use the stored rate when re-costing a saved quotation, or change the sentence. |
| **F-016** | **LOW** | 5844–5850, `po_line_discount_ck` | An implied discount that rounds to exactly 100.00 violates `discount_pct < 100` and the order is refused with a Postgres message. | Clamp to 99.99 or treat ≥ 99.995 as the "list = amount, discount 0" branch. |
| **F-017** | **LOW** | 7784 | Pallet count puts every roll on a single pallet regardless of how many rolls. | Use a rolls-per-pallet setting, or say "plus rolls" in the text. |
| **F-018** | **LOW** | 7993–8000, 11616, 11624 | The printed sheet rounds each line to whole dirhams/euros and sums the rounded lines; the screen shows fils/cents. A Belgian quotation therefore prints with no cents. Deliberate per the comment, but the editor total and the printed total can differ by up to half a unit per line. | Note in the report; no change unless Charles wants cents on EUR sheets. |
| **F-019** | **LOW** | `project_actuals` view (`labour` filter) | Labour cost is `expenses.category ILIKE '%labour%'`, and no such category exists in `FIN_CATEGORIES` (11667–11670); the category box is a fixed list. `labour_cost` is always 0. | Add a "Labour and subcontract" category, or drop the split. |

Verified as correct and worth saying so: VAT is applied once, on the discounted subtotal
(10904–10907), never on the discount; the target-price feature strips VAT before scaling
(10840); rounding is explicit and happens once per line on the sheet; purchase orders never
reach `expenses` or the partner ledger (the only path into expenses is the Costs form); the
receipt of goods (`receive_po_line`) writes a stock movement, not a cost.

---

## B. State and data

| # | Sev | Lines | What goes wrong | Proposed fix |
|---|---|---|---|---|
| **F-020** | **CRITICAL** | 6089–6091 | `select('*, products(name,unit_label)')` names a column that does not exist; PostgREST rejects the query; `ln.error` is never read. **Every order page opens with no lines**, value 0, 0% received. Receiving, editing lines and reading a proforma into an order all operate on that empty list. | Select `products(name)` and surface `ln.error`. (SCHEMA-AUDIT 1.1) |
| **F-021** | **CRITICAL** | 11096–11107 | Save deletes every section, then re-inserts sections and lines one by one, with no transaction. A failure after the delete (network drop, an RLS refusal, a line that violates the `is_costing`/`is_spec_note` check) leaves the quotation with **no sections in the database**. The local draft on that one machine is the only copy. | Write the save as one RPC (`save_quotation(jsonb)`) that does the delete and inserts inside a transaction; or insert new sections first and delete the old ones last. |
| **F-022** | **CRITICAL** | `next_quotation_reference(uuid)`, `next_invoice_reference()` (database) | Both functions update owner-only tables as the caller. For a `full` user the update matches no rows: the quotation save reports "could not allocate a number. There is no office with that id" and the invoice insert fails on a null reference. **Non-owners cannot number quotations or invoices.** | SECURITY-AUDIT 7.4 (make them `SECURITY DEFINER`, revoke from `anon`). |
| **F-023** | **CRITICAL** | Auth config `disable_signup=false`; `handle_new_user()` | Anyone can sign up, confirm an email they own, receive a `full` profile automatically, and every policy then grants them everything. | SECURITY-AUDIT 7.2. Not a code change in `index.html`. |
| **F-024** | **HIGH** | 10585–10589, 10703–10713 | The localStorage draft is written the moment a saved quotation finishes loading, not only after an edit. Every reopen therefore shows "Picked up where you left off … Nothing has been saved to the database yet", which is false; and if a colleague saved changes in between, the stale local copy is what is shown and what Save writes back. | Only write the draft after the first user edit (a `dirty` ref), and compare `updated_at` (add the column) before restoring. |
| **F-025** | **HIGH** | 4253–4257, 4260–4264, 6788–6792, 12617–12621, 12625–12633, 12358–12362, 12231–12235 | Every "add a row" helper does `const {data} = await insert().select().single(); setState(v => [...v, data])` with no error check. When the insert fails, `data` is `null`, the list now contains `null`, the next render reads `.id` of `null`, React throws and **the whole screen goes blank**. Reload is the only way back. | Check `error`, show it, and never push a falsy row. |
| **F-026** | **HIGH** | 4485–4500, `apply_stock_movement()` | "Issued out" has no check against `blocked` stock or against what is on hand. Held stock leaves the warehouse with a success message; `qty_on_hand` goes negative. | UI check against `stock_detail.blocked` and quantity; database trigger per SECURITY-AUDIT 7.5. |
| **F-027** | **HIGH** | `log_quotation_lines` trigger, 11096–11106 | Because save deletes and re-inserts every line, one save of a 128-line quotation writes about 256 rows to `activity_log`. Production has 530 rows after three quotations. "Latest changes" on the home screen is line churn, and every save costs an `auth.users` lookup per row. | Follows from F-021; also drop the line-level trigger and log at quotation level. |
| **F-028** | **MEDIUM** | 4258, 4265, 6793, 12622, 12634, 5417, 12251, 12363, 12236, 6204, 11145, 12639, 13188 | Delete helpers remove the row from state (or leave the page) before, and regardless of, the database's answer. A refused delete looks like a successful one until the next reload. | Await the result, show `error.message`, only then update state. |
| **F-029** | **MEDIUM** | 4240–4251, 6777–6786, 12606–12615, 12225–12229, 12350–12356 | Save loops over child rows with sequential awaits and ignore each row's error; "Saved." appears even when a milestone, material, line or payment failed. `OfficesPanel.save` keeps only the last error (7147). | Collect errors; report which rows failed; or move to one RPC per page. |
| **F-030** | **MEDIUM** | 4154, 6674, 12518–12520, 4517–4522 | Fire-and-forget inserts/updates: project materials copied from a quotation, shipment lines copied, the invoice's first line and the milestone stamp, the reorder level. Failures are silent. | Check and report. |
| **F-031** | **MEDIUM** | 5620–5648 | The take-off effect in New order has no cancellation flag. Switch quotation twice quickly and the slower response wins, so the lines shown belong to the other quotation. | `let dead=false; return ()=>{dead=true}` as `Palette` already does (7464). |
| **F-032** | **MEDIUM** | 12625–12633 | "Record a payment" inserts a payment for the full outstanding amount and immediately marks the milestone paid, before the invoice is saved and even if the payment is then deleted. | Mark the milestone from the invoice's saved state (see F-010). |
| **F-033** | **MEDIUM** | 2875, 1981–1984, DB defaults `CURRENT_DATE` | `today()` is the UTC date. Between midnight and 04:00 in Dubai (02:00 in Belgian summer) every default date (visit, cost, payment, quotation, invoice, movement) is yesterday, and "past due" comparisons flip a day early. `addDays` mixes local and UTC and is a day out for any positive offset. Times in the activity log (3209, 7020) are shown in UTC with no marker. | A `localToday()` built from local date parts; keep comparisons in the same frame; format log times with the office timezone. |
| **F-034** | **MEDIUM** | 10575, 11085 | After saving a new quotation the component keeps `id='new'`, so further edits are drafted under `bt-draft-new`. The next "New quotation" restores that saved quotation instead of a blank. | Re-key the editor on the new id after the first save (the list already does `setOpenId`). |
| **F-035** | **MEDIUM** | 6629–6634, `shipments_reference_key` | The shipment number is computed in the browser from the shipments already loaded, which are office-filtered. Dubai and Belgium each compute `SHP-2026-03`; the second insert is refused by the global unique constraint with a raw Postgres message. Same for two users at once. | Number shipments in a `SECURITY DEFINER` RPC like orders, or make the constraint per office. |
| **F-036** | **MEDIUM** | `next_po_reference()`, 5804 | "max + 1" with no lock: two people creating an order at the same moment get the same number; the second insert fails with the raw unique-violation message. Same for invoices if `settings` is replaced by a counter. | `SELECT … FOR UPDATE` on a counter row, or a sequence per office. |
| **F-037** | **LOW** | 13629 | A signed-in user with no `profiles` row gets `me = {full_name, email}` with no `id`; saving a language then runs `.eq('id', undefined)`. Cannot happen through the invite flow (the trigger creates the row), only if a profile is deleted. | Refuse to render the app without a profile; tell the user to ask an owner. |
| **F-038** | **LOW** | 4739–4741 | Remove deletes the storage file before the database row; if the row delete fails the row points at a missing file. | Delete the row first, then the file. |
| **F-039** | **LOW** | 11073–11084 | A number is allocated before the quotation row is inserted; if the insert fails the number is burnt. Harmless gap in the series; noted for the report because Charles minds gaps. | Allocate and insert inside one RPC. |
| **F-040** | **LOW** | 13539–13543, 13605–13610 | Two `onAuthStateChange` subscriptions. Works, but the second deliberately ignores same-user events, which Phase 4 must confirm is safe for `TOKEN_REFRESHED`. | Phase 4. |
| **F-041** | **LOW** | 4207, 12207, various | Empty catches are all deliberate and commented (product wordings 11136, badges 13595, scope-document update 10211, service worker 1906, inflate 8407). No silent swallow of a user's save was found beyond those listed above. | None. |
| **F-074** | **MEDIUM** (Phase 4) | 3002–3019, 13599–13610, 1919 | **Observed on the test project, not deduced.** Right after sign-in the home screen fires seventeen requests at once; in two of four runs one of them (a different one each time: `invoice_payments`, then `open_order_lines`) went out **without the user's token**, PostgREST saw only the anonymous key, and answered 401. `Operations` checks errors on only four of its seventeen queries (3012), so the failed one contributes an empty array and the vitals, queue or tiles are simply wrong until the next navigation. The same race can hit any screen that loads while the session is still being applied, which is the territory of the reported "refresh signs me out" symptom. | Phase 4: diagnose against the vendored supabase-js (session/lock handling on the first burst), then either delay the first loads until the session is confirmed in the client, or route every load through one helper that retries a 401 once with a fresh session. |

---

## C. Office scoping

| # | Sev | Lines | What goes wrong | Proposed fix |
|---|---|---|---|---|
| **F-042** | **HIGH** | 1949–1964, 13689; 13 tables' `office_id DEFAULT '67ec3e39-…'` | In BOTH mode the wrapper stamps nothing, and thirteen tables then take the database default, a single fixed office (almost certainly Dubai). A Belgian user working in BOTH creates a client, visit, inquiry, project, order, shipment, warehouse, approval, note, invoice, cost, bank account, partner, payroll row or commitment and it is filed under Dubai. Only stock, stock movements and project materials are corrected by the `office_must_match_parent` trigger. | In BOTH mode either refuse creates with a clear message, or stamp `me.office_id` and show the office on the form. SECURITY-AUDIT 7.3 would make the database refuse it too. |
| **F-043** | **HIGH** | 3006, 11922 | `invoice_payments` has no `office_id` and is read directly, unfiltered, for the "money in" sparkline and the money in/out chart. In the Dubai view the chart includes Belgian receipts, and vice versa. | Read through `invoice_totals` or join on `invoices.office_id` (a view `invoice_payments_by_office`). |
| **F-044** | **MEDIUM** | 8209, 10132–10140, 1935–1946 | `scope_documents` has an `office_id` column but is not in `OFFICE_OWNED`, so the list shows both offices' documents and new rows are saved with `office_id = null`. | Add `scope_documents` to `OFFICE_OWNED`. |
| **F-045** | **MEDIUM** | `next_po_reference()`, 12502 | One purchase-order series and one invoice series for two companies (Belgian orders numbered in Dubai's `PO-` sequence). | Per-office counters, like quotations already have (`offices.quote_next`). Decision for Charles on the format. |
| **F-046** | **MEDIUM** | `warehouses_name_key` (schema), 4513 | Warehouse names are unique across both offices. "Add warehouse" twice before renaming fails; Dubai and Belgium cannot both have a "Main store". | Unique on `(office_id, name)`. |
| **F-047** | **LOW** | 8286–8289 | The list keeps rows with a null office "so they appear in every view", but `office_id` is NOT NULL and the wrapper already filtered. Dead branch and a misleading comment. | Remove. |
| **F-048** | **LOW** | 13678–13681, DB default | A user with no `profiles.office_id` opens on `offices[0]` (lowest `position`), while their BOTH-mode inserts default to the fixed office id. The two fallbacks need not agree. | Give every profile an office; remove the fallback. |
| **F-049** | **LOW** | 12905–12908, 12653 | Readiness and the invoice page check `settings.trn` only; a Belgian office with `tax_id` set and no Dubai TRN is told the letterhead has no tax number. | Check the office's `tax_id` (follows F-002). |

Confirmed correct: every base table in `OFFICE_OWNED` has `office_id` and every scoped view
exposes it, so the `.eq('office_id', …)` the wrapper adds is valid everywhere; child tables
are always read through a scoped parent; the catalogue, settings, offices and profiles are
correctly global.

---

## D. Forms and validation

### D1. What every input does with bad input, in general

The same facts apply to every form, so they are stated once.

| Input | Result |
|---|---|
| Empty | Text fields save `null` or `''` (the app maps `''` → `null` for optional columns). Number fields save `null` (`num()`) or `0` (`nz()`, `Number()||0`). Required fields are listed per form below. |
| Zero | Accepted everywhere except where the form checks `> 0` (costs, payroll, stock movements, received quantity, commitment amount). A zero-rate quotation line prints as blank. |
| Negative | **Accepted by almost every numeric field**: no `<input>` carries `min` except the New-order line table (5–6011–6033) and progress % (4382). Negative value, cost, quantity, rate, amount, weight, percentage and reorder level all save. Effects: negative totals, negative margins reported as "below cost", negative take-off (F-013). The database refuses only `stock_movements.quantity ≤ 0`, `qty_ordered/qty_received < 0`, `discount_pct` outside 0–<100, `discount_amount < 0`, `progress_pct` outside 0–100. |
| 999,999,999,999 | Fits `numeric(14,2)` (12 integer digits). One digit more is a "numeric field overflow" from Postgres, shown verbatim. |
| Text in a number field | Browsers block letters in `type="number"`, and the value reads as `''` (→ null/0). The two numeric values kept in text boxes are the exceptions: `offices.vat_rate` (7185) fails to save on a comma (SCHEMA-AUDIT 3.1) and the pricing settings (7356) become `NaN` silently (F-007). |
| 5,000 characters | No `maxlength` anywhere; every text column is unbounded `text`; the activity log truncates its summary at 400. Tables and the printed sheet wrap; the freight PDF wraps. Accepted. |
| Emoji, Arabic | Stored and displayed correctly. Two exceptions: the freight-request PDF writes any character outside WinAnsi as `?` (4979–4987), so Arabic or emoji in a product or section name prints as `????`; uploaded file names are reduced to `_` (4711, 10127). |
| Leading apostrophe, SQL-shaped text | Safe: every value travels as a PostgREST parameter, never as SQL. The one wrinkle is search: `ilike('name', '%'+t+'%')` treats `%` and `_` in the typed text as wildcards, and a comma or full stop in the search term is a PostgREST filter delimiter, so "Al Geemi, LLC" returns nothing and the error is discarded (7466–7472, 7545–7547). |
| Date 1900-01-01 / 2200-01-01 | Accepted by every date field. Nothing checks `valid_until ≥ quote_date`, `due_date ≥ invoice_date`, `expected_completion ≥ start_date`, `eta ≥ etd`, or that a visit is not in the future. `daysSince` and the overdue flags then produce very large numbers. |
| NaN downstream | Guarded in the editor (`num`, `nz`, `canPrice`, clamped margin %), the order modal (`typed()`), milestones, stock and shipments. Unguarded: the two text-typed numeric stores above. |

### D2. Per form

"Required" means the form refuses the save. "Silent" means the field can be blanked or made
nonsensical and the save proceeds.

| Form (lines) | Fields | Required | Silent |
|---|---|---|---|
| Login 2934–2942 | email, password | both (form submit, HTML `required` works here) | — |
| Set password 2978–2986; Your password 7247–7252 | password ×2 | ≥ 8 chars, match | Auth accepts 6 (config) |
| Inquiry 3454–3478 | client, project, location, value, scope, stage, last contact, next action | client, project name | negative value; last contact in future |
| Log a visit 3534–3574 | company or new name, date, who went, met, summary, might buy, read, promise, by when, priority | company or name, summary | `visited_by` blank → "Unknown"; new company gets `location:'Abu Dhabi'` (3512) and no contact details |
| Client 3927–3942 | name, contact, phone, email, location, TRN, notes | name | email format never checked (modal buttons are `onClick`, so `type="email"` is decorative) |
| New project 4163–4185 | from quotation, client, name, site, value, start, completion | name, client | value from quotation is F-001's figure; negative value |
| Project page 4364–4450 | details, costs, milestones, materials | progress 0–100 (4229) | name can be blanked (`''` saves); milestones over 100% flagged but allowed; negative costs; `qty_delivered > qty_required` allowed |
| Stock: movement 4606–4628 | product, warehouse, direction, quantity, project, reference | product (exact catalogue name), warehouse, quantity > 0 | issue exceeding stock or held stock (F-026); alias names rejected |
| Stock: reorder 4591–4593 | reorder level | — | negative; saved on blur with no feedback |
| Stock: warehouses 4656–4673 | name, location, certificate, number, expiry, notes | — | duplicate name → raw unique error (F-046); blank name |
| Documents 4809–4830 | type, title, expiry, file or URL | file or URL | URL not validated as a URL; expiry in the past allowed (intended) |
| Product shipping 4924–4947 | HS, UN, packing group, dangerous, DCD, ref, expiry | — | any text in HS/UN |
| Correspondence 5445–5462 | summary, channel, direction, who, when, follow up | summary | follow-up before "when" |
| New order 5883–6055 | supplier, ref, quotation, project, warehouse, expected, line table | a line with a description; a priced line needs a quantity; empty order needs a second press | negative amounts blocked by `min=0`; `discount` rounding (F-016) |
| Order page 6310–6386 | header; per line description, HS, packs, ordered, unit, list, disc %, weight | — | `qty_ordered` below `qty_received` → raw CHECK error; `discount_pct` 100 → raw CHECK error; negatives |
| Receive 6510–6520 | qty, warehouse, date, note | qty > 0 and ≤ outstanding, warehouse | — |
| New shipment 6683–6716 | reference, quotation, project, client, supplier, mode, origin, destination | reference | duplicate reference → raw error (F-035) |
| Shipment page 6836–6932 | details, costs, rate, dates, packing list | — | reference can be blanked; negatives; `eta < etd` |
| Settings values 7350–7358 | free text per key | — | F-007 |
| Offices 7166–7201 | names, address, email, tax label/number, VAT rate, prefix/suffix, bank, terms | — | VAT rate comma/percent (SCHEMA-AUDIT 3.1); blank legal name saves `''` into NOT NULL text |
| Access list 7089–7091 | role toggle | owner | — |
| Language 7415 | select | — | — |
| Scope reader 10245–10268, 10336–10361 | file/paste, per-layer product, term to remember | text to read | "Remember" fails for non-owners (SECURITY-AUDIT 3.8) |
| Quotation header 11194–11278 | client, project, location, date, valid until, status, revision, VAT, office, margin %, language | none on save (a quotation with no client and no lines saves and takes a number) | `valid_until < quote_date`; status `approved` by anyone; revision free text |
| Quotation lines 11332–11406 | description, unit, qty, sell, cost, priced/build-up | — | negative qty/rates; unit free text (the take-off only recognises m² spellings, 7659) |
| Set the price 11469–11476; section price 11315–11322 | target | numeric > 0 (guarded) | — |
| Commitments 11819–11841 | supplier, ref, title, category, date, amount, currency | supplier, title, amount > 0 | lines can never be added |
| Costs 12113–12160 | date, category, description, supplier, ref, amount, currency, rate, paid by, partner, paid on, account, project, type | description, amount > 0 | **`paid_on` defaults to today** (12050): a bill entered without clearing the field counts as paid and, if an account is chosen, reduces the bank balance |
| Payroll 12289–12308 | who, kind, period, amount, partner, account, paid on | who, amount > 0 | no currency (F-003) |
| Partners 12268–12272 | name, ownership %, capital | — | total ≠ 100% flagged but allowed; negative |
| Bank accounts 12380–12394 | name, bank, number, IBAN, opening balance, date | — | IBAN not validated; currency not editable in the UI though the column exists |
| New invoice 12528–12554 | project, milestone, client, dates, LPO, VAT | client | dates can be blanked → raw date error; due date ignores `invoice_payment_terms` (12485, unused `terms`) |
| Invoice page 12668–12734 | header, lines, payments | — | payment amount editable to any value including negative; VAT label fixed "5%" |
| New approval 13108–13136; approval page 13246–13287 | kind, subject, name, authority, status, ref, dates, fee, next action, notes | name | fee negative; `decided_on < submitted_on` |

Findings arising from the table, beyond those already numbered:

| # | Sev | Lines | What goes wrong | Proposed fix |
|---|---|---|---|---|
| **F-050** | **MEDIUM** | 12048–12050 | A new cost is "paid today" by default. Anyone who does not blank the field records an unpaid bill as paid, and the cash position drops. | Default `paid_on` to blank; offer "Paid today" as a button. |
| **F-051** | **MEDIUM** | every numeric `<input>` except 6011–6033, 4382 | No `min="0"` on money and quantity fields; negatives flow into totals and the take-off. | Add `min="0"` and refuse negatives in `save` where a negative has no meaning. |
| **F-052** | **MEDIUM** | 11068–11095 | A quotation with no client and no lines can be saved and burns a number. | Require a client (and one section) before allocating a reference; keep the local draft otherwise. |
| **F-053** | **LOW** | 3512, 3499 | New prospects are hard-coded to Abu Dhabi and visits to one named salesman. | Read the location from the form; default `visited_by` to the signed-in user's name. |
| **F-054** | **LOW** | 7466–7472, 7545–7547 | Search terms containing `%`, `_`, `,` or `.` misbehave or error silently. | Escape wildcards; use `.or()` with quoted values or a `search` RPC. |
| **F-055** | **LOW** | 4979–4987 | Non-Latin text prints as `?` on the freight-request PDF. | Transliterate or state the limitation beside the button; the quotation sheet is unaffected. |
| **F-056** | **LOW** | all modals | `type="email"` and `required` never run because buttons use `onClick`, not form submission. | Wrap modal bodies in `<form onSubmit>`; or validate in `save`. |
| **F-057** | **LOW** | 12485–12490, 2960, auth config | Unused `terms`; due date always +30; app demands 8-character passwords while the project accepts 6. | Use the setting; align `password_min_length` to 8 (SECURITY-AUDIT 7.11). |

---

## E. Dead code and duplication

| # | Sev | Lines | Finding | Proposed fix |
|---|---|---|---|---|
| **F-058** | **LOW** | 3215–3372 | `Dashboard` is defined and never rendered. Confirmed: the only references are its own `_t("Dashboard")`, two translation strings and a comment; the rail key `dashboard` renders `Operations`. Its ten queries would still run if it were ever mounted. | Delete, with the two translation strings. |
| **F-059** | **LOW** | 7537–7571, 13486–13524, 7972–7979, 8451–8455, 13639–13648 | `GlobalSearch`, `Masthead`, `printShipping`, `pdfDeref`, and the `.topbar` measuring effect are unreachable; CSS for `.topbar`, `.search-wrap`, `.results`, `.nav button`, `.masthead*`, `.print-ship` (655–672, 899–908, 1218–1275, 1465–1487, 1588–1615) is orphaned. | Delete. |
| **F-060** | **LOW** | 3529, 5878, 6502; 3542, 3641, 8294, 3735, 5539, 10306, 10310, 5974, 5998 | Classes with no stylesheet rule: `modal-back` (three modals render in the page flow instead of as an overlay), `row2`, `warnbox`, `btn ghost`, `row-click`, `clickable`, `scope-item`, `scope-qty`, `ordbox`, `ordrow`. | Use `modal-bg`, `grid2`, `flagbox`, `btn sec`, `click`; drop the rest. |
| **F-061** | **LOW** | 5612–5616, 5634–5635, 7793–7794, 10152; 5660, 7727, 10158, 10964; 6117 | `cfgNum` is defined four times, the per-unit price formula four times, and `OrderPage` defines a local `fmtMoney` that shadows the global one. | One `settingNumber(settings, key, default)` and one `packPerUnit(pack)` at module level. |
| **F-062** | **LOW** | 3148 | The catalogue tile shows a fixed "132"; production has 133 products. | Count the rows. |
| **F-063** | **LOW** | 6243, 12485, 2843, 1941–1945 | `pack_label: prod?null:null`; unused `terms`; `window.__BT_T` test hook; five view names in `OFFICE_OWNED` that are never queried and one that does not exist. | Tidy. |
| **F-064** | **MEDIUM** | 11815, `commitment_lines`; `product_transport` | Two tables can only be filled in SQL: commitment lines (the panel promises they can be typed, 11815) and product transport classification (the shipping request tells the user a product is "not yet read" and there is no screen to read it into). | Add a small line editor to Commitments and a classification editor on the product page, or remove the promises. |
| **F-065** | **HIGH** | product page 4953, home screen, `document_watch` | Charles's rule: every product must carry a supplier technical data sheet and a safety data sheet. No screen reports which products lack one. `document_watch` only watches expiry; Readiness never looks; the shipping request flags missing SDS only for the products on one cargo. Production holds 61 documents across 133 products, so most products are missing one or both, silently. | A `product_document_gaps` view (products without a `tds` / `sds` row) feeding a home-screen queue item, a catalogue badge, and a Readiness line. |

### E1. Visits and Pipeline: two funnels, one company

Two screens claim to say how a prospect is going, from different data:

| | Visits (`visit_funnel`) | Pipeline (`inquiries`) |
|---|---|---|
| Unit | the company (`clients`, joined to `field_visits`) | the opportunity (`inquiries` row) |
| Stage | **derived**: `won` if a project exists or a quotation is approved; `quoted` if any quotation exists (any status, including draft); `in play` if an open inquiry exists; else `visited` | **typed** by hand: inquiry / quoted / negotiation / won / lost |
| Value | `job_value` from projects (unused on screen) | `estimated_value` typed |
| Link between them | none: `quotations.inquiry_id`, `projects.inquiry_id` and `correspondence.inquiry_id` exist and are never written | |

What drifts (all of these are possible today):

1. A quotation is approved → Visits says **won**; the inquiry still says quoted or
   negotiation, so Pipeline and the home-screen "Pipeline value" (3132) still count it as
   open money.
2. An inquiry is marked **won** or **lost** with no quotation or project → it leaves
   `open_inquiries`, so Visits demotes the company to **visited**, and "going cold" can fire
   on a company that was just won.
3. A **draft** quotation counts as "turned into a price" on Visits and as `quoted` in the
   funnel; Pipeline knows nothing about it.
4. Two inquiries for one company with two typed values versus one quotation subtotal: three
   "values" for one prospect, none reconciled.
5. The first inquiry or quotation promotes a prospect to a client (`promote_prospect`), so
   the company disappears from the Clients "prospects" count but stays on Visits; Visits and
   Clients are consistent, Pipeline is a third list of the same people.
6. `follow_up_overdue` is suppressed the moment any quotation exists, even a draft; a
   promise made at a visit is forgotten as soon as a draft is opened.

This is a design decision for Charles, not a code fix: either Pipeline becomes the
opportunity record that Visits, Quotations and Projects link to (set `inquiry_id`; derive
the inquiry stage from quotations/projects the way Visits already does), or Pipeline is
retired and Visits plus Quotations is the funnel. Recorded as **F-066, MEDIUM,
decision required**.

---

## G. Owner-reported issues (Charles, 2026-09-10)

Charles is an **owner**, so nothing below is the non-owner numbering failure (F-022); that
one affects the other three users, whose profiles are all `full` with no office set.

These six are the priority list for Phase 5. Each was checked against the code and the
schema; item 3 was also run offline through the app's own functions against the real
Waterfront Market bill of quantities (the one document in `scope_documents`, present as
both DOCX and PDF) with the live catalogue and equivalents list.

### F-067 — Every product must carry a supplier TDS and SDS (HIGH, missing feature)

**Report.** Two documents per product, from Krypton, that nobody else holds.

**What the code does.** Product documents exist with types `tds` and `sds` (4838–4840) and
are uploaded on the product page (4953). Nothing anywhere asks "which products are
missing one": `document_watch` only watches expiry dates (and only for documents that have
one); `Readiness` (12830) never looks at documents; the catalogue badge (4007–4009) counts
documents but does not say which kinds; the shipping request flags a missing SDS only for
the products on the one cargo being shipped (7827–7828, 7948–7952), never a missing TDS.

**Measured.** Of 133 products: 16 have a TDS, 7 an SDS, **6 have both, 111 have neither**.
The 61 documents on file are mostly certificates (28) and TDS (19).

**Phase 5.** A `product_document_gaps` view (product, has_tds, has_sds); a home-screen
queue item "N products have no data sheet" opening the catalogue filtered to them; a red
"no TDS / no SDS" chip on the catalogue card and the product page; a line in the shipping
request's "Documents for the folder" for each product on the cargo missing either sheet
(today it lists SDS only); and a Readiness line while any product used on a live quotation
lacks a sheet. Charles's rule in his words goes into the product page's empty state.

### F-068 — An order created from a quotation says "created" and is empty (CRITICAL, confirmed = F-020)

**Report.** New order → pair with a quotation → edit quantities → Create → success → the
order has nothing in it. Then it needs review and approval with Chris before it goes out.

**Investigation.** The create path (5780–5876) allocates a number, inserts the header, builds
the lines from what is on screen, inserts them, and on a line failure deletes the header
and says "Nothing was ordered" beside the button. Every column it writes exists (SCHEMA-
AUDIT 4) and the CHECK constraints are satisfiable, so a success message means the lines
went in. **Production confirms it: the one purchase order has six lines** (`row_counts`).
The order page then loads its lines with `products(name,unit_label)` (6089); `unit_label`
does not exist, PostgREST refuses the whole query, the error is discarded, and the page
renders "Nothing on this order yet" with value 0. The Orders list row, which reads the
`purchase_order_totals` view instead, shows the real value; that mismatch is how to see it.
So: **the lines are there; the page cannot show them.** One-line fix plus an error check.

**Approval step.** None exists for orders. `po_status` is draft → sent → confirmed → part →
received → cancelled; any user can set any status (RLS is `true`); nothing records who
approved or when; there is no printout or PDF of the order to review, so an order cannot
even be read by Chris outside the app. Quotations have no approval step either
(SECURITY-AUDIT 3.5).

**Phase 5 (after the one-line fix).** Decision for Charles and Chris on the shape:
`approved_by`, `approved_at` on `purchase_orders`; a status `approved` between draft and
sent; the Send action blocked until approved; owner-only approval enforced by a trigger
(the same pattern as SECURITY-AUDIT 7.6); and a printable PO sheet (Krypton's own column
order, which the page already uses) so the thing being approved can be read and sent.

### F-069 — The scope reader produces a wrong quotation (CRITICAL, several causes)

**Report.** Upload an enquiry, BOQ or scope; expect it to be read fully; create draft; the
result is "completely wrong". The most important item.

**Chain audited.** `readScopeFile` (9482) → `parseScope` (9661) → `buildMatcher` (9819) /
`matchItem` (9916) → `buildDraft` (9977) → `localStorage.bt-draft-new` (8274) →
`QuotationEditor` restore (10703–10758) → auto-cost effect (10653–10674) → printed sheet.

**Run on the real document.** Both the DOCX and the PDF read cleanly: 14 items in two
bills (Fruits and Vegetable, Meat), zero unread lines, quantities and units right
(3,659 m², 588 lm, 1 LS). Matching is reasonable: MasterSeal M866 → IBTMAX B 1K,
Ucrete → BT-Crete SL, removal and steel items correctly left unpriced. **The reading is
not where it goes wrong. The draft and the editor are.** In order of damage:

| | Sev | Where | What the draft does with this bill |
|---|---|---|---|
| a | **CRITICAL** | 10653–10674, 10972–10999 | The auto-cost effect applies the section's cost **per square metre** to the priced line **whatever its unit**. Item 6, "200 mm covered skirting using Ucrete RG", is 588 **lm**; the draft costs it at AED 99.62 per metre (the floor system's per-m² figure) and sells it at AED 181 per metre: about five times the true rate for a 0.2 m strip. Item 7, the expansion joint, is 1 **LS** and would be costed as one square metre if a product were matched. Nothing checks that the priced line is measured in m² before using a per-m² cost. |
| b | **CRITICAL** | 10035–10045, 9998–10012, 11605–11609 | Internal working is written as **spec notes, and spec notes print on the client's sheet**. On this bill the client would read: "Offered against Supply and apply of waterproofing using BASF MasterSeal M866. A polyurethane waterproofing membrane under the…" (naming the competitor and quoting the equivalents note), "Site work rather than a coating we supply. Put a rate on the line above and delete this note before the quotation goes out." and "No product in our range has been set against this item yet. Either choose one in the catalogue, buy the specified material in, or take the item out." Six of the fourteen sections carry one of these. Unless every one is deleted by hand, they go to Waterfront Market. |
| c | **HIGH** | 10079–10092, 9991 | The client's own item wording is **discarded**: the priced line always says "Supply and Install" and the section title is the item text cut at the first comma, full stop or colon and at 60 characters ("Supply and apply of max 75mm screed with shutters using…"). The bill's item 3 says what the screed is, what thickness, what mesh; none of that is on the quotation. A consultant comparing the quotation to the BOQ cannot find the items. |
| d | **HIGH** | 10028–10039 | Consumption comes only from the catalogue's `coverage_max`. The bill says "Ucret HF100 RT System @ 6mm"; a 6 mm PU-cement screed is roughly 12 kg/m², the catalogue figure used is 7 kg/m². The "@ 6mm" is read as part of the name and ignored, so the material cost of the two largest sections is understated by about 40%. Same for "max 75mm screed". |
| e | **MEDIUM** | 9722–9732, 9693–9694 | Notes: the DOCX's four indented note lines and the whole "The Contractor shall execute the Works…" boilerplate are appended into **one** note, which then goes into the printed remarks (10743–10747). The PDF version reads "Note: 1 - color … 4 - 10 years warranty…" as a single note too. The remarks print a wall of text including "10 years warranty to be included" as if Build-Tech were offering it. |
| f | **MEDIUM** | 11605–11616 | Sections left "to be priced" keep their priced line with a blank rate, so the sheet prints "Supply and Install 3,659 sq.m" with an empty price and an empty total, and the subtotal silently excludes them. Nothing on the editor says "8 of 14 sections have no price". |
| g | **MEDIUM** | 9598–9600, 9666 | Not on this bill, but on the next one: item numbers like `1.1`, `2.3` or `A` never match `SCOPE_ROW` and every such row lands in "lines it could not read"; European quantities (`28.153,00`) become `NaN` and are dropped. |
| h | **LOW** | 9674–9675 | The DOCX title carries "Tender ref.no : 7089" because the two fields share a line. |
| i | **LOW** | 10276–10297, 10728 | The client name is read ("Waterfront Market LLC") but never matched to a client; the quotation opens with no client. |
| j | **LOW** | 10949–10956 | A product blurb that begins with the product's own name would be costed a second time by `sectionCost` (it did not happen on this bill; the blurbs start with "1K PU-bitumen resin…"). |

**Editor behaviour checked alongside, because Charles asked for every section:** the
restore path (F-024, F-034), the save path (F-021, F-052), the second-priced-line rule
(F-070 below), the margin box (correct), the target-price box (correct, tells the user
where it lands), the section price box (correct), the floor box (correct), VAT (correct),
the print rounding (F-018), the build-up toggle (correct but unexplained), the ⌘B bold
convention (works; the B button and ⌘B do different things, which is not said).

**Phase 5.** (a) apply a per-m² cost only to lines whose unit is m²; for lm/nr/item lines
leave the cost blank and say why. (b) never print reader commentary: put "Offered against
…" and the equivalence note in `meeting_notes` (internal, 11553), and mark the instruction
lines as internal (a new `is_internal` flag, or simply not create them). (c) put the bill's
full item text on the priced line (or as the first spec note) and keep the title short.
(d) read "@ 6mm"/"6 mm thick" and derive kg from thickness × density where the product
carries a density; otherwise flag "consumption assumed from catalogue". (e) split notes on
the DOCX's own paragraph breaks; drop legal boilerplate below the first blank line.
(f) show "N sections still need a price" in the editor header and on the Readiness panel.
(g) accept `1.1`/`A`-style numbering and comma decimals.

### F-070 — A second priced line in a section is silently turned into build-up (HIGH, decision)

Found while checking the editor for F-069. `normaliseSection` (10483–10492) runs on every
load: the first line with a quantity or rate is the priced line and **every other line with
a rate becomes build-up**, and on the next save `is_costing = true` is written. A section
Charles writes as two genuinely priced lines (say supply on one line and application on
another, or two areas) keeps its total only until it is reopened; then the second line
leaves the subtotal and the sheet, without a word. The comment (10470–10482) says this is
how every quotation is written; if that is true the rule is right, but it changes saved
money silently. Decision for Charles: keep the rule and say so on screen, or only apply
it to lines that resolve to a catalogue product.

### F-071 — The shipping request cannot get into an order (HIGH, = F-020 plus a missing path)

**Report.** Quotation ready → view PDF → generate the shipping request → it should go to
Orders, but Orders will not save.

**Investigation.** The shipping request lives **only on the quotation**: `ShippingRequest`
is a panel inside the editor (11185) that computes the cargo from the quotation and offers
two downloads (PDF, ZIP). It is not stored anywhere, not attached to anything, and no
screen accepts it. `NewOrderModal` recomputes the same cargo from the same quotation
(5636), so the order's lines already are the shipping request's quantities; but the
document itself never reaches the order, and `po_documents` accepts only what someone
uploads by hand. The schema's `purchase_orders.shipment_id` link is never written.
"Orders will not save" is F-020: the order opens empty, so there is nothing to save, and
the header save shows "Saved." with no visible effect. (`NewOrderModal` can also refuse
with a message beside the button when the take-off resolves nothing: 5785–5802.)

**Phase 5.** Fix F-020; then give the order an "Attach the freight request" action that
builds the same PDF (`freightRequestPdf`) and stores it in `po-docs` as `doc_type
'shipping'`; show it on the order page; and when a shipment is created from the order,
set `purchase_orders.shipment_id`.

### F-072 — No way to create a product from the quotation editor (HIGH, missing feature)

**Report.** The picker only offers the existing catalogue; he needs to create a new product
on the spot with packs, quantities, consumption and price, not a free-text line.

**What the picker does today.** The description box on a priced or spec line is a plain
text input with a `datalist` (11347, 11190) holding every catalogue name, every alias and
every past wording (10698–10701): a flat list of several hundred strings with no search
beyond the browser's prefix match. Free text is accepted; if it does not resolve through
`findProduct` (10949) no cost is found and the line is priced by hand. There is no "add
product" anywhere: the Catalogue has no New-product button, the product page cannot create,
and `products` is only ever updated, never inserted, by the app (code_usage). New products
reach the system through SQL only. RLS already allows any signed-in user to insert
products and packs.

**Phase 5.** A `ProductModal` reachable from the Catalogue ("New product") and from a line
("Not in the catalogue? Add it"): name, category, subcategory, description, application,
colours, consumption text plus `coverage_min/max/unit`, HS/UN/packing group/dangerous flag,
aliases, and a pack table (label, unit, `pack_qty`, `eur_total` or `eur_per_unit`, POA);
writes `products`, `product_packs`, `product_aliases`; returns the product to the line,
which then costs itself (needs F-008 so the id is kept). Decision for Charles: whether
pricing fields are owner-only.

### F-073 — Quotations take too many steps (see section H)

Charles's sixth point is not a bug. It is written up in section H, ranked.

---

## H. Friction

Not bugs. Places where the app makes a person do more work, or know more, than necessary.
The printed sheet, the PDF, the layout, the wording and `printOnePage` are **out of scope**
and unchanged by anything here.

Score = minutes saved per use × uses per month, estimated for Charles's current volume
(several quotations a week, an order and a shipment a month, costs daily).

### H1. The quotation editor: new quotation → sendable PDF

Typical job: Dubai, existing client, three sections, one product each, at the standard
margin. Counted from the code as it stands:

| Step | Actions | Typed | Knowledge required |
|---|---|---|---|
| Quotations → New quotation | 1 | | |
| Client, project name | 1 + type | 2 | location fills from the client already (11156–11160) |
| Date, valid until, status, VAT, office, margin, language | 0 | 0 | all default correctly |
| Per section: Add section, title, quantity on the priced line | 3 | 2 | that the first line is the priced one; that the unit must be spelt `sq.m`/`m²` for costing and take-off |
| Per section: Add spec note, type the product | 2 | 1 | the exact catalogue spelling; the `Name : Approx. 2,50 kg/m²` convention; that bold matters for the take-off (⌘B vs the B button) |
| Per section: wait for auto-cost, or press "Cost it from the specification" | 0–1 | | that cost and sell fill themselves, and what "build-up" means if a second rate appears |
| Save | 1 | | that PDF is disabled until saved |
| PDF, then "Background graphics" in the dialog, then save | 3 | | the print-dialog setting (11429–11430) |
| **Total, three sections** | **≈ 22** | **≈ 11** | eight conventions |

| # | Score | Friction | Proposed change (one sentence) |
|---|---|---|---|
| H-01 | 45 | Typing the product name plus the `: Approx. X kg/m²` convention, per section, from memory of the catalogue spelling | An "Add product" picker on the section (search box over name and alias) that inserts the bold spec line with the catalogue consumption already written, ready to overtype. |
| H-02 | 30 | The area is typed once per section although the three sections usually share it | Default a new section's quantity and unit to the previous section's, editable. |
| H-03 | 24 | Save, then PDF, then the print dialog's Background graphics box | A single "Save and print" action; add `print-color-adjust: exact` to the sheet's print CSS so the blue and gold blocks print without the dialog setting (a CSS property, not a change to the template). |
| H-04 | 20 | "Cost it from the specification" sits beside costs that already filled themselves; two paths to one result | Remove the button; keep auto-cost; show "costed from IBTMAX B 1K at 1,5 kg/m²" under the line as it already does. |
| H-05 | 18 | Margin versus mark-up switch, priced versus build-up toggle, floor box, spread versus discount: four concepts on every quotation | Hide mark-up, the floor box and the priced/build-up toggle behind a "Show working" switch, off by default; keep the target-price box. |
| H-06 | 16 | The restored-draft banner appears on every reopen (F-024) and has to be read and dismissed | Fix F-024; show the banner only when there really are unsaved edits. |
| H-07 | 15 | A client not yet in the list means leaving the quotation, adding the client, coming back, and the draft banner | "New client" inside the client dropdown, opening `ClientModal` and selecting the result. |
| H-08 | 12 | The status must be changed to "sent" by hand after the PDF goes out, and to "approved" later | Offer "Mark as sent" when the PDF is printed; make approval an explicit action (ties to the approval decision in F-068). |
| H-09 | 10 | Section titles typed from scratch every time | Suggest the title from the product's application ("Roof waterproofing") and remember titles used before. |
| H-10 | 10 | A revision means editing the "Revision" text box and knowing the number stays the same | A "New revision" button that copies the quotation, sets Rev B, and keeps the original untouched. |
| H-11 | 8 | The datalist mixes product names, aliases and every past wording into one list of hundreds | Replace with the H-01 picker; keep past wordings as a second tab. |
| H-12 | 6 | The unit must be spelt `sq.m` or `m²`; `sqm`, `m2`, `SQM` behave differently in costing and take-off | Normalise units on input to one spelling. |
| H-13 | 6 | The spec-note convention `Product : consumption` and the bold rule are documented only in code comments | One line of placeholder text in the spec note box: "Product name : Approx. 2,50 kg/m² — bold the name". |
| H-14 | 5 | After creating a draft from a scope, nothing says how many sections still need a price (F-069f) | A count in the page head: "8 of 14 sections still need a price". |
| H-15 | 4 | The shipping request is a toggle inside the editor that is greyed until the quotation is saved, with no hint why | Enable it always and save first automatically. |

### H2. Other modules, briefly

| # | Score | Module | Friction | Proposed change |
|---|---|---|---|---|
| H-16 | 40 | Orders | There is no PO document: an order cannot be printed, saved as PDF or emailed, so it is retyped into an email to Krypton | A PO sheet in Krypton's column order (the page already has it) with Save as PDF, like the freight request. |
| H-17 | 30 | Catalogue | No way to add or edit a product except in SQL (F-072) | The product modal in F-072. |
| H-18 | 25 | Costs | Fourteen fields for one bill; "Who paid it" (free text) and "Counts towards which partner" (select) ask the same question twice; paid-on defaults to today (F-050) | Six fields by default (date, what, amount, currency, paid from, project) with the rest behind "More"; one "paid by" control that is either a partner or a name; paid-on blank with a "Paid today" button. |
| H-19 | 20 | Shipments | The landed cost is shown with "copy this into the project's materials cost" (6914); the user retypes a number the system holds | When a shipment is linked to a project, offer "Use as the project's materials cost" in one click, or read it live through `project_actuals` (already does for actuals). |
| H-20 | 18 | Stock | Product typed by exact name into a text box; aliases are refused (4487); the reorder level saves on blur with no confirmation | A product select; "Saved" beside the reorder box. |
| H-21 | 15 | Orders | Receiving is one line at a time with a modal per line | "Receive everything outstanding" on the order, then adjust. |
| H-22 | 15 | Projects | Milestones typed one by one; percentage and amount both editable | "Split 30/60/10" (or the client's terms) in one click; amounts follow the percentage. |
| H-23 | 12 | Home / BOTH mode | In BOTH the office switch silently files new records under Dubai (F-042) and totals mix currencies (F-005) | Ask for the office on create when BOTH is selected; show two totals. |
| H-24 | 12 | Settings | VAT and discounts are entered as fractions (`0.05`, `0.70`) in free-text boxes; a comma breaks them (F-007, SCHEMA-AUDIT 3.1) | Percent inputs with validation; show "5%". |
| H-25 | 10 | Visits | Ten fields per visit; who went is a text box with one hard-coded name (3499) | Default who-went to the signed-in user; collapse the three free-text paragraphs into one until needed. |
| H-26 | 10 | Invoices | Only one line is created from the milestone; VAT shows a fixed "5%" label; Belgian invoices impossible (F-002) | Fix F-002; pre-fill lines from the milestone's project sections. |
| H-27 | 8 | Clients / Visits / Pipeline | Three lists of the same companies with three different stages (E1) | One funnel; decision F-066. |
| H-28 | 8 | Everywhere | Every delete is either a two-press red button or a browser `confirm()`; the styles differ per screen | One pattern. |
| H-29 | 6 | Phone | Three modals render inline instead of as overlays (F-060); tables scroll sideways | Fix F-060; card layout for the main tables on narrow screens. |
| H-30 | 6 | Approvals | Six date fields and a free-text authority per approval | Defaults per kind (already done for authority); hide dates until the status needs them. |
| H-31 | 5 | Palette | ⌘K is the fastest route to anything and nothing on a phone advertises it beyond a search box | A "Go to…" button on the phone bar. |
| H-32 | 5 | Commitments | Promises lines can be typed and they cannot (F-064) | Remove the promise or add the editor. |
| H-33 | 4 | Documents | Type, title, expiry and file are four controls; the type defaults to the first in the list | Infer the type from the file name (TDS/SDS/MSDS/CE) and default the title to the file name (already done). |
| H-34 | 3 | Access list | Adding a person means the Supabase dashboard | An "Invite" button calling the admin invite through an RPC or edge function (decision: keep out of the app, as the comment argues, 7043–7047). |

---

## I. Severity index

For Phase 5, in the order to work through them. Charles's items (section G) come first
within each band. Items marked *DB* are migrations, not
`index.html` changes; items marked *decision* wait for Charles.

**CRITICAL**
F-068 / F-020 (order page shows no lines; Charles's item 2) · F-069 a–b (scope draft:
per-m² cost on non-m² lines; internal notes printed to the client; Charles's item 3) ·
F-001 (view includes build-up, *DB*) · F-021 (quotation save can lose all sections) ·
F-022 (numbering fails for non-owners, *DB*) · F-023 (open sign-up, *config*) ·
F-002 (invoices are Dubai-only, *decision on scope*) · F-003 (Finance is AED-only, *decision*)

**HIGH**
F-067 / F-065 (no missing-TDS/SDS report; Charles's item 1) · F-069 c–d (client's wording
lost; thickness ignored) · F-070 (second priced line silently becomes build-up, *decision*) ·
F-071 (shipping request has no path into an order; Charles's item 4) · F-072 (no way to
create a product; Charles's item 5) · F-004 (AED figures labelled EUR) · F-005 (BOTH sums
mix currencies) · F-006 (month keys one month early) · F-007 (settings text → NaN) ·
F-008 (`product_id` never saved on lines) · F-024 (draft restored over saved copy) ·
F-025 (add-row failure blanks the screen) · F-026 (held stock can be issued) ·
F-027 (activity-log churn) · F-042 (BOTH-mode inserts land in one office) ·
F-043 (payments unscoped)

**MEDIUM**
F-069 e–g · F-068 approval step (*decision*) · F-009 · F-010 · F-011 · F-012 (*decision*) ·
F-013 · F-028 · F-029 · F-030 · F-031 · F-032 · F-033 · F-034 · F-035 · F-036 · F-044 ·
F-045 (*decision*) · F-046 · F-050 · F-051 · F-052 · F-064 · F-066 (*decision*) ·
F-074 (first-burst 401 after sign-in, observed; Phase 4)

**Friction (Charles's item 6, F-073)** — section H, ranked by score; Charles picks.

**LOW**
F-014 · F-015 · F-016 · F-017 · F-018 · F-019 · F-037 · F-038 · F-039 · F-040 · F-041 ·
F-047 · F-048 · F-049 · F-053 · F-054 · F-055 · F-056 · F-057 · F-058 · F-059 · F-060 ·
F-061 · F-062 · F-063

Also carried from SECURITY-AUDIT for Phase 5 sequencing: 7.1 (views to `security_invoker`),
7.9 (equivalents policy), 7.11–7.12 (auth settings, role check), and the *decision* items
7.3, 7.6, 7.7, 7.8, 7.10.

## J. Phase 5 outcome (11 September 2026)

Every CRITICAL and HIGH finding that is not a *decision* item was fixed, one commit each,
each verified in the browser against the test project (`tests/checks.js`) and, for the
scope reader, against the hand-checked fixture in `tests/fixtures/`. The migrations were
applied to the test project only; `docs/AUDIT-REPORT.md` §8 says how they go live.

| Finding | Where it was fixed |
|---|---|
| F-001, F-022, F-023, F-026 (database side); SECURITY-AUDIT 7.1, 7.2, 7.4, 7.5, 7.9, 7.11, 7.12 | migrations 0059–0064 (`fix: F-001 F-022 F-023 F-026, SECURITY-AUDIT …`) |
| F-074 (first-burst 401), invite/recovery gate lost on refresh | Phase 4 commit (`retryOnce`, `bt-needs-password`) |
| F-020 / F-068 (order page shows no lines) | `fix: F-020 — order page shows its lines` |
| F-006, F-033 (month keys, today) | `fix: F-006 F-033 — month keys and today() use the local date` |
| F-007 (settings text → NaN) | `fix: F-007 — settings and VAT rate read and validated as numbers` |
| F-004 (AED figures labelled EUR) | `fix: F-004 — dirham figures say AED whichever office is on screen` |
| F-005 (BOTH sums mix currencies) | `fix: F-005 — the company view adds the offices up at the settings rate` |
| F-008 (product_id never saved) | `fix: F-008 — quotation lines carry their product` |
| F-025 (add-row failure blanks the screen) | `fix: F-025 — a refused add-a-row says so …` |
| F-026 (held stock issued, screen side) | `fix: F-026 — held stock and more than is on hand cannot be issued …` |
| F-042 (BOTH-mode inserts land in one office) | `fix: F-042 — a record made in the company view is filed under the person's own office` |
| F-043 (payments unscoped) | `fix: F-043 — receipts are read through their invoice's office` |
| F-021, F-024, F-027 (save can lose sections; stale draft; log churn) | migration 0065, `fix: F-021 F-024 F-027 — quotation save is one transaction, drafts are real drafts` |
| F-002 (invoices Dubai-only) | migration 0066, `fix: F-002 — an invoice is numbered, taxed, headed and worded by its office` |
| F-068 approval step, printable order (Charles's item 2) | migration 0067, `feat: Phase 5 B` |
| F-069 a–j (scope reader; Charles's item 3) | `fix: Phase 5 C, F-069 a–j` and `tests/scope_fixture.js` |
| F-071 (shipping request → order; Charles's item 4) | `feat: Phase 5 D` |
| F-072 (create a product; Charles's item 5) | `feat: Phase 5 E` |
| F-065 / F-067 (missing TDS/SDS; Charles's item 1) | `feat: Phase 5 F` |
| F-073 friction, top three of section H (Charles's item 6): H-01 pick a product and have its line written, H-02 a new section starts from the previous area, H-03 save and print in one step with the colour blocks printing on their own; plus H-13's teaching placeholder | `feat: Phase 5 G` (printed sheet byte-for-byte unchanged) |

**Decided by Charles on 11 September 2026 and applied** (migrations 0068–0074, applied to
the test project only; `docs/AUDIT-REPORT.md` §8 says how they go live):

| Decision | What was applied |
|---|---|
| SECURITY-AUDIT 7.3, 7.10: office separation in the database | 0068: every office table and every child table is readable and writable only by that office; owners see both. Storage follows: a document is visible only to its record's office. A profile with no office counts as Dubai until an owner moves it (Settings, "Who can get in", new Office column). Non-owners no longer see the office switch. |
| 7.7: money that only owners should see | 0069: payroll, partners and bank_accounts are owners-only; the Finance tabs for them are hidden from non-owners, and the bank figures on the home screen read "the owners' to see". |
| 7.6: quotation approval by owners only | 0070: a quotation is marked approved by an owner; the status field does not offer it to anyone else. Approval of orders and quotations is for every owner: Charles, Chris once given owner rights, and anyone else made an owner. |
| 7.8: non-owners edit only their own details | 0071: role, office and email can be changed only by an owner. |
| F-045: one PO series for two companies | 0072: per-office order numbering; Dubai continues, Bruges starts PO-BE-0001. |
| F-003: money out kept in dirhams only | 0073: a cost or salary is taken off a bank account in the account's own currency, the partner ledger and project actuals are in their office's money, and figures are converted only where they cross a currency line, at the rate in Settings. Labels say the currency. |
| F-012: two suggested sell prices | 0074: the catalogue's "Sell" is the editor's figure (material at margin); the installation rate is shown separately. |
| F-070: a second priced line silently becomes build-up | The rule stays, as Charles's quotations are written, and the section now says which line it moved and how to charge it. |

**Left as they are, being structural choices rather than faults:** F-066 (the two sales
funnels) and the second ledger next to Zoho, to revisit when Charles wants.

MEDIUM and LOW findings outside the lists above remain open, except those that fell to the
fixes listed (F-033 with F-006; F-069 e–g with C).

