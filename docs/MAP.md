# Build-Tech Pro — Map of `index.html`

Build `2026.09.10-e` (the `BUILD_VERSION` constant at line 6967). 13,803 lines, read in full.
Every line number below refers to `index.html` as committed in the baseline commit.

**How this was produced.** The whole file was read start to finish, then every claim about
usage, dead code and table names was checked with `grep`. Nothing here was verified against
the live database: where the map says "view" or "column" it is what the frontend assumes, and
Phase 1 is where that gets checked. Where I was unsure I say so.

**One caveat about the baseline.** This local copy contains a three-line unfinished function
at lines 4743–4745 (`const add=async(d)=>{ if(!confirm('Add "'+d)) }`). It is a syntax error
that stops the entire application script from parsing. The owner has confirmed it is a
practice edit made locally and is not in the deployed file. It is left untouched in this
phase, but the baseline commit is therefore three lines different from production, and the
Phase 7 diff will need to allow for that.

---

## 0. Where things are in the file

| Lines | What |
|---|---|
| 1–18 | Head, PWA meta, inline favicon |
| 19–1847 | All CSS. Four themes: base/light, `dark`, `brand` (default), `light`. Print rules at 899–908, 1740–1777 |
| 1852–1858 | Pre-React: stamp `data-theme` from `localStorage.bt-theme2` before first paint |
| 1868–1877 | Pre-React: capture `type` / `error_description` from the URL hash into `window.__BT_LINK` before the Supabase client wipes it |
| 1892–1908 | Pre-React: hold `beforeinstallprompt` on `window.__BT_INSTALL`; register `sw.js` on http(s) only |
| 1910–1914 | Vendored React, ReactDOM, htm, supabase-js; then `config.js` |
| 1916–1919 | React hook imports, `html` (htm bound to createElement), `Frag`, `sbRaw = supabase.createClient(URL, KEY)` with **no options** |
| 1935–1964 | Office scoping: `OFFICE_OWNED` set and the `sb` wrapper (see section 5) |
| 1971–1984 | Small helpers: `inDate`, `expired`, `sumByUnit`, `addDays` |
| 1994–2843 | `UI` translation tables (nl, fr), `UI_LANG`, `_t` |
| 2845–2876 | `plural`, `listOut`, money formatting, stage constants, `today`, `daysSince` |
| 2878–13799 | Components and pure helpers, inventoried below |
| 13801 | `ReactDOM.createRoot(...).render(html\`<${App}/>\`)` |

Globals mutated at render time by `App` (13686–13692): `ACTIVE_CUR`, `OFFICE_ID`, `UI_LANG`.

---

## 1. Component inventory

Numbered in file order. "Touches" lists Supabase tables, views, RPCs, storage buckets and auth
calls made directly by that component. Pure helper blocks that touch nothing are listed too so
the line ranges are contiguous. Child components rendered are named in the purpose column.

