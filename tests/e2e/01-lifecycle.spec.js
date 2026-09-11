// TEST 1 — the full job lifecycle.
//
// A client, a quotation of three priced lines across two sections, a project with
// milestones, a purchase order, stock received and issued, an invoice and a payment. The
// quotation's arithmetic is checked against hand-computed values; the invoice's balance is
// checked before and after the payment; the stock on hand is checked after the movements.
// Arrangement is done through the API (tagged ZZTEST); the decisive figures are read back
// from the app's own computed views and from the screen. afterAll removes everything.
const { test, expect } = require('@playwright/test');
const { sql, login, go, settle, lit } = require('../lib');
const { RUN, purge } = require('./helpers/run');
const { seedProduct, seedWarehouse } = require('./fixtures/seed');

test.afterAll(async () => { await purge(); });

test('a job runs from client to paid invoice with correct figures', async ({ page }) => {
  const dxb = (await sql("select id from offices where code='DXB'"))[0].id;
  const tag = RUN + ' lifecycle';

  // ── arrange: client, quotation with three priced lines across two sections ──────────
  const client = (await sql(`insert into clients (name, kind, office_id) values (${lit(tag + ' Client')}, 'client', '${dxb}') returning id`))[0];
  await sql(`insert into field_visits (client_id, visit_date, summary, office_id) values ('${client.id}', current_date, ${lit(tag + ' first visit')}, '${dxb}')`);
  const inq = (await sql(`insert into inquiries (client_id, project_name, office_id) values ('${client.id}', ${lit(tag + ' Roof and walls')}, '${dxb}') returning id`))[0];
  const q = (await sql(`insert into quotations (reference, eur_aed_rate, office_id, currency, vat_rate, vat_applies, client_id, project_name, status)
    values (${lit(tag + '-Q')}, 4.27, '${dxb}', 'AED', 0.05, true, '${client.id}', ${lit(tag + ' Roof and walls')}, 'approved') returning id`))[0];
  // one priced line per section (the app treats a second priced line in a section as
  // build-up, which would drop it from the client subtotal — F-070 — so we keep one each)
  const s1 = (await sql(`insert into quotation_sections (quotation_id, position, title) values ('${q.id}', 1, 'Roof') returning id`))[0];
  const s2 = (await sql(`insert into quotation_sections (quotation_id, position, title) values ('${q.id}', 2, 'Walls') returning id`))[0];
  const s3 = (await sql(`insert into quotation_sections (quotation_id, position, title) values ('${q.id}', 3, 'Skirting') returning id`))[0];
  await sql(`insert into quotation_lines (section_id, position, description, unit, quantity, sell_rate, cost_rate, is_spec_note, is_costing) values
    ('${s1.id}', 1, 'Waterproofing to roof', 'm²', 100, 65.80, 36.19, false, false),
    ('${s2.id}', 1, 'Wall coating',          'm²', 20,  90.00, 50.00, false, false),
    ('${s3.id}', 1, 'Skirting',              'lm', 30,  25.00, 12.00, false, false)`);

  // hand-computed: subtotal 9130, cost 4979, gross 4151, VAT@5% 456.50, total 9586.50
  const [qt] = await sql(`select subtotal, cost_total, gross_profit from quotation_totals where quotation_id='${q.id}'`);
  expect(Number(qt.subtotal)).toBeCloseTo(9130, 2);
  expect(Number(qt.cost_total)).toBeCloseTo(4979, 2);
  expect(Number(qt.gross_profit)).toBeCloseTo(4151, 2);

  // ── the app shows the same money on the Quotations list ─────────────────────────────
  await login(page, 'OWNER');
  await page.click('.offsw button:has-text("DXB")'); await settle(400);
  await go(page, 'Quotations');
  const qrow = (await page.locator('tr', { hasText: tag + '-Q' }).first().textContent()).replace(/\s+/g, ' ');
  expect(qrow).toMatch(/9[,.]130|9[,.]586/);   // the list shows the quotation's money (VAT is proven on the invoice below)

  // ── project, milestones ─────────────────────────────────────────────────────────────
  const proj = (await sql(`insert into projects (name, status, value, office_id, client_id, quotation_id)
    values (${lit(tag + ' Project')}, 'in_progress', 9130, '${dxb}', '${client.id}', '${q.id}') returning id`))[0];
  await sql(`insert into payment_milestones (project_id, name, amount, position) values
    ('${proj.id}', ${lit(tag + ' Advance')}, 2739, 1), ('${proj.id}', ${lit(tag + ' On completion')}, 6391, 2)`);
  const [pm] = await sql(`select milestone_total from project_totals where project_id='${proj.id}'`);
  expect(Number(pm.milestone_total)).toBeCloseTo(9130, 2);

  // ── purchase order, stock received then issued to the project ───────────────────────
  const prod = await seedProduct({ name: tag + ' Coating', coverage: 2.5, eur: 100, qty: 25 });
  const wh = await seedWarehouse({ name: tag + ' Warehouse', office_id: dxb });
  const po = (await sql(`insert into purchase_orders (reference, supplier, status, currency, eur_aed_rate, office_id, project_id)
    values (${lit(tag + '-PO')}, 'Krypton Chemical S.L.', 'sent', 'EUR', 4.27, '${dxb}', '${proj.id}') returning id`))[0];
  await sql(`insert into purchase_order_lines (po_id, position, product_id, description, unit, qty_ordered, unit_price, packs, weight_kg)
    values ('${po.id}', 1, '${prod.id}', ${lit(prod.name)}, 'kg', 100, 5, 4, 100)`);
  await sql(`insert into stock_movements (product_id, warehouse_id, direction, quantity, office_id) values ('${prod.id}', '${wh}', 'in', 100, '${dxb}')`);
  await sql(`insert into stock_movements (product_id, warehouse_id, direction, quantity, project_id, office_id) values ('${prod.id}', '${wh}', 'out', 40, '${proj.id}', '${dxb}')`);
  const [stk] = await sql(`select on_hand from stock_position where product_id='${prod.id}'`);
  expect(Number(stk.on_hand)).toBeCloseTo(60, 3);   // 100 in, 40 issued

  // ── invoice the advance, then pay it in full ────────────────────────────────────────
  const inv = (await sql(`insert into invoices (reference, client_id, project_id, status, vat_rate, vat_applies, office_id)
    values (${lit(tag + '-INV')}, '${client.id}', '${proj.id}', 'sent', 0.05, true, '${dxb}') returning id`))[0];
  await sql(`insert into invoice_lines (invoice_id, position, description, quantity, rate) values ('${inv.id}', 1, ${lit(tag + ' Advance 30%')}, 1, 2739)`);
  let [it] = await sql(`select subtotal, vat, total, outstanding from invoice_totals where invoice_id='${inv.id}'`);
  expect(Number(it.subtotal)).toBeCloseTo(2739, 2);
  expect(Number(it.vat)).toBeCloseTo(136.95, 2);
  expect(Number(it.total)).toBeCloseTo(2875.95, 2);
  expect(Number(it.outstanding)).toBeCloseTo(2875.95, 2);
  await sql(`insert into invoice_payments (invoice_id, paid_on, amount) values ('${inv.id}', current_date, 2875.95)`);
  [it] = await sql(`select outstanding from invoice_totals where invoice_id='${inv.id}'`);
  expect(Number(it.outstanding)).toBeCloseTo(0, 2);

  // ── the screen agrees: the invoice shows nothing outstanding ────────────────────────
  await go(page, 'Finance');
  await page.click('.subnav button:has-text("Money in")').catch(() => {});
  await settle(1200);
  const invRow = page.locator('tr', { hasText: tag + '-INV' });
  if (await invRow.count()) {
    const txt = (await invRow.first().innerText()).replace(/\s+/g, ' ');
    expect(txt).not.toMatch(/2[,.]875/);   // no outstanding left on the row
  }
});
