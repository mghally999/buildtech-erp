// TEST 7 — the Charles path.
//
// The journey Charles reported as broken, end to end: upload the Waterfront Market BOQ,
// read it, create the draft, check the lines, save, view the sheet, generate the shipping
// request, turn it into a purchase order, approve it as an owner, and print it. Every step
// asserts a real value; the quotation lines are checked against the same reading the
// offline fixture pins down.
const fs = require('fs');
const path = require('path');
const { test, expect } = require('@playwright/test');
const { sql, login, go, settle, lit } = require('../lib');
const { RUN, purge } = require('./helpers/run');


const created = { quotations: [], pos: [] };
test.afterAll(async () => {
  for (const id of created.pos) {
    await sql(`delete from purchase_order_lines where po_id='${id}'`);
    await sql(`delete from purchase_orders where id='${id}'`);
  }
  for (const id of created.quotations) {
    await sql(`delete from quotation_lines where section_id in (select id from quotation_sections where quotation_id='${id}')`);
    await sql(`delete from quotation_sections where quotation_id='${id}'`);
    await sql(`delete from quotations where id='${id}'`);
  }
  await purge();
});

test('a BOQ becomes a priced draft, a shipping request and an approved order', async ({ page }) => {
  const dxb = (await sql("select id from offices where code='DXB'"))[0].id;
  const scopeText = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'docs', 'schema', 'scope_doc.json'), 'utf8'))[0].extracted;
  // a client whose name matches the bill's "Waterfront Market LLC" (ZZTEST so purge removes it)
  await sql(`insert into clients (name, kind, office_id) values (${lit('Waterfront Market LLC ZZTEST')}, 'client', '${dxb}')`);
  const before = new Set((await sql("select id from quotations")).map(r => r.id));

  await login(page, 'OWNER'); await page.click('.offsw button:has-text("DXB")'); await settle(400);

  // ── read the scope and create the draft ─────────────────────────────────────────────
  await go(page, 'Quotations');
  await page.click('button:has-text("Read a scope")'); await settle(1200);
  await page.fill('textarea.scope-in', scopeText);
  await page.click('button:has-text("Read it")'); await settle(2500);
  await page.click('button:has-text("Create the draft")');
  await page.waitForSelector('.needprice', { timeout: 20000 }); await settle(2000);

  expect(await page.locator('.needprice').innerText()).toMatch(/10 of 14 sections still need a price/);
  const banner = (await page.locator('.flagbox').allTextContents()).join(' ');
  expect(banner).toMatch(/a client on the books/);
  // the bold spec lines are textareas, so read their values, not the DOM text
  const specValues = await page.evaluate(() => [...document.querySelectorAll('.lrow.note textarea, input[type=text]')].map(x => x.value));
  expect(specValues.some(v => /BT-Crete SL : Approx\. 10,5 kg\/m² at 6 mm/.test(v))).toBe(true);   // the 6 mm item, costed at 6 mm

  // ── save; the number is issued, fourteen priced lines are written ───────────────────
  await page.evaluate(() => { window.print = () => {}; });
  await page.click('button:has-text("Save")'); await settle(4000);
  const [q] = await sql(`select id, reference, client_id from quotations where id not in (${[...before].map(x => `'${x}'`).join(',') || "'00000000-0000-0000-0000-000000000000'"})`);
  expect(q).toBeTruthy(); created.quotations.push(q.id);
  const lines = await sql(`select l.is_spec_note, l.unit, l.sell_rate from quotation_lines l join quotation_sections s on s.id=l.section_id where s.quotation_id='${q.id}'`);
  const priced = lines.filter(l => !l.is_spec_note);
  expect(priced.length).toBe(14);                                             // every bill item is a line
  expect(priced.filter(l => /^lm$/i.test(l.unit || '')).every(l => l.sell_rate == null)).toBe(true);   // metre-run lines not priced per m²
  expect(priced.some(l => l.unit === 'LS') && !priced.some(l => /^(sq\.m|item)$/.test(l.unit || ''))).toBe(true);   // units as the bill writes them

  // ── the shipping request lists the cargo ────────────────────────────────────────────
  await page.click('button:has-text("Shipping request")'); await settle(2500);
  const cargo = (await page.locator('.ship-print').innerText()).replace(/\s+/g, ' ');
  expect(cargo).toMatch(/BT-Crete SL|IBTMAX B 1K/);                           // a matched product reached the take-off

  // ── turn it into a purchase order ───────────────────────────────────────────────────
  await page.click('button:has-text("Create an order from this request")');
  await page.waitForSelector('.modal button:has-text("Create order")', { timeout: 15000 }); await settle(2500);
  await page.click('.modal button:has-text("Create order")');
  await page.waitForSelector('.polrow', { timeout: 20000 }); await settle(1000);
  const [po] = await sql(`select id, status from purchase_orders where quotation_id='${q.id}'`);
  expect(po).toBeTruthy(); created.pos.push(po.id);
  const poLines = await sql(`select product_id, qty_ordered from purchase_order_lines where po_id='${po.id}'`);
  expect(poLines.length).toBeGreaterThan(0);
  expect(poLines.every(l => l.product_id && Number(l.qty_ordered) > 0)).toBe(true);

  // ── approve as owner and send ───────────────────────────────────────────────────────
  await page.click('button:has-text("Ask for approval")'); await settle(1200);
  await page.click('button:has-text("Approve")'); await settle(1200);
  await page.click('button:has-text("Mark as sent")'); await settle(1200);
  expect((await sql(`select status from purchase_orders where id='${po.id}'`))[0].status).toBe('sent');

  // ── the printable order carries the cargo, on our letterhead ────────────────────────
  const sheet = (await page.locator('.print-area').textContent()).replace(/\s+/g, ' ');  // hidden print area
  expect(sheet).toMatch(/PURCHASE ORDER/);
  expect(sheet).toMatch(/BT-Crete SL|IBTMAX B 1K/);
});