| # | Name | Lines | Purpose (one sentence) | Touches |
|---|---|---|---|---|
| 1 | `Logo` | 2878–2895 | Logo mark with SVG fallback, used on the sign-in screens. | — |
| 2 | `Login` | 2898–2947 | Email and password sign-in, plus "send me a link" password reset. | auth `signInWithPassword`, `resetPasswordForEmail` |
| 3 | `SetPassword` | 2954–2988 | Forces a password to be set after an invite or recovery link. | auth `updateUser` |
| 4 | `Operations` | 2998–3213 | The home screen: three vitals, a prioritised "what needs you" queue, module tiles with live counts, latest activity; renders `Readiness`. | `inquiries`(+`clients`), `projects`, `project_totals`, `invoice_totals`, `invoice_payments`, `cash_position`, `expenses`, `approval_watch`, `stock_position`, `shipments`, `open_order_lines`, `purchase_order_totals`, `commitments`, `document_watch`, `visit_funnel`, `requirement_watch`, `activity_log` |
| 5 | `Dashboard` | 3215–3372 | **Dead.** The old home page of cards and a stage chart; never rendered (see section 4). | `inquiries`, `project_totals`, `projects`, `stock_position`, `shipments`, `cash_position`, `invoice_totals`, `approval_watch`, `document_watch`, `open_order_lines` |
| 6 | `Pipeline` | 3378–3424 | List of inquiries filtered by stage, opens `InquiryModal`. | `inquiries`(+`clients`), `clients` |
| 7 | `InquiryModal` | 3426–3487 | Create, edit or delete one inquiry. | `inquiries` insert/update/delete |
| 8 | `LogVisitModal` | 3497–3584 | Log a market visit, creating a prospect client on the fly if needed. | `clients` insert (kind `prospect`), `field_visits` insert |
| 9 | `Visits` | 3586–3752 | Market-visit funnel and per-company history; stage is derived server-side. | `visit_funnel`, `visit_log` |
| 10 | `Clients` | 3754–3908 | Client list and detail page with inquiries, quotations, projects, correspondence, and a two-step delete guarded by dependency counts. | `clients`(+`inquiries`) select/delete/count, `quotations`, `projects`; head-counts on `inquiries`, `quotations`, `projects`, `invoices`, `correspondence`, `field_visits` |
| 11 | `ClientModal` | 3910–3949 | Create or edit a client. | `clients` insert/update |
| 12 | `Catalogue` | 3952–4031 | Product grid with search, category filter and optional cost column; opens `ProductPage`. | `products`(+`product_packs`,`product_aliases`,`product_documents`), `catalogue_pricing` |
| 13 | `Projects` | 4038–4114 | Project list, three summary cards and a margin-by-project chart; opens `ProjectPage` / `NewProjectModal`. | `projects`(+`clients`), `clients`, `quotations`, `project_totals` |
| 14 | `NewProjectModal` | 4116–4192 | Create a project, optionally seeded from a quotation's totals and priced lines. | `quotation_totals`, `projects` insert, `quotation_sections`(+`quotation_lines`), `project_materials` insert |
| 15 | `ProjectPage` | 4194–4452 | Edit a project: details, cost inputs, quoted-vs-actual, payment milestones, materials. | `projects`(+`clients`,`quotations`) select/update, `project_materials` select/insert/update/delete, `payment_milestones` select/insert/update/delete, `products`, `project_actuals`, `expenses` |
| 16 | `Stock` | 4455–4684 | Stock position, held and short lists, record a movement, warehouses with Civil Defence certificate fields. | `stock_position`, `stock_detail`, `warehouses` select/insert/update, `products`, `stock_movements` select/insert(+`products`,`warehouses`,`projects`), `projects`, `stock` select/update (`reorder_level`) |
| 17 | `DocumentsPanel` | 4690–4835 | Shared upload/link/rename/remove panel; table and bucket come in as props. Contains the practice stub at 4743–4745. | `table` prop ∈ {`product_documents`, `po_documents`, `shipment_documents`, `commitment_documents`, `approval_documents`} select/insert/update/delete; `bucket` prop ∈ {`product-docs`, `po-docs`, `shipment-docs`, `commitment-docs`, `approval-docs`} upload/createSignedUrl/remove |
| 18 | `ProductPage` | 4845–4955 | One product: description, packs and prices, shipping/customs/DCD fields, documents. | `products`(+`product_packs`,`product_aliases`) select/update; `DocumentsPanel` on `product_documents`/`product-docs` |
| 19 | `miniPdf`, `miniZip`, `saveBlob`, `freightRequestPdf` | 4969–5371 | Hand-rolled PDF writer, store-only ZIP writer, download helper, and the freight request document built from a quotation's cargo. | — |
| 20 | `CorrespondencePanel` | 5380–5467 | "What was said" log keyed to a client, quotation or purchase order. | `correspondence` select/insert/delete |
| 21 | `Orders` | 5483–5558 | Purchase order list with on-order value and lateness; opens `OrderPage` / `NewOrderModal`. | `purchase_orders`(+`quotations`,`projects`), `purchase_order_totals`, `quotations`, `projects`, `warehouses` (`is_active`) |
| 22 | `MIGRATION_OF`, `dbWhy` | 5563–5576 | Translate a "column does not exist" error into "run migration 0056/0057/0058". | — |
| 23 | `NewOrderModal` | 5580–6073 | Build a PO, optionally from a quotation's take-off, with a fully editable Krypton-style line table. | `products`(+packs,aliases), `settings`, `quotation_sections`(+`quotation_lines`), RPC `next_po_reference`, `purchase_orders` insert/delete (rollback), `purchase_order_lines` insert |
| 24 | `OrderPage` | 6075–6476 | Edit a PO and its lines, read a supplier proforma into lines, receive goods, delete a draft. | `purchase_orders` select/update/delete, `purchase_order_lines`(+`products`) select/insert/update/delete, `products`; `DocumentsPanel` on `po_documents`/`po-docs`; `CorrespondencePanel` (po_id); `ReceiveModal` |
| 25 | `ReceiveModal` | 6481–6530 | Receive a quantity against a PO line into a warehouse. | RPC `receive_po_line` |
| 26 | `Shipments` | 6551–6625 | Shipment list and four summary cards; opens `ShipmentPage` / `NewShipmentModal`. | `shipments`(+`clients`,`quotations`,`projects`), `shipment_totals`, `clients`, `quotations`, `projects` |
| 27 | `NewShipmentModal` | 6627–6722 | Create a shipment, reference `SHP-YYYY-NN` computed client-side, optionally copying quotation lines as the packing list. | `shipments` insert, `quotation_sections`(+`quotation_lines`), `products`, `shipment_lines` insert |
| 28 | `ShipmentPage` | 6724–6963 | Edit a shipment: details, landed-cost inputs, packing list, product paperwork on file, shipment documents. | `shipments` select/update, `shipment_lines` select/insert/update/delete, `products`, `product_documents`(+`products`), bucket `product-docs` signed URL; `DocumentsPanel` on `shipment_documents`/`shipment-docs` |
| 29 | `ActivityAndBackup` | 6972–7041 | Last 40 activity-log rows and a "download everything" JSON backup. | `activity_log`; backup selects `*` from the 31 tables listed at 6983–6989 |
| 30 | `AccessList` | 7048–7100 | Who can sign in, with an owner-only toggle between `owner` and `full`. | `profiles` select/update(`role`) |
| 31 | `SETTING_GROUPS`, `SETTING_GROUP_OF` | 7111–7126 | Which settings key sits under which Settings tab. | — |
| 32 | `OfficesPanel` | 7131–7211 | Per-office letterhead, VAT rate, numbering prefix/suffix, bank details, terms. Owner-only edits. | `offices` update |
| 33 | `PasswordBox` | 7227–7257 | Change your own password. | auth `updateUser` |
| 34 | `InstallBox` | 7259–7309 | PWA install button or per-browser instructions. | — |
| 35 | `Settings` | 7311–7424 | Tabbed settings page; renders `OfficesPanel`, `AccessList`, `ActivityAndBackup`, `PasswordBox`, `InstallBox`. | `settings` update, `profiles` update(`language`) |
| 36 | `Palette` | 7440–7535 | ⌘K command palette: places, actions, and live record search. | `clients`, `quotations`, `products`, `purchase_orders`, `projects` (ilike, limited) |
| 37 | `GlobalSearch` | 7537–7571 | **Dead.** The old topbar search box; never rendered. | `clients`, `inquiries`(+`clients`), `products` |
| 38 | `normName`, `numOf`, `parseConsumption`, `rollM2`, `bestRoll`, `cargoFromQuotation` | 7587–7789 | Turn a quotation's spec lines into a cargo list: kg, packs, rolls, pallets, volume, and per-section material cost. | — (pure; takes products and a settings reader) |
| 39 | `ShippingRequest` | 7792–7969 | On-screen freight request with DG classification, plus "Save as PDF" and "Download the whole pack" (ZIP with SDS files). | `product_documents`(+`products`) where `doc_type='sds'`, bucket `product-docs` signed URL |
| 40 | `printShipping` | 7972–7979 | **Dead.** Old print-only-the-shipping-request routine. | — |
| 41 | Quotation helpers | 7982–8178 | `QSTATUS`, `num`, `nz`, `e2Msg`, `fmtN`, `eu`, `roundAed`, `round2`, `money`, `SHEET` (client-sheet words in en/nl/fr), `LANGS`, `OFFICE_TAG`/`officeTag`, `sheetWords`, `printOnePage` (8051–8093), `BOLD_MARK`/`richText`/`plainText`/`toggleBoldSelection`/`boldKey`/`boldPrefix`, `fmtDate`. | — |
| 42 | `Quotations` | 8180–8356 | Quotation list for the current office, "Read a scope" entry point, list of stored scope documents with guarded delete; opens `QuotationEditor` / `ScopeReader`. | `quotations`(+`clients`), `clients`, `quotation_totals`, `scope_documents` select/delete, bucket `scope-docs` signed URL/remove; for the reader: `products`(+aliases,packs), `spec_equivalents`, `quotation_lines` |
| 43 | File readers | 8383–9522 | PDF text extraction (objects, object streams, fonts, content walk, tagged-table and geometric-table reconstruction), ZIP/docx/xlsx readers, `normaliseColumns`, `euNum`, `parseProforma`, `readScopeFile`. | — |
| 44 | Scope parser and matcher | 9545–10092 | `parseScope`, `splitRunOn`, `readLayers`, `buildMatcher`, `matchItem`, `buildDraft`, `sectionTitle` etc. | — |
| 45 | `ScopeReader` | 10098–10383 | Upload or paste a bill of quantities, review matches, teach an equivalent, create a draft into localStorage. | bucket `scope-docs` upload, `scope_documents` insert/update, `spec_equivalents` insert |
| 46 | Pricing helpers | 10400–10523 | `scaleRatesTo` (hit a target total with two-decimal rates), `normaliseSection`, `buildUpCost`, `sellTotal`, `sectionsAtPrice`. | — |
| 47 | `QuotationEditor` | 10525–11664 | The quotation editor and the printed client sheet: sections, priced/build-up/spec lines, auto-costing from the catalogue, margin/mark-up, target price, floor, totals, VAT, localStorage draft. Renders `ShippingRequest`. | `products`(+aliases,packs), `product_transport_summary`, `product_wordings` select/insert/update, `quotations` select/insert/update/delete, `quotation_sections` select/delete/insert, `quotation_lines` insert, RPC `next_quotation_reference` |
| 48 | Finance constants, `inWords` | 11667–11698 | Categories, invoice statuses, amount-in-words (dirhams). | — |
| 49 | `Finance` | 11700–11717 | Sub-router for the six finance views. | — |
| 50 | `Commitments` | 11730–11911 | Supplier quotations not yet incurred ("Coming up"). | `commitment_totals`, `commitment_lines`, `commitment_documents`, `commitments` insert/update; `DocumentsPanel` on `commitment_documents`/`commitment-docs` |
| 51 | `FinanceOverview` | 11913–12040 | Bank, owed, still-owe, spent cards; partner ledger; money in/out chart; spend by category. | `cash_position`, `invoice_totals`, `expenses`, `partner_ledger`, `payroll`, `invoice_payments` |
| 52 | `Costs` | 12043–12198 | Add and list expenses, mark paid, delete. | `expenses`(+`partners`,`projects`) select/insert/update/delete, `partners`, `bank_accounts`, `projects` |
| 53 | `People` | 12201–12331 | Partners (ownership %, capital) and payroll (salary/drawing). | `partners` select/insert/update/delete, `payroll`(+`partners`) select/insert/delete, `bank_accounts`, `partner_ledger` |
| 54 | `Banks` | 12334–12412 | Bank accounts with opening balance and computed position. | `bank_accounts` select/insert/update/delete, `cash_position` |
| 55 | `Invoices` | 12415–12477 | Invoice list and cards; opens `InvoicePage` / `NewInvoiceModal`. | `invoices`(+`clients`,`projects`), `invoice_totals`, `clients`, `projects` |
| 56 | `NewInvoiceModal` | 12479–12562 | Create an invoice, optionally from a project milestone. | `payment_milestones` select/update, RPC `next_invoice_reference`, `invoices` insert, `invoice_lines` insert |
| 57 | `InvoicePage` | 12564–12826 | Edit an invoice, its lines and payments; printed TAX INVOICE sheet. | `invoices`(+`clients`,`projects`) select/update/delete, `invoice_lines` select/insert/update/delete, `invoice_payments` select/insert/update/delete, `bank_accounts`, `payment_milestones` update(`paid_on`) |
| 58 | `Readiness` | 12830–12960 | "Before this can be used properly": Civil Defence blocks, missing TRN/bank/terms/logo, too few users, no bank, no stock, approvals to chase, shipments without paperwork. | `profiles`, `bank_accounts`, `stock`, `approval_watch`, `shipments`, `stock_detail` (`blocked`), `approvals` (`kind='warehouse_storage'`), `shipment_documents` |
| 59 | `Approvals` | 12982–13073 | Approvals and certificates list with expiry and frozen-stock cards; opens `ApprovalPage` / `NewApprovalModal`. | `approval_watch`, `products`, `warehouses`, `clients`, `stock_detail` |
| 60 | `NewApprovalModal` | 13075–13143 | Create an approval of a given kind. | `approvals` insert |
| 61 | `ApprovalPage` | 13145–13293 | Edit one approval, tick off what the authority asked for, see the stock it holds up, documents. | `approval_watch` (single), `approval_requirements` select/update, `stock_detail`, `approvals` update/delete; `DocumentsPanel` on `approval_documents`/`approval-docs` |
| 62 | Charts | 13299–13467 | `useWidth`, `short`, `niceTicks`, `hbar`, `vbar`, `Tip`, `BarsH`, `ColumnsGrouped`, `BarsDiverging`, `Legend`. Inline SVG, no library. | — |
| 63 | `BarClocks` | 13473–13484 | Dubai and Brussels clocks in the command bar. | — |
| 64 | `Masthead` | 13486–13524 | **Dead.** Old utility strip with clocks and an alert count; never rendered. | `approval_watch`, `stock_detail` |
| 65 | `App` | 13527–13799 | Session gate, password gate, office/theme/language state, rail, command bar, tab router, rail badge counts. | auth `getSession`/`onAuthStateChange`/`signOut`; `invoice_totals`, `approval_watch`, `stock_position`, `open_order_lines`, `document_watch` (badges); `settings`; `offices`; `profiles` (own row) |

---

## 2. Every Supabase table, view, RPC and bucket referenced

"Kind" is what the code implies. The `OFFICE_OWNED` comment at 1940 says the names in the
second group are views; nothing else in the file says which names are tables and which are
views, so the split below is my reading and must be confirmed in Phase 1.

### 2a. Base tables (assumed)

| Name | Used by (component numbers from section 1) | Operations |
|---|---|---|
| `activity_log` | 4, 29 | select |
| `approval_documents` | 17 via 61 | select/insert/update/delete |
| `approval_requirements` | 61 | select/update |
| `approvals` | 58, 60, 61 | select/insert/update/delete |
| `bank_accounts` | 52, 53, 54, 57, 58 | select/insert/update/delete |
| `clients` | 6, 8, 10, 11, 13, 26, 36, 37, 42, 55, 59 | select/insert/update/delete, head-count |
| `commitment_documents` | 17 via 50, 50 | select/insert/update/delete |
| `commitment_lines` | 50 | select |
| `commitments` | 4, 50 | select/insert/update |
| `correspondence` | 10 (count), 20 | select/insert/delete |
| `expenses` | 4, 15, 51, 52 | select/insert/update/delete |
| `field_visits` | 8, 10 (count) | insert |
| `inquiries` | 4, 5, 6, 7, 10, 37 | select/insert/update/delete |
| `invoice_lines` | 56, 57 | select/insert/update/delete |
| `invoice_payments` | 4, 51, 57 | select/insert/update/delete |
| `invoices` | 10 (count), 55, 56, 57 | select/insert/update/delete |
| `offices` | 32, 65 | select/update |
| `partners` | 52, 53 | select/insert/update/delete |
| `payment_milestones` | 15, 56, 57 | select/insert/update/delete |
| `payroll` | 51, 53 | select/insert/delete |
| `po_documents` | 17 via 24 | select/insert/update/delete |
| `product_aliases` | embedded under `products` in 12, 18, 23, 42, 47 | select (embedded only) |
| `product_documents` | 12 (embedded count), 17 via 18, 28, 39 | select/insert/update/delete |
| `product_packs` | embedded under `products` in 12, 18, 23, 42, 47 | select (embedded only) |
| `product_transport` | 29 (backup list only) | select — nothing else references it |
| `product_wordings` | 47 | select/insert/update |
| `products` | 12, 15, 16, 18, 23, 24, 27, 28, 36, 37, 42, 47, 59 | select/update |
| `profiles` | 30, 35, 58, 65 | select/update |
| `project_materials` | 14, 15 | select/insert/update/delete |
| `projects` | 4, 5, 10, 13, 14, 15, 16, 21, 26, 36, 52, 55 | select/insert/update |
| `purchase_order_lines` | 23, 24 | select/insert/update/delete |
| `purchase_orders` | 21, 23, 24, 36 | select/insert/update/delete |
| `quotation_lines` | 14, 23, 27, 42, 47 | select/insert (embedded and direct) |
| `quotation_sections` | 14, 23, 27, 47 | select/insert/delete |
| `quotations` | 10, 13, 21, 26, 36, 42, 47 | select/insert/update/delete |
| `scope_documents` | 42, 45 | select/insert/update/delete |
| `settings` | 23, 35, 65 | select/update |
| `shipment_documents` | 17 via 28, 58 | select/insert/update/delete |
| `shipment_lines` | 27, 28 | select/insert/update/delete |
| `shipments` | 4, 5, 26, 27, 28, 58 | select/insert/update |
| `spec_equivalents` | 42, 45 | select/insert |
| `stock` | 16, 58 | select/update |
| `stock_movements` | 16 | select/insert |
| `warehouses` | 16, 21, 59 | select/insert/update |

### 2b. Views (assumed)

| Name | Used by | Notes |
|---|---|---|
| `approval_watch` | 4, 5, 58, 59, 61, 64, 65 | Columns used: `id, title, status, kind, authority, reference, expires_on, days_to_expiry, expiring_soon, has_expired, needs_attention, next_action, handled_by, submitted_on, decided_on, issued_on, cost, notes, days_since_submitted, product_id, warehouse_id, client_id, product_name, warehouse_name, client_name, outstanding, provided, required, next_needed, next_owed_by` |
| `cash_position` | 4, 5, 51, 54 | `bank_account_id, balance, received, spent, wages_and_drawings` |
| `catalogue_pricing` | 12 | `pack_id, cost_aed, material_cost_aed_m2, sell_aed_m2` (server-side money) |
| `commitment_totals` | 50 | `commitment_id, title, status, supplier, reference, quoted_on, amount_aed, header_amount, lines_total, difference, lines_agree, estimated_lines, category, notes` |
| `document_watch` | 4, 5, 65 | `state ('expired'/'expiring'), product_name, product_id, title` |
| `invoice_totals` | 4, 5, 51, 55, 65 | `invoice_id, status, outstanding, received, total, due_date` |
| `open_order_lines` | 4, 5, 65 | `po_id, reference, expected_on` |
| `partner_ledger` | 51, 53 | `partner_id, name, ownership_pct, share_capital, funded, drawings, contributed, fair_share, balance` |
| `product_transport_summary` | 47 | `product_id, un_numbers, un_classes, worst_packing_group, marine_pollutant, classified_components, sds_on_file` |
| `project_actuals` | 15 | `project_id, has_actuals, costs_booked, labour_cost, shipment_cost, material_issued, quoted_cost, actual_cost, contract_value, quoted_margin_pct, actual_margin_pct, actual_gross` (server-side money) |
| `project_totals` | 4, 5, 13 | `project_id, invoiced, outstanding` |
| `purchase_order_totals` | 4, 21 | `po_id, status, value_aed, received_pct, document_count` |
| `quotation_totals` | 14, 42 | `quotation_id, subtotal, gross_profit, cost_total` (server-side money) |
| `requirement_watch` | 4 | `title, approval_title, approval_id, expires_on, has_expired, at_risk, days_left` |
| `shipment_totals` | 26 | `shipment_id, landed_cost, has_dangerous_goods, document_count` |
| `stock_detail` | 16, 58, 59, 61, 64 | `stock_id, product_id, product_name, warehouse_id, warehouse_name, qty_on_hand, unit, blocked, block_reason, needs_product_approval, product_approval_expired, needs_warehouse_certificate, warehouse_certificate_expired` |
| `stock_position` | 4, 5, 16, 65 | `product_id, product_name, on_hand, blocked, committed, available, free_to_move, movable, reorder_level, unit, block_reason` |
| `visit_funnel` | 4, 9 | `client_id, name, stage, visits, first_visit, last_visit, days_since_visit, follow_up_overdue, going_cold, flagged_high, next_due, quotations, contact_person, phone, email, location` |
| `visit_log` | 9 | `id, client_id, visit_date, visited_by, contact_person, summary, product_interest, assessment, next_action, next_action_by, priority` |

### 2c. Named in `OFFICE_OWNED` (1941–1945) but never queried anywhere

`approval_progress`, `commitments_outstanding`, `correspondence_feed`, `stale_inquiries`,
`visit_scoreboard`. Harmless in the wrapper; may or may not exist in the database.

### 2d. RPC functions

| RPC | Arguments as called | Called from |
|---|---|---|
| `next_quotation_reference` | `{p_office}` | 47 (11073) |
| `next_po_reference` | none | 23 (5804) |
| `next_invoice_reference` | none | 56 (12502) |
| `receive_po_line` | `{p_line_id, p_qty, p_warehouse_id, p_moved_on, p_note}` | 25 (6494) |

`sb.rpc` is a straight pass-through (1952): no office scoping is applied to any RPC.

### 2e. Storage buckets

`product-docs` (18, 28, 39), `po-docs` (24), `shipment-docs` (28), `commitment-docs` (50),
`approval-docs` (61), `scope-docs` (42, 45). Files are opened through 120-second signed URLs.
Upload paths are `<record id>/<timestamp>-<safe name>` for documents and
`<office code>/<timestamp>-<safe name>` for scopes (10126).

### 2f. Auth

`signInWithPassword`, `resetPasswordForEmail` (redirect to `origin+pathname`), `updateUser`
(password), `getSession`, `onAuthStateChange` (two subscribers: 13539 for `PASSWORD_RECOVERY`,
13605 for session changes), `signOut`.

### 2g. Foreign-key embeds the schema must support

`inquiries→clients`, `clients→inquiries`, `projects→clients`, `projects→quotations`,
`quotations→clients`, `stock_movements→products|warehouses|projects`,
`purchase_orders→quotations|projects`, `purchase_order_lines→products`,
`shipments→clients|quotations|projects`, `product_documents→products`,
`expenses→partners|projects`, `payroll→partners`, `invoices→clients|projects`,
`products→product_packs|product_aliases|product_documents`, `quotation_sections→quotation_lines`.

---

## 3. Navigation

### 3a. Gates before the app (`App` 13658–13668)

1. `session === undefined` → spinner (still checking).
2. `session === null` → `Login`. If the URL carried `error_description`, Login shows the
   "link used or expired" message.
3. Signed in and the URL type was `recovery`, `invite` or `signup` (or a `PASSWORD_RECOVERY`
   event fired) → `SetPassword`, which cannot be skipped.
4. Otherwise the deck.

### 3b. The rail (13700–13712)

Order and section headings are fixed. `tab` state defaults to `dashboard`.

| Section | Tab key | Label | Component |
|---|---|---|---|
| — | `dashboard` | Operations | `Operations` |
| Selling | `visits` | Visits | `Visits` |
| | `pipeline` | Pipeline | `Pipeline` |
| | `quotations` | Quotations | `Quotations` |
| | `clients` | Clients | `Clients` |
| Delivering | `projects` | Projects | `Projects` |
| | `orders` | Orders | `Orders` |
| | `shipments` | Shipments | `Shipments` |
| | `stock` | Stock | `Stock` |
| The books | `finance` | Finance | `Finance` |
| | `approvals` | Approvals | `Approvals` |
| Reference | `catalogue` | Catalogue | `Catalogue` |
| | `settings` | Settings | `Settings` |

Rail foot: theme cycle (brand → dark → light) and Sign out. Badge counts on
finance/approvals/stock/orders/catalogue come from `loadAlerts` (13577–13596).

The command bar (13751–13772) holds: the ☰ drawer toggle (phone), the office switch
(`DXB` / `BEL` / `BOTH`, only if more than one office exists), the ⌘K search button, and the
two clocks.

### 3c. Deep links: `go([tab, id])` (13694–13696)

Sets `tab` and `focusId` (or `clientFocus` for clients). Each module consumes `focus` on
mount and calls `clearFocus`. Targets used in the file:

| From | Target | What opens |
|---|---|---|
| Operations queue rows (3059–3115) | `['finance']`, `['stock']`, `['catalogue', productId+'#documents']`, `['orders']`, `['approvals', id]`, `['pipeline']`, `['visits', clientId]`, `['visits']` | Module, or the record inside it. `#documents` scrolls the product page to its documents panel. |
| Operations module tiles (3193) | `[key]` | The module |
| Operations "Latest changes" rows (3206) | `['settings']` | Settings (opens on the Offices tab, not the log) |
| Readiness buttons (12956) | `go(tab)` string, wrapped to `[k]` by Operations | Module |
| Palette places (7450) | `[key]` for the 12 `PAL_PLACES` | Module (`dashboard` is labelled "Operations") |
| Palette actions (7453–7457) | `['quotations','new']`, `['orders','new']`, `['finance','costs']`, `['stock']`, `['settings']` | New quotation editor; New order modal; Finance (lands on Overview because `Finance` ignores focus); Stock; Settings |
| Palette results (7475–7488) | `['visits'|'clients', id]`, `['quotations', id]`, `['orders', id]`, `['projects', id]`, `['catalogue', id]` | The record |
| Visits company page (3624) | `['pipeline']` | Pipeline list |
| Clients list note (3892) | `['visits']` | Visits |

### 3d. Sub-views inside each module

- **Operations**: single screen; `Readiness` panel appears only when something is missing.
- **Visits**: list (filter chips Everything / Needs chasing / High potential / Quoted / Won)
  → company page (click a row) → `LogVisitModal` from either.
- **Pipeline**: list with stage filter → `InquiryModal` (row click or New inquiry).
- **Quotations**: list for the current office → `QuotationEditor` (row click, or New quotation
  = id `'new'`) → inside it "Shipping request" toggles `ShippingRequest`; "PDF" prints via
  `printOnePage`. "Read a scope" → `ScopeReader` (upload/paste → review → Create the draft,
  which writes `localStorage.bt-draft-new` and opens the blank editor). Stored scopes list
  below with Open / Remove.
- **Clients**: list (non-prospects only) → client page (inquiries, quotations, projects,
  correspondence, Edit, two-step Delete) → `ClientModal`.
- **Projects**: list + margin chart → `ProjectPage`; New project → `NewProjectModal`.
- **Orders**: list → `OrderPage` (lines, Read a proforma, Receive ↓ → `ReceiveModal`,
  paperwork, correspondence, two-step Delete); New order → `NewOrderModal`.
- **Shipments**: list → `ShipmentPage`; New shipment → `NewShipmentModal`.
- **Stock**: single screen: cards, Held, Short, Position (inline reorder level),
  Record a movement, Recent movements, Warehouses (editable, Save warehouses).
- **Finance** sub-nav (11702–11704): Overview, Money in (`Invoices` → `InvoicePage`,
  `NewInvoiceModal`), Money out (`Costs`), Coming up (`Commitments`), Salaries and partners
  (`People`), Bank accounts (`Banks`).
- **Approvals**: list → `ApprovalPage`; New approval → `NewApprovalModal`.
- **Catalogue**: grid with search/category/Show cost → `ProductPage`.
- **Settings** tabs (7341–7348): Offices, Pricing, Numbering, The document, Freight,
  Everything else (only if a key is unfiled), Who can get in, Your account (language,
  password, install), Log and backup.

Changing office remounts `<main key=${officeCode}>` (13773), so every module reloads its data
under the new `OFFICE_ID`.

---

## 4. Defined but never rendered or called

Confirmed by counting references (a single hit means only the definition):

| What | Lines | Note |
|---|---|---|
| `Dashboard` | 3215–3372 | The pre-Operations home. Only referenced by its own `_t("Dashboard")` and two translation strings. `PAL_PLACES` key `dashboard` maps to `Operations`. |
| `GlobalSearch` | 7537–7571 | Replaced by `Palette`. |
| `Masthead` | 13486–13524 | Its clocks moved into `BarClocks`; the alert pill has no replacement. |
| `printShipping` | 7972–7979 | `ShippingRequest` now writes a PDF instead of printing. The `.print-ship` CSS at 899–908 is orphaned with it. |
| `pdfDeref` | 8451–8455 | Never called. |
| `.topbar` measuring effect | 13639–13648 | Queries `.topbar`, which no longer exists, and returns early every time. |
| CSS for the old chrome | 655–672, 1218–1275, 1465–1487, 1588–1615 | `.topbar`, `.search-wrap`, `.results`, `.nav button`, `.masthead*` — no markup uses them. |
| `product_transport` | 6986 | Only in the backup table list; never read or written by a screen. |
| Five `OFFICE_OWNED` names | 1941–1945 | See 2c. |
| `DocumentsPanel.add` | 4743–4745 | The local practice stub. Would be dead code if it parsed; as written it prevents parsing. |
| `window.__BT_T` | 2843 | Exposes `_t` for tests; nothing in the file uses it. |
| `terms` in `NewInvoiceModal` | 12485 | Computed and never used; the due date is always +30 days (12488). |

Settings keys that appear in `SETTING_GROUPS` (7111–7124) but are never read by any code in
this file: `install_rate_aed`, `freight_per_m2_aed`, `quote_prefix`, `quote_suffix`,
`quote_number_digits`, `quote_next_number`, `invoice_prefix`, `invoice_suffix`,
`invoice_number_digits`, `invoice_next_number`. The numbering ones are presumably read by
the `next_*_reference` RPCs in the database; the two rate keys I cannot place. Unsure.

Not dead, but easy to mistake for it: the second `onAuthStateChange` subscription at 13539
only watches for `PASSWORD_RECOVERY`; the one at 13605 handles sessions.

---

## 5. Office scoping

### 5a. The mechanism (1935–1964)

```
OFFICE_OWNED = Set(['clients', 'field_visits', ... , 'visit_scoreboard'])
OFFICE_ID    = null           // set by App on every render (13689)
sb.from(table):
  if OFFICE_ID is null, or table not in OFFICE_OWNED → the raw builder, untouched
  otherwise:
    .select(...)  → raw.select(...).eq('office_id', OFFICE_ID)
    .insert(rows) → raw.insert({office_id: OFFICE_ID, ...row})   // caller's office_id wins
```

- `OFFICE_ID` is chosen in `App` (13678–13689): the stored `bt-office` code, else the
  user's own `profiles.office_id`, else the first office; `'ALL'` means BOTH and sets it to
  `null`. Office codes are `DXB` and `BRU` (shown as `BEL` via `OFFICE_TAG`, 8043).
- Because `OFFICE_ID` is a module-level variable assigned during render, every query fired
  from an effect after that render is scoped. Switching office remounts `<main>`.
- **What is scoped:** `.select()` (including `{count:'exact', head:true}` counts) and
  `.insert()` on office-owned tables and views.
- **What is not scoped, by design of the wrapper:** `.update()`, `.delete()`, `.upsert()`
  (not used), `.rpc()`, `.storage`, and any `.select()` chained after an insert or update
  (those come back on a different builder object). Updates and deletes are always by primary
  key, so in practice they rely on the id having come from a scoped read, or on RLS.
- **The views must expose `office_id`.** The `.eq('office_id', …)` is added to every view in
  the set. The comment at 1940 says migration 0048 added it. Not verified here.

### 5b. BOTH mode and writes

With BOTH selected, `OFFICE_ID` is `null`, nothing is filtered and **nothing is stamped**.
Only one insert in the whole file sets `office_id` itself: `QuotationEditor` (11080, from the
quotation's own office chosen in the form). Every other office-owned insert relies on the
wrapper, so in BOTH mode these rows are inserted with no `office_id` unless the database
supplies one:

`clients` (ClientModal 3919, LogVisitModal 3512), `field_visits` (3518), `inquiries` (3439),
`projects` (4136), `purchase_orders` (5806), `shipments` (6648), `warehouses` (4513),
`stock_movements` (4491), `approvals` (13093), `correspondence` (5409), `invoices` (12505),
`expenses` (12079), `bank_accounts` (12359), `partners` (12232), `payroll` (12244),
`commitments` (11759).

Whether `office_id` has a default or a NOT NULL constraint is a Phase 1 question. The
Quotations list comment at 8286–8288 shows rows with a null office are expected to exist.

One spread-order detail: `{office_id: OFFICE_ID, ...r}` means a caller passing
`office_id: null` explicitly (as `QuotationEditor` can when `q.office_id` is null) overrides
the stamp with null.

### 5c. Reads of office-owned data that bypass the filter

| Table / view | Where | Why it matters |
|---|---|---|
| `invoice_payments` | Operations 3006, FinanceOverview 11922 | Not in `OFFICE_OWNED`, read without a parent filter. The "money in" sparkline and the money in/out chart sum both offices' receipts even in a single-office view, and mix EUR and AED. |
| `scope_documents` | Quotations 8209 | Not in the set; the "Scopes we have been sent" list shows both offices' documents in every view. |
| `quotation_lines` | Quotations 8251 | Direct read of every past line with a product, across offices, to feed the matcher. Probably intended. |
| `quotations` rows with null `office_id` | Quotations 8289 | The in-memory filter keeps null-office rows in every view, but the wrapper's `.eq('office_id', X)` has already excluded them from the query in single-office mode. The two disagree; the comment describes behaviour the wrapper prevents. |

Child tables not in the set but always read through a parent id (fine as long as the parent
was scoped): `quotation_sections`, `quotation_lines` (embedded), `purchase_order_lines`,
`shipment_lines`, `invoice_lines`, `payment_milestones`, `project_materials` (in the set
anyway), `commitment_lines`, `commitment_documents`, `po_documents`, `shipment_documents`,
`approval_documents`, `approval_requirements`, `product_documents`.

Global by design and correctly outside the set: `products`, `product_packs`,
`product_aliases`, `product_documents`, `product_wordings`, `product_transport_summary`,
`catalogue_pricing`, `document_watch`, `spec_equivalents`, `settings`, `offices`,
`profiles`, `activity_log`.

### 5d. Currency and office

`ACTIVE_CUR` (13686) is the office currency, or `AED` in BOTH. Formatting helpers use it for
any figure that has no record of its own (Operations vitals, Finance cards, Projects cards).
Quotations, POs, shipments, expenses and commitments carry their own currency and rate. In
BOTH mode the vitals and finance totals add whatever `invoice_totals.outstanding`,
`cash_position.balance` and `expenses.amount_aed` contain across both offices under an AED
label; whether the views convert to a common currency is a Phase 1 question.

---

## 6. Permission model

### 6a. Roles

Exactly two, held in `profiles.role`: `owner` and `full` (7086–7091 toggles between them).
A signed-in user with no `profiles` row gets `me = {full_name, email}` (13629) with no role,
and is treated as non-owner everywhere.

### 6b. What the frontend restricts to owners

| Where | Line | Restriction |
|---|---|---|
| Settings value fields | 7354–7357, 7388 | Inputs `disabled` and the Save button hidden unless `me.role === 'owner'` |
| Offices panel | 7167–7201, 7208 | Same: legal name, address, VAT rate, numbering prefix/suffix, bank details, terms |
| Access list | 7078–7091 | The "Give them the dials / Take the dials off them" column only renders for owners; you cannot change your own role |
| Your account | 7408–7410 | Text only |

That is the whole list. Nothing else in the file checks a role.

### 6c. What every signed-in user can do in the UI

Create, edit and delete every record type: clients, visits, inquiries, quotations
(including setting `status` to `approved` from the dropdown at 11208, which is the only
"approval" mechanism there is), projects, milestones, materials, purchase orders and lines,
receiving goods, shipments, stock movements in and out (no check against `blocked` stock at
4485–4500), warehouses and their Civil Defence certificate fields, approvals, expenses,
invoices and payments, partners (ownership % and share capital), payroll (salaries and
drawings), bank accounts and opening balances, product shipping/DCD fields, all documents,
the JSON backup of every table (6991), and their own language and password. Any user can
switch to any office or to BOTH; nothing ties a user to their `profiles.office_id` beyond
choosing the default.

### 6d. What is not in the UI at all

Creating logins (Supabase dashboard only, 7094). Any approver role for quotations. Any
per-office restriction. Any restriction on reading salaries, the partner ledger or bank
balances.

### 6e. Server side

Unknown from this file. Every rule in 6b is JavaScript only. The publishable key is in
`config.js`; whether RLS enforces any of the above is Phase 2.

---

## 7. The money pipeline, with line numbers

The intended chain is EUR list → supply discount → AED conversion → margin → sell price.
Where each step lives:

### 7a. Inputs

| Input | Where read |
|---|---|
| `settings.supply_discount` (fraction, default 0.70) | 5616, 7641, 10154, 10958 |
| `settings.eur_aed_rate` (default 4.27) | 13670 (`rate` prop for the whole app), 5616, 7642, 10155, 10959 |
| `settings.default_margin` (fraction, default 0.45) | 10156, 10579–10580 (seeds the editor's margin box once) |
| `settings.vat_rate` | 10735 (fallback for a new quotation), 12510 (every new invoice) |
| `offices.currency`, `offices.vat_rate`, `offices.default_lang` | 10727–10735, 11224–11229 |
| Per-record rate | `quotations.eur_aed_rate` = 1 for EUR else `rate` (11079); `purchase_orders.eur_aed_rate` = `rate` (5811); `shipments.eur_aed_rate` (6652, 6772, editable 6876); `expenses.eur_aed_rate` (12083); `commitments.eur_aed_rate` **hard-coded 4.27** (11764) |
| Catalogue | `product_packs.eur_total`, `eur_per_unit`, `pack_qty`, `unit`, `is_poa`, `label`; `products.coverage_min/max/unit`, `consumption_text` |

### 7b. List price per unit (EUR)

- `packList(p)` 10963–10967: cheapest priced pack per unit, `eur_per_unit` or
  `eur_total/pack_qty`. Same formula as `perUnit` at 7727 and `per` at 10158, 5660.
- Catalogue grid 4019: `AED(k.eur_per_unit*rate)` — list × fx with **no** supply discount
  (the customer-facing RRP). Product page 4904–4906 likewise.
- `catalogue_pricing` view supplies `cost_aed`, `material_cost_aed_m2`, `sell_aed_m2`
  (4022–4025): the same chain computed in the database; not verified here.

### 7c. Cost = list × (1 − supply discount) × fx

- `packCost` 10970–10971 (quotation editor; `fxRate` is 1 for a EUR quotation, 10959).
- `costPerKg` 10157–10162 (scope reader).
- `netAed` 7643, applied at 7739 (rolls, per m²) and 7750 (pails, per kg).
- `eurDef` 5705 (PO line amount in EUR: list × packs × (1 − disc)); `aedOf` 5711.
- `netOfList` 6128–6130 (PO page: list per pack less discount, divided by kg per pack).
- Implied discount written back to a PO line when an amount was typed over: 5844–5850;
  `unit_price = amount / qty` rounded to 4 dp, 5860.

### 7d. Consumption and quantities

- `parseConsumption` 7594–7609: reads "2 layers of 0,80 - 1,00 kg/m2", "500 g/m2" etc.;
  takes the upper end of a range; g → kg ÷ 1000.
- `coverageOf` 10615–10622: catalogue `coverage_max ?? coverage_min` with `g/` or `kg/`.
- `lineCostDetail` 10623–10649 and `sectionCost` 10972–10999: cost per m² = kg/m² × cost/kg
  (or one-for-one for products sold by the m²).
- Take-off 7653–7756: section area = **max** of its m² lines (7665); kg = area × kg/m²
  (7707); packs = `ceil(kg / biggest pack_qty)` (7747–7749); rolls = `ceil(m² / rollM2)`
  (7738); gross = net × (1 + tare) (7742, 7753); pallets/volume 7784–7785.
- Project milestone % → amount: 4422.

### 7e. Sell from cost, at a margin or a mark-up

- `sellFrom` 10558–10560: margin mode `cost / (1 − pct/100)`, capped so 100% is
  unreachable; mark-up mode `cost × (1 + pct/100)`. Mode persisted in `bt-pricemode`.
- `atMargin` 11001, `onMargin` 11003 (a line "follows" the margin if within 0.51 of it).
- Auto-cost effect 10653–10674 (fills blank cost and sell once per line, from the section's
  spec notes or the line's own product).
- `costSection` 11006–11015, `repriceAll` 11016–11018, `move` 11237–11246 (re-prices only
  lines that were following the old margin).
- Scope reader `sellFrom` 10163 (margin mode only).

### 7f. Quotation totals

- `sellTotal` 10509–10511 (priced lines only: not spec notes, not build-up).
- `subtotal` 10829; `discount = min(discount_amount, subtotal)` 10904; `netSub` 10905;
  `vat = vat_applies ? netSub × vat_rate : 0` 10906; `total` 10907.
- Printed sheet rounds each line to whole currency units first, then sums: `printSub`,
  `printDisc`, `printNet`, `printVat`, `printTotal` 10911–10915; `money`/`roundAed`
  7993–8000.
- Target price: `netOf` 10840 (strips VAT from the typed gross), `applyPrice` 10841–10855,
  `scaleRatesTo` 10400–10468 (scale, round to 2 dp, then search one or two carrier lines
  for the residue), `sectionsAtPrice` 10515–10523, `applySecPrice` 10861–10876.
- Margin readouts: `lineMargin` 11032–11048 = (sell − cost) ÷ sell (**margin on sell**,
  with the mark-up printed in the tooltip); `secMargin` 11055–11066; page `marginPct`
  10900 over costed sections only; floor 10920–10922 = `costTotal / (1 − floor%)`.
- The list page uses `quotation_totals.gross_profit ÷ subtotal` (8304–8305), from the view.

### 7g. VAT

- Quotation: rate from the office (10735, 11229), applied on the discounted subtotal
  (10906), printed 10914; label at 11216 uses the rate.
- Invoice: `vat_rate` from **settings** with a 0.05 default (12510), not from the office;
  `vat = round(subtotal × rate, 2)` 12584; the dropdown labels are the fixed string
  "Add 5% VAT" (12554, 12689).
- Invoice `inWords` 11678–11698 always says dirhams and fils.

### 7h. Downstream money

- Project: `cost` 4215 (materials + freight + duty + other), `gross` 4216,
  `marginPct = gross / value` 4217 (margin, not mark-up); chart 4086–4088; over-scheduled
  milestones 4219; `project_actuals` view drives quoted-vs-actual 4297–4346.
- Shipment landed cost: `goodsAed = Σ value_eur × rate || goods_value_eur × rate` 6749,
  `shipCost` 6750–6751, `landed` 6752.
- PO value: `Σ qty × unit_price` 6104, × rate 6105; view/EUR toggle 6112–6118.
- Operations vitals 3025–3034 (bank, owed, overdue, on order + quoted commitments).
- Finance overview 11930–11976; Costs totals 12069–12072; Banks 12365;
  Commitments 11788; Invoices 12437–12440.

### 7i. Formatting

`fmtMoney`/`AED`/`AED0`/`AED2` 2862–2870 (locale `nl-BE` for EUR, `en` otherwise);
`fmtN` 7986; `eu` 7988 (comma decimal for the sheet); `round2` 7995; `short` 13312 (charts).

---

## Appendix — observations parked for Phase 3

Not findings yet, and no code was changed. Listed so they are not lost.

1. Three modals use class `modal-back`, which has no CSS rule (`LogVisitModal` 3529,
   `NewOrderModal` 5878, `ReceiveModal` 6502). `.modal-bg` is the styled one. Other classes
   used in markup with no rule: `row2`, `warnbox`, `btn ghost`, `row-click`, `clickable`,
   `scope-item`, `scope-qty`, `ordbox`, `ordrow`.
2. `invoice_payments` and `scope_documents` are read without office scoping (5c).
3. `commitments.eur_aed_rate` is hard-coded to 4.27 (11764).
4. Invoice VAT rate and labels come from settings and a fixed "5%", not the office (7g).
5. BOTH mode inserts carry no `office_id` (5b).
6. `today()` (2875) and `addDays` (1981–1984) use `toISOString()`, i.e. UTC; after 20:00 in
   Dubai the app's "today" is still yesterday. `correspondence.occurred_at` is written as
   local noon converted to UTC (5406).
7. Shipment references are generated client-side from the list already loaded (6629–6634);
   two people creating one at the same time get the same number.
8. `Costs` defaults `paid_on` to today (12050), so a new cost is "paid" unless cleared.
9. `Operations` catalogue tile shows a fixed "132" (3148).
10. Quotations list: null-office rows are meant to show everywhere (8286–8289) but the
    wrapper excludes them in single-office mode.
11. `Palette` "Record a cost" lands on Finance Overview, not Money out (3c).
12. `LogVisitModal` hard-codes `location:'Abu Dhabi'` and `visited_by:'Mohammad Gias Uddin'`
    (3499, 3512).
13. Stock "Issued out" has no client-side check against `blocked` stock (4485–4500).
14. `ProjectPage.save`, `OrderPage.save`, `ShipmentPage.save`, `InvoicePage.save`,
    `People.savePartners`, `Banks.save` loop over child rows with sequential awaits and do
    not surface per-row errors (e.g. 4240–4250, 12606–12614).
15. The Supabase client is created with no options (1919); relevant to Phase 4.
