// Browser checks, one per Phase 5 fix, run against the local app on the TEST project.
//
//   node tests/checks.js order_lines months          (any subset; no argument runs all)
//
// Each check seeds what it needs, tagged ZZTEST, and removes it again at the end.
const { chromium } = require('@playwright/test');
const { sql, login, go, settle, lit } = require('./lib');

const checks = {};
const fails = [];
const assert = (cond, msg) => { if (!cond) { fails.push(msg); console.log('    ✗', msg); } else console.log('    ✓', msg); };

// F-020: an order with lines shows its lines, its value and its received percentage.
checks.order_lines = async page => {
  const [prod] = await sql("select p.id, p.name from products p join product_packs k on k.product_id=p.id where not k.is_poa limit 1");
  const [po] = await sql(`insert into purchase_orders (reference, supplier, status, currency, eur_aed_rate, notes)
    values ('ZZTEST-PO-1', 'Krypton Chemical S.L.', 'sent', 'EUR', 4.27, 'ZZTEST') returning id`);
  await sql(`insert into purchase_order_lines (po_id, position, product_id, description, unit, packs, qty_ordered, unit_price, list_price, discount_pct, weight_kg)
    values ('${po.id}', 1, '${prod.id}', ${lit(prod.name)}, 'kg', 4, 100, 3.39, 282.50, 70, 100),
           ('${po.id}', 2, '${prod.id}', ${lit(prod.name + ' second line')}, 'kg', 2, 50, 3.39, 282.50, 70, 50)`);
  try {
    await login(page); await go(page, 'Orders');
    // click a middle cell: the rail widens under the pointer and would swallow a click
    // near the left edge of the table
    await page.locator('tr', { hasText: 'ZZTEST-PO-1' }).locator('td').nth(3).click();
    await page.waitForSelector('.polrow', { timeout: 15000 }); await settle(500);
    const rows = await page.locator('.polrow').count();
    assert(rows === 2, `order page shows its 2 lines (saw ${rows})`);
    const value = await page.locator('.cards .card').first().locator('.v').textContent();
    // 508.50 EUR of lines at the order's own rate of 4.27 is AED 2,171
    assert(/2171/.test(value.replace(/,/g, '')), `order value card is the lines' value in dirhams (saw ${value.trim()})`);
    const errs = await page.locator('.err').allTextContents();
    assert(errs.length === 0, `no error banner on the order page (${errs.join(' | ')})`);
  } finally {
    await sql(`delete from purchase_orders where id='${po.id}'`);
  }
};

// F-006: the money in/out chart labels end on the current month, wherever the browser is.
checks.months = async page => {
  await login(page); await go(page, 'Finance');
  await page.click('.subnav button:has-text("Overview")'); await settle(1500);
  const labels = await page.locator('.viz svg text.viz-ax').allTextContents();
  const months = labels.filter(t => /^\d\d\/\d\d$/.test(t));
  const now = new Date(); const want = String(now.getMonth() + 1).padStart(2, '0') + '/' + String(now.getFullYear()).slice(2);
  assert(months.length === 12 || months.length === 0, `twelve month labels or none (saw ${months.length})`);
  if (months.length) assert(months[months.length - 1] === want, `last month label is the current month ${want} (saw ${months[months.length - 1]})`);
  else console.log('    (no payments or costs in the test data, chart empty; the month keys are exercised by the unit check below)');
  const keys = await page.evaluate(() => { const k = []; const n = new Date(); for (let i = 11; i >= 0; i--) { const x = new Date(n.getFullYear(), n.getMonth() - i, 1); k.push(monthKey(x)); } return k; });
  assert(keys[11] === now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0'), `monthKey() of this month is ${keys[11]}`);
  assert(await page.evaluate(() => today()) === now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0'), 'today() is the local date');
};

// F-004 / F-005: a figure follows its own office's money, and the company view adds the two
// offices up in dirhams at the settings rate and says so.
checks.both_mode = async page => {
  const [bru] = await sql("select id from offices where code='BRU'");
  const [dxb] = await sql("select id from offices where code='DXB'");
  await sql(`insert into projects (name, status, value, office_id) values
    ('ZZTEST-BRU project', 'in_progress', 1000, '${bru.id}'), ('ZZTEST-DXB project', 'in_progress', 1000, '${dxb.id}')`);
  const [po] = await sql(`insert into purchase_orders (reference, supplier, status, currency, eur_aed_rate, notes, office_id)
    values ('ZZTEST-PO-BRU', 'Krypton Chemical S.L.', 'sent', 'EUR', 4.27, 'ZZTEST', '${bru.id}') returning id`);
  await sql(`insert into purchase_order_lines (po_id, position, description, unit, packs, qty_ordered, unit_price, weight_kg)
    values ('${po.id}', 1, 'ZZTEST line', 'kg', 1, 10, 10, 10)`);
  const office = async code => { await page.click(`.offsw button:has-text("${code}")`); await settle(1500); };
  const rowText = async name => { const r = page.locator('tr', { hasText: name }); return (await r.count()) ? (await r.first().innerText()).replace(/\s+/g, ' ') : ''; };
  try {
    await login(page); await go(page, 'Projects');
    await office('DXB');
    assert(/AED 1,000/.test(await rowText('ZZTEST-DXB project')), 'Dubai view: the Dubai project reads AED 1,000');
    assert((await rowText('ZZTEST-BRU project')) === '', 'Dubai view: the Bruges project is not listed');
    await office('BOTH');
    assert(/EUR 1\.000/.test(await rowText('ZZTEST-BRU project')), 'company view: the Bruges project row is labelled EUR 1.000');
    assert(/AED 1,000/.test(await rowText('ZZTEST-DXB project')), 'company view: the Dubai project row is labelled AED 1,000');
    const card = (await page.locator('.cards .card').first().innerText()).replace(/\s+/g, ' ');
    assert(/AED 5,270 of work/.test(card), `company view: the work card adds up in dirhams at 4.27 (saw "${card}")`);
    assert(/Belgium counted at 4\.27/.test(card), 'company view: the card says how Belgium was counted');
    await office('BEL');   // the Bruges button is tagged BEL
    assert(/EUR 1\.000/.test(await rowText('ZZTEST-BRU project')), 'Bruges view: the Bruges project reads EUR 1.000');
    await go(page, 'Orders'); await settle(1500);
    const onOrder = (await page.locator('.cards .card').first().innerText()).replace(/\s+/g, ' ');
    assert(/AED 427/.test(onOrder), `Bruges view: a dirham figure is labelled AED, not EUR (saw "${onOrder}")`);
  } finally {
    await sql(`delete from purchase_orders where id='${po.id}'`);
    await sql("delete from projects where name like 'ZZTEST-%'");
  }
};

// F-008: saving a quotation writes the product behind every build-up line that names one.
checks.line_products = async page => {
  const [prod] = await sql("select id, name from products where is_active order by name limit 1");
  const [dxb] = await sql("select id from offices where code='DXB'");
  const [q] = await sql(`insert into quotations (reference, eur_aed_rate, office_id, project_name) values ('ZZTEST-Q-1', 4.27, '${dxb.id}', 'ZZTEST quotation') returning id`);
  const [sec] = await sql(`insert into quotation_sections (quotation_id, position, title) values ('${q.id}', 1, 'Roof') returning id`);
  await sql(`insert into quotation_lines (section_id, position, description, is_costing, unit, quantity, sell_rate, cost_rate) values
    ('${sec.id}', 1, 'Waterproofing to roof', false, 'm²', 100, 65.8, 36.19),
    ('${sec.id}', 2, ${lit(prod.name)}, true, 'kg', 250, null, 15)`);
  try {
    await login(page); await go(page, 'Quotations');
    await page.locator('tr', { hasText: 'ZZTEST-Q-1' }).locator('td').nth(2).click();
    await page.waitForSelector('button:has-text("Save")', { timeout: 15000 }); await settle(1500);
    await page.click('button:has-text("Save")'); await settle(3000);
    const rows = await sql(`select l.description, l.product_id from quotation_lines l join quotation_sections s on s.id=l.section_id where s.quotation_id='${q.id}' order by l.position`);
    assert(rows.length === 2, `the quotation still has its 2 lines after save (saw ${rows.length})`);
    assert(rows[1] && rows[1].product_id === prod.id, 'the build-up line now carries its product id');
    assert(rows[0] && rows[0].product_id === null, 'the priced line, which names no product, carries none');
    const errs = await page.locator('.err').allTextContents();
    assert(errs.length === 0, `no error on the editor (${errs.join(' | ')})`);
  } finally { await sql(`delete from quotations where id='${q.id}'`); }
};

// F-025: an "add a row" that the database refuses shows the refusal and leaves the screen up.
checks.add_row_error = async page => {
  await sql(`create or replace function zztest_refuse() returns trigger language plpgsql as $f$ begin raise exception 'ZZTEST: the bank said no'; end $f$;
    drop trigger if exists zztest_refuse on bank_accounts;
    create trigger zztest_refuse before insert on bank_accounts for each row execute function zztest_refuse()`);
  try {
    await login(page); await go(page, 'Finance');
    await page.click('.subnav button:has-text("Bank accounts")'); await settle(1500);
    await page.click('button:has-text("Add account")'); await settle(1500);
    const err = await page.locator('.err').allTextContents();
    assert(err.some(t => t.includes('ZZTEST: the bank said no')), `the refusal is shown on screen (saw "${err.join(' | ')}")`);
    assert(await page.locator('.page-head h1').count() === 1, 'the screen is still there, not blank');
    assert(await page.locator('button:has-text("Add account")').count() === 1, 'the add button is still there');
  } finally { await sql('drop trigger if exists zztest_refuse on bank_accounts; drop function if exists zztest_refuse()'); }
};

// F-026: held stock and more than is on hand cannot be issued from the screen.
checks.held_stock = async page => {
  // a certified warehouse, one approved product that may move and one still waiting on its approval
  const [wh] = await sql("insert into warehouses (name, dcd_certified, dcd_certificate_ref, dcd_expiry) values ('ZZTEST warehouse', true, 'ZZTEST', current_date + 365) returning id");
  const [dang] = await sql("insert into products (category, name, is_dangerous, dcd_approved) values ((select category from products limit 1), 'ZZTEST dangerous product', true, false) returning id");
  const [safe] = await sql("insert into products (category, name, is_dangerous, dcd_approved, dcd_expiry) values ((select category from products limit 1), 'ZZTEST plain product', false, true, current_date + 365) returning id");
  await sql(`insert into stock_movements (product_id, warehouse_id, direction, quantity) values ('${dang.id}', '${wh.id}', 'in', 10), ('${safe.id}', '${wh.id}', 'in', 10)`);
  const [d] = await sql(`select blocked, block_reason from stock_detail where product_id='${dang.id}' and warehouse_id='${wh.id}'`);
  const field = label => page.locator(`.field:has(> label:has-text("${label}"))`);
  const issue = async (name, qty) => {
    await field('Product').locator('input').fill(name);
    await field('Warehouse').locator('select').selectOption({ label: 'ZZTEST warehouse' });
    await field('In or out').locator('select').selectOption('out');
    await field('Quantity').locator('input').fill(String(qty));
    await page.click('button:has-text("Record movement")'); await settle(1500);
    return (await page.locator('.err').allTextContents()).join(' | ');
  };
  try {
    await login(page); await go(page, 'Stock'); await settle(1000);
    const e1 = await issue('ZZTEST plain product', 50);
    assert(/Only 10/.test(e1), `issuing more than is on hand is refused (saw "${e1}")`);
    if (d && d.blocked) {
      const e2 = await issue('ZZTEST dangerous product', 1);
      assert(/held/.test(e2), `issuing held stock is refused (saw "${e2}")`);
    } else console.log('    (the view does not hold this product here, so only the on-hand check ran)');
    const [left] = await sql(`select sum(case when direction='out' then 1 else 0 end) as outs from stock_movements where warehouse_id='${wh.id}'`);
    assert(Number(left.outs) === 0, 'nothing left the warehouse');
  } finally {
    await sql(`delete from stock_movements where warehouse_id='${wh.id}'; delete from stock where warehouse_id='${wh.id}';
      delete from products where name like 'ZZTEST%'; delete from warehouses where id='${wh.id}'`);
  }
};

// F-042: in the company view a new record goes to the person's own office, and the header says so.
// The company view is the owners' (0068), so the owner is moved to Bruges for the check and back after.
checks.both_stamp = async page => {
  const [bru] = await sql("select id from offices where code='BRU'");
  const [dxb] = await sql("select id from offices where code='DXB'");
  const move = to => sql(`alter table profiles disable trigger profiles_role_is_the_owners;
    update profiles set office_id='${to}' where email='sweep-owner@example.com';
    alter table profiles enable trigger profiles_role_is_the_owners`);
  await move(bru.id);
  try {
    await login(page, 'OWNER'); await page.click('.offsw button:has-text("BOTH")'); await settle(1000);
    const note = (await page.locator('.offnote').count()) ? await page.locator('.offnote').textContent() : '';
    assert(/Bruges/.test(note), `the header says where new records go (saw "${note}")`);
    await go(page, 'Finance'); await page.click('.subnav button:has-text("Bank accounts")'); await settle(1500);
    await page.click('button:has-text("Add account")'); await settle(1500);
    const rows = await sql("select office_id from bank_accounts where name='New account' order by created_at desc limit 1");
    assert(rows.length === 1 && rows[0].office_id === bru.id, "a record added in the company view is filed under the person's own office");
  } finally { await sql("delete from bank_accounts where name='New account'"); await move(dxb.id); }
};

// F-043: receipts are read through their invoice, so one office's chart does not show the other's.
checks.payments_scoped = async page => {
  const [bru] = await sql("select id from offices where code='BRU'");
  const [inv] = await sql(`insert into invoices (reference, status, office_id) values ('ZZTEST-INV-1', 'sent', '${bru.id}') returning id`);
  await sql(`insert into invoice_payments (invoice_id, paid_on, amount) values ('${inv.id}', current_date, 100)`);
  const labels = async () => (await page.locator('.viz svg text.viz-ax').allTextContents()).filter(t => /^\d\d\/\d\d$/.test(t)).length;
  try {
    await login(page); await page.click('.offsw button:has-text("DXB")'); await settle(500);
    await go(page, 'Finance'); await page.click('.subnav button:has-text("Overview")'); await settle(2000);
    assert(await labels() === 0, `Dubai view: a Belgian receipt does not appear in the money chart (saw ${await labels()} labels)`);
    await page.click('.offsw button:has-text("BOTH")'); await settle(2500);
    assert(await labels() === 12, `company view: the receipt appears (saw ${await labels()} labels)`);
  } finally { await sql(`delete from invoice_payments where invoice_id='${inv.id}'; delete from invoices where id='${inv.id}'`); }
};

// F-021: a save that fails halfway leaves the quotation exactly as it was.
checks.save_atomic = async page => {
  const [dxb] = await sql("select id from offices where code='DXB'");
  const [q] = await sql(`insert into quotations (reference, eur_aed_rate, office_id, project_name) values ('ZZTEST-Q-2', 4.27, '${dxb.id}', 'ZZTEST atomic') returning id`);
  const [sec] = await sql(`insert into quotation_sections (quotation_id, position, title) values ('${q.id}', 1, 'Roof') returning id`);
  await sql(`insert into quotation_lines (section_id, position, description, unit, quantity, sell_rate) values
    ('${sec.id}', 1, 'ZZTEST-FAIL line', 'm²', 100, 65.8), ('${sec.id}', 2, 'Second line', 'm²', 10, 5)`);
  await sql(`create or replace function zztest_refuse_line() returns trigger language plpgsql as $f$
      begin if new.description like 'ZZTEST-FAIL%' then raise exception 'ZZTEST: this line is refused'; end if; return new; end $f$;
    drop trigger if exists zztest_refuse_line on quotation_lines;
    create trigger zztest_refuse_line before insert on quotation_lines for each row execute function zztest_refuse_line()`);
  try {
    await login(page); await go(page, 'Quotations');
    await page.locator('tr', { hasText: 'ZZTEST-Q-2' }).locator('td').nth(2).click();
    await page.waitForSelector('button:has-text("Save")', { timeout: 15000 }); await settle(1500);
    await page.click('button:has-text("Save")'); await settle(3000);
    const err = (await page.locator('.err').allTextContents()).join(' | ');
    assert(/ZZTEST: this line is refused/.test(err), `the refusal is reported (saw "${err}")`);
    const [n] = await sql(`select (select count(*)::int from quotation_sections where quotation_id='${q.id}') as sections,
      (select count(*)::int from quotation_lines l join quotation_sections s on s.id=l.section_id where s.quotation_id='${q.id}') as lines`);
    assert(n.sections === 1 && n.lines === 2, `the quotation still has its section and both lines (saw ${n.sections} / ${n.lines})`);
  } finally {
    await sql('drop trigger if exists zztest_refuse_line on quotation_lines; drop function if exists zztest_refuse_line()');
    await sql(`delete from quotations where id='${q.id}'`);
  }
};

// F-024: a quotation that was only looked at is no draft, and a colleague's later save is not hidden under one.
checks.draft_baseline = async page => {
  const [dxb] = await sql("select id from offices where code='DXB'");
  const [q] = await sql(`insert into quotations (reference, eur_aed_rate, office_id, project_name) values ('ZZTEST-Q-3', 4.27, '${dxb.id}', 'ZZTEST draft') returning id`);
  await sql(`insert into quotation_sections (quotation_id, position, title) values ('${q.id}', 1, 'Roof')`);
  const open = async () => { await go(page, 'Quotations'); await page.locator('tr', { hasText: 'ZZTEST-Q-3' }).locator('td').nth(2).click();
    await page.waitForSelector('button:has-text("Save")', { timeout: 15000 }); await settle(2000); };
  const reopen = async () => { await page.reload(); await page.waitForSelector('.deck', { timeout: 30000 }); await open(); };
  const banner = async () => (await page.locator('.flagbox').allTextContents()).join(' | ');
  const projectField = () => page.locator('.field:has(> label:has-text("Project")) input').first();
  try {
    await login(page); await open();
    assert(!/Picked up/.test(await banner()), 'opening a saved quotation shows no draft banner');
    await reopen();
    assert(!/Picked up/.test(await banner()), 'reopening it after a reload still shows none');
    await projectField().fill('ZZTEST draft, edited'); await settle(800);
    await reopen();
    assert(/Picked up where you left off/.test(await banner()), 'an edit left unsaved comes back as a draft');
    assert((await projectField().inputValue()) === 'ZZTEST draft, edited', 'with the edited value on screen');
    await sql(`update quotations set project_name='ZZTEST saved by a colleague' where id='${q.id}'`);
    await reopen();
    const b = await banner();
    assert(/saved on/.test(b) && !/Picked up/.test(b), `a colleague's later save is shown and the draft only offered (saw "${b}")`);
    assert((await projectField().inputValue()) === 'ZZTEST saved by a colleague', 'the saved copy is what is on screen');
    await page.click('button:has-text("Use my unsaved draft")'); await settle(500);
    assert((await projectField().inputValue()) === 'ZZTEST draft, edited', 'and the draft can still be brought back');
  } finally { await sql(`delete from quotations where id='${q.id}'`); }
};

// F-002: an invoice raised in Bruges is numbered, taxed, worded and headed by Bruges.
checks.invoice_office = async page => {
  const [bru] = await sql("select id, invoice_prefix, vat_rate from offices where code='BRU'");
  const [cl] = await sql(`insert into clients (name, kind, office_id) values ('ZZTEST Belgian client', 'client', '${bru.id}') returning id`);
  const field = label => page.locator(`.modal .field:has(> label:has-text("${label}"))`);
  try {
    await login(page, 'FULL'); await settle(800);   // the full user works in Bruges and has no switch to press
    await go(page, 'Finance'); await page.click('.subnav button:has-text("Money in")'); await settle(1500);
    await page.click('button:has-text("New invoice")'); await settle(800);
    await field('Client').locator('select').selectOption({ label: 'ZZTEST Belgian client' });
    const vatOption = await field('VAT').locator('select option').first().textContent().catch(() => '');
    assert(/21% VAT/.test(vatOption), `the VAT choice names the office's rate (saw "${vatOption}")`);
    await page.click('.modal button:has-text("Create")'); await settle(3000);
    const [inv] = await sql(`select id, reference, office_id, vat_rate from invoices where client_id='${cl.id}'`);
    assert(inv && inv.reference.startsWith(bru.invoice_prefix), `the number comes from the Bruges series (saw ${inv && inv.reference})`);
    assert(inv && inv.office_id === bru.id, 'the invoice is filed under Bruges');
    assert(inv && Number(inv.vat_rate) === Number(bru.vat_rate), `the VAT rate is the office's (saw ${inv && inv.vat_rate})`);
    await page.waitForSelector('.iv-words', { state: 'attached', timeout: 15000 });   // the sheet is print-only
    const sheet = (await page.locator('.iv-words').textContent()) + ' ' + (await page.locator('.iv-tot').textContent());
    assert(/euros? only/.test(sheet), `the amount in words is in euros (saw "${sheet.trim().slice(0, 80)}")`);
    assert(/Total due \(EUR\)/.test(sheet), 'the total is marked EUR');
    const head = await page.locator('.pa-co').first().textContent();
    assert(/BUILD-TECH PRO B\.V/.test(head), `the letterhead is the Belgian company (saw "${head}")`);
    const parties = await page.locator('.iv-parties').textContent().catch(() => '');
    const printed = (await page.locator('.pa-co').first().locator('..').textContent());
    assert(/BTW BE 1000\.969\.229/.test(printed), `the tax number is the Belgian BTW (saw "${printed.replace(/\s+/g, ' ').slice(0, 120)}")`);
  } finally {
    await sql(`delete from invoice_lines where invoice_id in (select id from invoices where client_id='${cl.id}');
      delete from invoices where client_id='${cl.id}'; delete from clients where id='${cl.id}'`);
  }
};

// Phase 5 B: draft → waiting for approval → approved (owner only) → sent, with who and when.
checks.po_flow = async page => {
  const [bru] = await sql("select id from offices where code='BRU'");
  const [full] = await sql("select id from profiles where email='sweep-full@example.com'");
  const [owner] = await sql("select id from profiles where email='sweep-owner@example.com'");
  const [po] = await sql(`insert into purchase_orders (reference, supplier, status, currency, eur_aed_rate, notes, office_id)
    values ('ZZTEST-PO-FLOW', 'Krypton Chemical S.L.', 'draft', 'EUR', 4.27, 'ZZTEST', '${bru.id}') returning id`);
  await sql(`insert into purchase_order_lines (po_id, position, description, unit, packs, qty_ordered, unit_price, list_price, discount_pct, weight_kg)
    values ('${po.id}', 1, 'ZZTEST product', 'kg', 2, 50, 3.39, 282.50, 70, 50)`);
  const status = async () => (await sql(`select status, submitted_by, approved_by, approved_at, sent_by, sent_at from purchase_orders where id='${po.id}'`))[0];
  const openOrder = async p => { await go(p, 'Orders'); await p.locator('tr', { hasText: 'ZZTEST-PO-FLOW' }).locator('td').nth(2).click();
    await p.waitForSelector('.flowrow', { timeout: 15000 }); await settle(800); };
  const browser = page.context().browser();
  const ownerCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const op = await ownerCtx.newPage();
  try {
    // a full user asks; the database refuses an approval from them
    await login(page, 'FULL'); await openOrder(page);
    const approvedOpt = page.locator('.field:has(> label:has-text("Status")) select option[value="approved"]');
    assert(await approvedOpt.isDisabled(), 'the status field does not offer "Approved" to a full user');
    // and straight at the database, as that user, past the screen
    const refused = await page.evaluate(id => sb.from('purchase_orders').update({ status: 'approved' }).eq('id', id)
      .then(r => r.error ? r.error.message : 'no error'), po.id);
    assert(/Only an owner can approve/.test(refused), `the database refuses an approval from a full user (saw "${refused}")`);
    assert((await status()).status === 'draft', 'and the order stayed a draft');
    await page.click('button:has-text("Ask for approval")'); await settle(1500);
    let st = await status();
    assert(st.status === 'pending_approval' && st.submitted_by === full.id, `asking records who asked (saw ${st.status}, ${st.submitted_by === full.id})`);
    assert((await page.locator('button:has-text("Approve")').count()) === 0, 'a full user is not offered the approve button');
    assert(/Waiting for an owner/.test(await page.locator('.flowrow').textContent()), 'and is told an owner has to approve it');
    await page.click('button:has-text("All orders")'); await settle(1000);   // back to the list
    await page.click('.subnav button:has-text("Waiting for approval")'); await settle(500);
    assert((await page.locator('tr', { hasText: 'ZZTEST-PO-FLOW' }).count()) === 1, 'the list filter "Waiting for approval" shows it');
    await page.click('.subnav button:has-text("Received")'); await settle(500);
    assert((await page.locator('tr', { hasText: 'ZZTEST-PO-FLOW' }).count()) === 0, 'and the "Received" filter does not');
    await go(page, 'Operations'); await settle(1500);
    const queue = (await page.locator('.queue').first().textContent()).replace(/\s+/g, ' ');
    assert(/ZZTEST-PO-FLOW is waiting for approval/.test(queue), `the home screen queue carries a row for it (saw "${queue.slice(0, 160)}")`);
    // an owner approves and sends
    await login(op, 'OWNER'); await op.click('.offsw button:has-text("BEL")'); await settle(800); await openOrder(op);
    await op.click('button:has-text("Approve")'); await settle(1500);
    st = await status();
    assert(st.status === 'approved' && st.approved_by === owner.id && st.approved_at, `the owner's approval is recorded with who and when (saw ${st.status})`);
    await op.click('button:has-text("Mark as sent")'); await settle(1500);
    st = await status();
    assert(st.status === 'sent' && st.sent_by === owner.id && st.sent_at, `sending records who and when (saw ${st.status})`);
    assert(/Sent by/.test(await op.locator('.flowrow').textContent()), 'and the page says so');
    const sheet = (await op.locator('.print-area').textContent()).replace(/\s+/g, ' ');
    assert(/PURCHASE ORDER/.test(sheet) && /ZZTEST-PO-FLOW/.test(sheet), 'the printable order is on the page');
    assert(/BUILD-TECH PRO B\.V/.test(sheet) && /BTW BE 1000\.969\.229/.test(sheet), `on the Bruges letterhead (saw "${sheet.slice(0, 140)}")`);
    assert(/Total \(EUR\)\s?169\.50/.test(sheet), `with the order total in its own money (saw "${sheet.slice(-120)}")`);
    assert(!/ZZTEST$/.test(sheet) && !/notes/i.test(sheet), 'and without the internal notes');
  } finally {
    await ownerCtx.close();
    await sql(`delete from purchase_orders where id='${po.id}'`);
  }
};

// Phase 5 C: the scope reader's draft carries the bill's words, keeps the reader's notes inside, knows the client.
checks.scope_draft = async page => {
  const text = JSON.parse(require('fs').readFileSync(require('path').join(__dirname, '..', 'docs', 'schema', 'scope_doc.json'), 'utf8'))[0].extracted;
  const [dxb] = await sql("select id from offices where code='DXB'");
  const [cl] = await sql(`insert into clients (name, kind, office_id, notes) values ('Waterfront Market LLC', 'client', '${dxb.id}', 'ZZTEST') returning id`);
  const before = new Set((await sql("select id from quotations")).map(r => r.id));
  const values = () => page.evaluate(() => [...document.querySelectorAll('input[type=text], textarea')].map(x => x.value));
  try {
    await login(page); await page.click('.offsw button:has-text("DXB")'); await settle(500);
    await go(page, 'Quotations'); await page.click('button:has-text("Read a scope")'); await settle(1500);
    await page.fill('textarea.scope-in', text); await page.click('button:has-text("Read it")'); await settle(3000);
    await page.click('button:has-text("Create the draft")'); await page.waitForSelector('.needprice', { timeout: 20000 }); await settle(2500);
    const head = await page.locator('.needprice').textContent();
    assert(/10 of 14 sections still need a price/.test(head), `the editor says how many sections still need a price (saw "${head}")`);
    const banner = (await page.locator('.flagbox').allTextContents()).join(' ');
    assert(/a client on the books/.test(banner) && /none of that prints/.test(banner), `the banner says the client was matched and the reader's notes are inside (saw "${banner.slice(0, 220)}")`);
    assert((await page.locator('.field:has(> label:has-text("Client")) select').first().inputValue()) === cl.id, 'the client on the bill is the client on the quotation');
    const vals = await values();
    assert(vals.some(v => /item 1: taking the old one off/.test(v) && /offered IBTMAX B 1K/.test(v)), "the reader's notes are in the meeting notes");
    assert(!vals.some(v => /To be priced by us|Put a rate on the line above|Offered against/.test(v)), 'no line carries the reader\'s commentary');
    assert(vals.some(v => /^Removal of existing screed with carting away/.test(v)), "the priced line carries the bill's own words");
    assert(vals.some(v => /BT-Crete SL : Approx\. 10,5 kg\/m² at 6 mm\./.test(v)), 'the 6 mm item is costed at 6 mm');
    await page.click('button:has-text("Save")'); await settle(4000);
    const [q] = await sql(`select id, reference, client_id, project_name, meeting_notes, client_reference from quotations where id not in (${[...before].map(x => `'${x}'`).join(',') || "'00000000-0000-0000-0000-000000000000'"})`);
    assert(q && q.client_id === cl.id && /Replacement of Fruits and Vegetable/.test(q.project_name), `the saved quotation has the client and the title (saw ${q && q.reference})`);
    assert(q && q.client_reference === '7089', `the tender reference on the bill is kept on the quotation (saw ${q && JSON.stringify(q.client_reference)})`);
    assert(q && /taking the old one off/.test(q.meeting_notes) && /is measured in lm/.test(q.meeting_notes), 'and the reader\'s notes saved as meeting notes');
    const lines = q ? await sql(`select l.description, l.is_spec_note, l.unit, l.quantity, l.sell_rate from quotation_lines l join quotation_sections s on s.id=l.section_id where s.quotation_id='${q.id}'`) : [];
    const priced = lines.filter(l => !l.is_spec_note);
    assert(priced.length === 14, `14 priced lines saved (saw ${priced.length})`);
    assert(priced.filter(l => /^lm$/i.test(l.unit || '')).every(l => l.sell_rate == null), 'the metre-run lines were left unpriced rather than priced per square metre');
    assert(priced.some(l => l.unit === 'LS') && priced.some(l => l.unit === 'm²') && !priced.some(l => /^(sq\.m|item)$/.test(l.unit || '')),
      `units are kept the way the bill writes them (saw ${[...new Set(priced.map(l => l.unit))].join(', ')})`);
    assert(priced.filter(l => Number(l.sell_rate) > 0).length === 4, `the four square-metre sections with a product were priced (saw ${priced.filter(l => Number(l.sell_rate) > 0).length})`);
    assert(!lines.some(l => /Offered against|To be priced by us|delete this note/.test(l.description)), 'nothing internal went into the printed lines');
  } finally {
    const after = await sql("select id from quotations");
    for (const r of after) if (!before.has(r.id)) await sql(`delete from quotations where id='${r.id}'`);
    await sql(`delete from clients where id='${cl.id}'`);
  }
};

// Phase 5 D: quotation → shipping request → draft order with the cargo lines → approve → send → print.
checks.order_from_request = async page => {
  const [dxb] = await sql("select id from offices where code='DXB'");
  const [prod] = await sql("select p.id, p.name from products p join product_packs k on k.product_id=p.id where not k.is_poa and k.unit ilike 'kg' and p.is_active order by p.name limit 1");
  const [q] = await sql(`insert into quotations (reference, eur_aed_rate, office_id, project_name) values ('ZZTEST-Q-SHIP', 4.27, '${dxb.id}', 'ZZTEST shipping') returning id`);
  const [sec] = await sql(`insert into quotation_sections (quotation_id, position, title) values ('${q.id}', 1, 'Roof') returning id`);
  await sql(`insert into quotation_lines (section_id, position, description, is_spec_note, is_bold, unit, quantity, sell_rate, cost_rate) values
    ('${sec.id}', 1, 'Supply and Install', false, false, 'sq.m', 100, 65.8, 36.19),
    ('${sec.id}', 2, ${lit(prod.name + ' : Approx. 2,50 kg/m².')}, true, true, null, null, null, null)`);
  try {
    await login(page); await page.click('.offsw button:has-text("DXB")'); await settle(500);
    await go(page, 'Quotations'); await page.locator('tr', { hasText: 'ZZTEST-Q-SHIP' }).locator('td').nth(2).click();
    await page.waitForSelector('button:has-text("Shipping request")', { timeout: 15000 }); await settle(1500);
    await page.click('button:has-text("Shipping request")'); await settle(2000);
    const cargo = (await page.locator('.ship-print').textContent()).replace(/\s+/g, ' ');
    assert(cargo.includes(prod.name), `the shipping request lists the product (saw "${cargo.slice(0, 120)}")`);
    await page.click('button:has-text("Create an order from this request")');
    await page.waitForSelector('.modal button:has-text("Create order")', { timeout: 15000 }); await settle(3000);
    const modal = (await page.locator('.modal').textContent()).replace(/\s+/g, ' ');
    assert(modal.includes(prod.name), `the new order is built from the same take-off (saw "${modal.slice(0, 160)}")`);
    await page.click('.modal button:has-text("Create order")'); await page.waitForSelector('.polrow', { timeout: 20000 }); await settle(1500);
    const [po] = await sql(`select id, status, quotation_id from purchase_orders where quotation_id='${q.id}'`);
    assert(po && po.status === 'draft', `a draft order exists against the quotation (saw ${po && po.status})`);
    const lines = po ? await sql(`select description, product_id, packs, qty_ordered, unit_price, weight_kg from purchase_order_lines where po_id='${po.id}'`) : [];
    assert(lines.length === 1 && lines[0].product_id === prod.id && Number(lines[0].packs) > 0 && Number(lines[0].qty_ordered) > 0,
      `the order carries the cargo line with product, packs and quantity (saw ${JSON.stringify(lines)})`);
    await page.click('button:has-text("Ask for approval")'); await settle(1500);
    await page.click('button:has-text("Approve")'); await settle(1500);
    await page.click('button:has-text("Mark as sent")'); await settle(1500);
    const [after] = await sql(`select status from purchase_orders where id='${po.id}'`);
    assert(after.status === 'sent', `approved and sent from the same screen (saw ${after.status})`);
    const sheet = (await page.locator('.print-area').textContent()).replace(/\s+/g, ' ');
    assert(/PURCHASE ORDER/.test(sheet) && sheet.includes(prod.name), 'the printable order carries the product');
  } finally {
    await sql(`delete from purchase_orders where quotation_id='${q.id}'`);
    await sql(`delete from quotations where id='${q.id}'`);
  }
};

// Phase 5 E (F-072): a product can be created from the catalogue, with a pack and a price.
checks.new_product = async page => {
  await login(page); await go(page, 'Catalogue');
  await page.click('button:has-text("New product")'); await settle(600);
  const field = l => page.locator(`.modal .field:has(> label:has-text("${l}")) input`).first();
  await field('Name').fill('ZZTEST New Product');
  await field('Category').fill('flooring');
  await field('Consumption').fill('2.5');
  await field('Pack label').fill('25 kg');
  await field('Pack quantity').fill('25');
  await field('Pack price').fill('100');
  await page.click('.modal button:has-text("Create product")');
  try {
    await page.waitForSelector('.pp-title', { timeout: 15000 }); await settle(500);
    const title = await page.locator('.pp-title').textContent();
    assert(/ZZTEST New Product/.test(title), `the new product page opens (saw "${title}")`);
    const [prod] = await sql("select id, category, consumption_text from products where name='ZZTEST New Product'");
    assert(prod && prod.category === 'flooring', 'the product is saved with its category');
    assert(prod && /2,5/.test(prod.consumption_text || ''), `the consumption is stored (saw "${prod && prod.consumption_text}")`);
    const [pk] = await sql(`select pack_qty, eur_total, eur_per_unit, unit from product_packs where product_id='${prod.id}'`);
    assert(pk && Number(pk.pack_qty) === 25 && Number(pk.eur_total) === 100 && Number(pk.eur_per_unit) === 4,
      `a pack is saved with the per-unit price worked out (saw ${JSON.stringify(pk)})`);
  } finally {
    await sql("delete from product_packs where product_id in (select id from products where name like 'ZZTEST%')");
    await sql("delete from products where name like 'ZZTEST%'");
  }
};

// Phase 5 E + friction H-01: the section picker adds an existing product, and creates a new one.
checks.add_product_editor = async page => {
  const [dxb] = await sql("select id from offices where code='DXB'");
  const [prod] = await sql("select name from products where coverage_max is not null and is_active order by name limit 1");
  const [q] = await sql(`insert into quotations (reference, eur_aed_rate, office_id, project_name) values ('ZZTEST-Q-PICK', 4.27, '${dxb.id}', 'ZZTEST pick') returning id`);
  await sql(`insert into quotation_sections (quotation_id, position, title) values ('${q.id}', 1, 'Roof')`);
  const specValues = () => page.evaluate(() => [...document.querySelectorAll('.lrow.note textarea')].map(x => x.value));
  try {
    await login(page); await page.click('.offsw button:has-text("DXB")'); await settle(400);
    await go(page, 'Quotations');
    await page.locator('tr', { hasText: 'ZZTEST-Q-PICK' }).locator('td').first().click();
    await page.waitForSelector('button:has-text("Add product")', { timeout: 15000 }); await settle(800);
    // pick an existing product
    await page.click('button:has-text("Add product")'); await settle(500);
    await page.fill('.modal input', prod.name.slice(0, 6));
    await page.click('.pickrow'); await settle(600);
    let specs = await specValues();
    assert(specs.some(v => v.includes(prod.name) && /Approx\./.test(v)),
      `picking a product writes a bold spec line with its consumption (saw ${JSON.stringify(specs)})`);
    // create a brand-new product from inside the picker and have it land on the section
    await page.click('button:has-text("Add product")'); await settle(500);
    await page.click('.modal button:has-text("Create new product")'); await settle(500);
    const field = l => page.locator(`.modal .field:has(> label:has-text("${l}")) input`).first();
    await field('Name').fill('ZZTEST Editor Product');
    await field('Category').fill('flooring');
    await field('Consumption').fill('1.5');
    await field('Pack label').fill('20 kg');
    await field('Pack quantity').fill('20');
    await field('Pack price').fill('80');
    await page.click('.modal button:has-text("Create product")'); await settle(1500);
    specs = await specValues();
    assert(specs.some(v => v.includes('ZZTEST Editor Product') && /1,5/.test(v)),
      `a product created in the picker is added to the section (saw ${JSON.stringify(specs)})`);
    // and it is a real catalogue product now
    const made = await sql("select id from products where name='ZZTEST Editor Product'");
    assert(made.length === 1, 'the created product is in the catalogue');
  } finally {
    await sql(`delete from quotations where id='${q.id}'`);
    await sql("delete from product_packs where product_id in (select id from products where name like 'ZZTEST%')");
    await sql("delete from products where name like 'ZZTEST%'");
  }
};

// Phase 5 F (Charles item 1): a product missing a TDS or SDS is flagged everywhere; nothing is blocked.
checks.missing_sheets = async page => {
  await sql("delete from product_documents where product_id in (select id from products where name like $q$ZZTEST%$q$)");
  await sql("delete from products where name like $q$ZZTEST%$q$");
  const cat = (await sql("select category from products limit 1"))[0].category;
  const [bare] = await sql(`insert into products (category, name) values ('${cat}', 'ZZTEST No Docs') returning id`);
  const [full] = await sql(`insert into products (category, name) values ('${cat}', 'ZZTEST Full Docs') returning id`);
  const src = "'https://example.com/zztest'";
  await sql(`insert into product_documents (product_id, doc_type, title, external_url) values
    ('${full.id}', 'tds', 'ZZTEST TDS', ${src}), ('${full.id}', 'sds', 'ZZTEST SDS', ${src})`);
  // 'ZZTEST No Docs' is left with no documents at all
  const cardMiss = name => page.locator(`.prod:has(h3:has-text("${name}")) .docbadge.miss`);
  try {
    await login(page); await go(page, 'Catalogue');
    await page.fill('input[placeholder^="Search"]', 'ZZTEST'); await settle(600);
    assert(await cardMiss('ZZTEST No Docs').count() === 1, 'a product with no sheets is flagged on the grid');
    assert((await cardMiss('ZZTEST No Docs').textContent()) === 'No TDS or SDS', 'and the flag names both as missing');
    assert((await cardMiss('ZZTEST Full Docs').count()) === 0, 'a product with both sheets is not flagged');
    assert(await page.locator(`.prod:has(h3:has-text("ZZTEST No Docs"))`).count() === 1, 'the bare product is listed');
    // the filter keeps only the incomplete ones
    await page.click('button:has-text("Missing sheets")'); await settle(600);
    assert(await page.locator('.prod:has(h3:has-text("ZZTEST No Docs"))').count() === 1, 'the missing filter keeps the incomplete product');
    assert(await page.locator('.prod:has(h3:has-text("ZZTEST Full Docs"))').count() === 0, 'the missing filter drops the complete product');
    // the product page header flag
    await page.click('.prod:has(h3:has-text("ZZTEST No Docs"))'); await settle(800);
    const pill = await page.locator('.pp-head .pill').textContent().catch(() => '');
    assert(/No technical or safety data sheet/.test(pill), `the product page flags the missing sheets (saw "${pill}")`);
    // the home queue row
    await go(page, 'Operations'); await settle(1500);
    const queue = (await page.locator('.queue').first().textContent()).replace(/\s+/g, ' ');
    assert(/missing a data sheet/.test(queue), `the home queue carries a missing-sheet row (saw "${queue.slice(0, 120)}")`);
  } finally {
    await sql("delete from product_documents where product_id in (select id from products where name like 'ZZTEST%')");
    await sql("delete from products where name like 'ZZTEST%'");
  }
};

// Phase 5 G (Charles item 6): the quotation editor is easier without changing the sheet.
checks.friction = async page => {
  const [dxb] = await sql("select id from offices where code='DXB'");
  const [q] = await sql(`insert into quotations (reference, eur_aed_rate, office_id, project_name) values ('ZZTEST-Q-FRICT', 4.27, '${dxb.id}', 'ZZTEST friction') returning id`);
  const [sec] = await sql(`insert into quotation_sections (quotation_id, position, title) values ('${q.id}', 1, 'Roof') returning id`);
  await sql(`insert into quotation_lines (section_id, position, description, unit, quantity, sell_rate) values ('${sec.id}', 1, 'Supply and Install', 'm²', 500, 65.8)`);
  try {
    await login(page); await page.click('.offsw button:has-text("DXB")'); await settle(400);
    await go(page, 'Quotations');
    await page.locator('tr', { hasText: 'ZZTEST-Q-FRICT' }).locator('td').first().click();
    await page.waitForSelector('button:has-text("Add section")', { timeout: 15000 }); await settle(800);
    // H-02: a new section defaults its area and unit from the one before
    await page.click('button:has-text("Add section")'); await settle(500);
    const units = await page.$$eval('input[placeholder="sq.m"]', els => els.map(e => e.value));
    assert(units.length === 2 && units[1] === 'm²', `a new section copies the previous unit (saw ${JSON.stringify(units)})`);
    const qtys = await page.$$eval('input[type=number][placeholder="0"]', els => els.map(e => e.value));
    assert(qtys.length >= 2 && qtys[1] === '500', `and the previous quantity (saw ${JSON.stringify(qtys)})`);
    // H-13: the spec-note box teaches the convention
    await page.locator('button:has-text("Add spec note")').first().click(); await settle(400);
    const ph = await page.locator('.lrow.note textarea').first().getAttribute('placeholder');
    assert(/Approx\. 2,50 kg\/m²/.test(ph || '') && /⌘B/.test(ph || ''), `the spec-note box teaches the convention (saw "${ph}")`);
    // H-03: Save & PDF saves in one step (print dialog stubbed so headless does not block)
    await page.evaluate(() => { window.print = () => {}; });
    assert(await page.locator('button:has-text("Save & PDF")').count() === 1, 'a "Save & PDF" button is offered');
    await page.click('button:has-text("Save & PDF")'); await settle(2500);
    const [after] = await sql(`select updated_at from quotations where id='${q.id}'`);
    assert(!!after.updated_at, 'Save & PDF saved the quotation');
  } finally {
    await sql(`delete from quotations where id='${q.id}'`);
  }
};

// Charles's decisions (11 September 2026): what the database now refuses, attacked through the page's own client.
checks.office_walls = async page => {
  const [dxb] = await sql("select id from offices where code='DXB'");
  const [p] = await sql(`insert into projects (name, status, value, office_id) values ('ZZTEST Dubai-only project', 'in_progress', 1, '${dxb.id}') returning id`);
  try {
    await login(page, 'FULL');   // a Bruges user
    assert((await page.locator('.offsw').count()) === 0, 'a full user is not offered the office switch');
    assert(/Bruges/.test(await page.locator('.offnote').textContent()), 'and is told which office they work in');
    const seen = await page.evaluate(id => sb.from('projects').select('id').eq('id', id).then(r => (r.data || []).length), p.id);
    assert(seen === 0, `a Dubai project is invisible to a Bruges user, even straight at the database (saw ${seen})`);
    const wrote = await page.evaluate(id => sb.from('projects').insert({ name: 'ZZTEST smuggled', status: 'in_progress', value: 1, office_id: id })
      .then(r => r.error ? 'refused' : 'written'), dxb.id);
    assert(wrote === 'refused', `a Bruges user cannot file a record under Dubai (saw ${wrote})`);
    const files = await page.evaluate(() => sb.storage.from('scope-docs').list('DXB').then(r => r.error ? 'refused' : (r.data || []).length));
    assert(files === 'refused' || files === 0, `Dubai's scope documents are not listed for a Bruges user (saw ${files})`);
  } finally { await sql("delete from projects where name like 'ZZTEST%'"); }
};

checks.owner_money = async page => {
  const [dxb] = await sql("select id from offices where code='DXB'");
  const [bru] = await sql("select id from offices where code='BRU'");
  await sql(`insert into payroll (person, kind, amount, office_id) values ('ZZTEST Someone', 'salary', 1000, '${bru.id}')`);
  await sql(`insert into bank_accounts (name, currency, opening_balance, office_id) values ('ZZTEST BRU account', 'EUR', 500, '${bru.id}')`);
  try {
    await login(page, 'FULL');   // Bruges, not an owner
    const pay = await page.evaluate(() => sb.from('payroll').select('id').then(r => (r.data || []).length));
    const bank = await page.evaluate(() => sb.from('bank_accounts').select('id').then(r => (r.data || []).length));
    assert(pay === 0 && bank === 0, `salaries and bank accounts of their own office are hidden from a non-owner (saw ${pay}, ${bank})`);
    await go(page, 'Finance');
    const tabs = (await page.locator('.subnav button').allTextContents()).join('|');
    assert(!/Salaries|Bank accounts/.test(tabs), `the salary and bank tabs are not offered (saw ${tabs})`);
    const card = (await page.locator('.cards .card', { hasText: 'In the bank' }).textContent()).replace(/\s+/g, ' ');
    assert(/owners/.test(card), `the bank card says it is the owners' (saw "${card}")`);
  } finally { await sql("delete from payroll where person like 'ZZTEST%'; delete from bank_accounts where name like 'ZZTEST%'"); }
};

checks.quote_approval = async page => {
  const [bru] = await sql("select id from offices where code='BRU'");
  const [q] = await sql(`insert into quotations (reference, eur_aed_rate, office_id, project_name, status) values ('ZZTEST-Q-APPR', 1, '${bru.id}', 'ZZTEST approval', 'sent') returning id`);
  try {
    await login(page, 'FULL');
    const refused = await page.evaluate(id => sb.from('quotations').update({ status: 'approved' }).eq('id', id).then(r => r.error ? r.error.message : 'allowed'), q.id);
    assert(/Only an owner can mark a quotation approved/.test(refused), `a full user cannot mark a quotation approved (saw "${refused}")`);
    await go(page, 'Quotations'); await page.locator('tr', { hasText: 'ZZTEST-Q-APPR' }).locator('td').nth(2).click();
    await page.waitForSelector('button:has-text("Save")', { timeout: 15000 }); await settle(1000);
    assert(await page.locator('.field:has(> label:has-text("Status")) select option[value="approved"]').isDisabled(), 'and the status field does not offer it');
    const own = await page.evaluate(() => sb.from('profiles').update({ role: 'owner' }).eq('email', 'sweep-full@example.com').then(r => r.error ? r.error.message : 'allowed'));
    assert(/Only an owner can change/.test(own), `a full user cannot make themselves an owner (saw "${own}")`);
    const mv = await page.evaluate(id => sb.from('profiles').update({ office_id: id }).eq('email', 'sweep-full@example.com').then(r => r.error ? r.error.message : 'allowed'),
      (await sql("select id from offices where code='DXB'"))[0].id);
    assert(/Only an owner can move/.test(mv), `nor move themselves to another office (saw "${mv}")`);
  } finally { await sql(`delete from quotations where id='${q.id}'`); }
};

checks.po_numbering = async page => {
  const [bru] = await sql("select id from offices where code='BRU'");
  const before = new Set((await sql("select id from purchase_orders")).map(r => r.id));
  try {
    await login(page, 'FULL');   // Bruges
    await go(page, 'Orders'); await page.click('button:has-text("New order")'); await settle(1500);
    // an order with nothing on it asks to be confirmed once, and the button changes its
    // wording when it does, so it is pressed by position until the form closes
    const create = () => page.locator('.modal .modal-foot button').last().click();
    await create(); await settle(1500);
    if (await page.locator('.modal').count()) await create();
    await page.waitForSelector('.flowrow', { timeout: 20000 }); await settle(1000);
    const made = (await sql("select id, reference, office_id from purchase_orders")).filter(r => !before.has(r.id));
    assert(made.length === 1 && /^PO-BE-\d{4}$/.test(made[0].reference) && made[0].office_id === bru.id,
      `an order raised in Bruges takes a Bruges number (saw ${JSON.stringify(made.map(m => m.reference))})`);
  } finally {
    const made = (await sql("select id from purchase_orders")).filter(r => !before.has(r.id));
    for (const m of made) await sql(`delete from purchase_orders where id='${m.id}'`);
  }
};

checks.books_in_currency = async () => {
  const [bru] = await sql("select id from offices where code='BRU'");
  const [acct] = await sql(`insert into bank_accounts (name, currency, opening_balance, office_id) values ('ZZTEST EUR account', 'EUR', 1000, '${bru.id}') returning id`);
  // amount_aed is worked out by the database from the amount and the rate
  await sql(`insert into expenses (expense_date, kind, category, description, amount, currency, eur_aed_rate, paid_on, bank_account_id, office_id)
    values (current_date, 'expense', 'Other Expenses', 'ZZTEST euro cost', 100, 'EUR', 4.27, current_date, '${acct.id}', '${bru.id}')`);
  await sql(`insert into payroll (person, kind, amount, paid_on, bank_account_id, office_id) values ('ZZTEST Belgian salary', 'salary', 200, current_date, '${acct.id}', '${bru.id}')`);
  try {
    const [c] = await sql(`select spent, wages_and_drawings, balance from cash_position where bank_account_id='${acct.id}'`);
    assert(Number(c.spent) === 100 && Number(c.wages_and_drawings) === 200 && Number(c.balance) === 700,
      `a EUR 100 cost and a EUR 200 salary take EUR 300 off a Belgian account, not 427 and 854 (saw ${JSON.stringify(c)})`);
    const [k] = await sql("select material_cost_aed_m2, sell_aed_m2, margin from catalogue_pricing where kg_per_m2 is not null limit 1");
    assert(Math.abs(Number(k.sell_aed_m2) - Number(k.material_cost_aed_m2) / (1 - Number(k.margin))) < 0.02,
      `the catalogue's sell price is the material cost at the margin, as the editor prices it (saw ${JSON.stringify(k)})`);
  } finally { await sql("delete from payroll where person like 'ZZTEST%'; delete from expenses where description like 'ZZTEST%'; delete from bank_accounts where name like 'ZZTEST%'"); }
};

checks.buildup_note = async page => {
  const [dxb] = await sql("select id from offices where code='DXB'");
  const [q] = await sql(`insert into quotations (reference, eur_aed_rate, office_id, project_name) values ('ZZTEST-Q-TWO', 4.27, '${dxb.id}', 'ZZTEST two prices') returning id`);
  const [sec] = await sql(`insert into quotation_sections (quotation_id, position, title) values ('${q.id}', 1, 'Roof') returning id`);
  await sql(`insert into quotation_lines (section_id, position, description, unit, quantity, sell_rate, is_costing) values
    ('${sec.id}', 1, 'Supply', 'm²', 100, 50, false), ('${sec.id}', 2, 'Application', 'm²', 100, 20, false)`);
  try {
    await login(page); await page.click('.offsw button:has-text("DXB")'); await settle(400);
    await go(page, 'Quotations'); await page.locator('tr', { hasText: 'ZZTEST-Q-TWO' }).locator('td').nth(2).click();
    await page.waitForSelector('.secsaid', { timeout: 15000 });
    const note = await page.locator('.secsaid').first().textContent();
    assert(/Line 2 now counts as build-up/.test(note), `the section says which line the one-price rule moved (saw "${note}")`);
  } finally { await sql(`delete from quotations where id='${q.id}'`); }
};

// Charles, 11 September: typed order lines vanished when "Add a line" was pressed, and the
// columns should read HS code, packs, unit, price per kilo in euros (converted), disc, weight.
checks.order_typing = async page => {
  const [dxb] = await sql("select id from offices where code='DXB'");
  const [po] = await sql(`insert into purchase_orders (reference, supplier, status, currency, eur_aed_rate, notes, office_id)
    values ('ZZTEST-PO-TYPE', 'Krypton Chemical S.L.', 'draft', 'EUR', 4.27, 'ZZTEST', '${dxb.id}') returning id`);
  await sql(`insert into purchase_order_lines (po_id, position, description, unit, packs, pack_label, qty_ordered, unit_price, list_price, discount_pct, weight_kg, hs_code)
    values ('${po.id}', 1, 'IBTMAX B 1K', 'kg', 91, '25 kg', 2275, 3.264, 272, 70, 2275, '39095090')`);
  const rows = () => page.locator('.polrow');
  const box = (r, k) => rows().nth(r).locator('input').nth(k);   // 0 name, 1 HS, 2 packs, 3 unit, 4 price, 5 disc, 6 weight
  const count = n => page.waitForFunction(k => document.querySelectorAll('.polrow').length === k, n, { timeout: 15000 });
  try {
    await login(page); await page.click('.offsw button:has-text("DXB")'); await settle(400);
    await go(page, 'Orders');
    await page.locator('tr', { hasText: 'ZZTEST-PO-TYPE' }).locator('td').nth(3).click();
    await page.waitForSelector('.polrow', { timeout: 15000 }); await settle(600);
    const head = (await page.locator('.polhead').innerText()).replace(/\s+/g, ' ');
    assert(/HS CODE/i.test(head) && /PACKS/i.test(head) && /UNIT/i.test(head) && /PRICE \/ KG \(EUR\)/i.test(head),
      `the columns read HS code, Packs, Unit, Price / kg (EUR) (saw "${head}")`);
    assert(!/ORDERED/i.test(head) && !/LIST\/PACK/i.test(head), 'there is no Ordered or List/pack column');
    assert(await box(0, 4).inputValue() === '10.88', `272 a 25 kg pail reads as 10.88 a kilo (saw ${await box(0, 4).inputValue()})`);
    const row0 = (await rows().nth(0).innerText()).replace(/\s+/g, ' ');
    assert(/AED 46\.46 \/ kg/.test(row0), `the price is shown in dirhams underneath, at the order's 4.27 (saw "${row0}")`);

    await box(0, 5).fill('60');                                        // an unsaved change on the saved line
    await page.click('button:has-text("Add a line")'); await count(2);
    await box(1, 0).fill('PE 100 BT COMP.A 10KG');
    await box(1, 1).fill('39073000');
    await box(1, 2).fill('12');
    assert(await box(1, 6).inputValue() === '120', `twelve 10 kg kits fill in 120 kg (saw ${await box(1, 6).inputValue()})`);
    await box(1, 4).fill('8.35');
    const amt1 = await rows().nth(1).locator('.polval').innerText();
    assert(/1,002\.00/.test(amt1), `120 kg at 8.35 comes to 1,002.00 (saw ${amt1})`);

    await page.click('button:has-text("Add a line")'); await count(3); await settle(500);
    assert(await box(1, 0).inputValue() === 'PE 100 BT COMP.A 10KG' && await box(1, 2).inputValue() === '12'
      && await box(1, 4).inputValue() === '8.35' && await box(1, 6).inputValue() === '120',
      'the typed line survives pressing "Add a line" again');
    assert(await box(0, 5).inputValue() === '60', 'and so does the unsaved discount on the line above');

    await rows().nth(2).locator('button.xbtn').last().click(); await count(2); await settle(400);
    assert(await box(1, 4).inputValue() === '8.35' && await box(0, 5).inputValue() === '60', 'removing a line keeps the typing on the others');

    await page.click('button:has-text("Ask for approval")'); await settle(1500);
    assert(await box(1, 0).inputValue() === 'PE 100 BT COMP.A 10KG' && await box(0, 5).inputValue() === '60',
      'asking for approval keeps the unsaved typing too');

    await page.click('button:has-text("Add a line")'); await count(3); await settle(400);   // left empty on purpose
    await page.click('.page-head button:has-text("Save")'); await settle(3000);
    const saved = await sql(`select description, packs, qty_ordered, unit_price, list_price, discount_pct, weight_kg, hs_code
      from purchase_order_lines where po_id='${po.id}' order by position, description`);
    assert(saved.length === 2, `the line left empty was dropped on save (saw ${saved.length} lines)`);
    const a = saved.find(x => x.description === 'IBTMAX B 1K'), b = saved.find(x => x.description === 'PE 100 BT COMP.A 10KG');
    assert(a && Number(a.discount_pct) === 60 && Math.abs(Number(a.unit_price) - 4.352) < 0.0001 && Number(a.list_price) === 272,
      `at 60% off, 10.88 a kilo is 4.352 and the pail stays 272 (saw ${JSON.stringify(a)})`);
    assert(b && Number(b.qty_ordered) === 120 && Number(b.weight_kg) === 120 && Number(b.unit_price) === 8.35
      && Number(b.list_price) === 83.5 && b.hs_code === '39073000',
      `the new line saved as 120 kg at 8.35, 83.50 a kit, HS 39073000 (saw ${JSON.stringify(b)})`);
    const [st] = await sql(`select status from purchase_orders where id='${po.id}'`);
    assert(st.status === 'pending_approval', `the approval step was kept through the save (saw ${st.status})`);
  } finally { await sql(`delete from purchase_orders where id='${po.id}'`); }
};

// The same loss on other screens: removing one bank account or partner reloaded the screen
// and threw away unsaved typing on the rest.
checks.delete_keeps_typing = async page => {
  const [dxb] = await sql("select id from offices where code='DXB'");
  await sql(`insert into bank_accounts (name, currency, opening_balance, office_id) values
    ('ZZTEST Bank A', 'AED', 0, '${dxb.id}'), ('ZZTEST Bank B', 'AED', 0, '${dxb.id}')`);
  await sql(`insert into partners (name, ownership_pct, share_capital, office_id) values
    ('ZZTEST Partner A', 0, 0, '${dxb.id}'), ('ZZTEST Partner B', 0, 0, '${dxb.id}')`);
  page.on('dialog', d => d.accept());
  try {
    await login(page); await page.click('.offsw button:has-text("DXB")'); await settle(400);
    await go(page, 'Finance'); await page.click('.subnav button:has-text("Bank accounts")'); await settle(1500);
    const accts = () => page.$$eval('.field', fs => fs.filter(f => /Account name/.test((f.querySelector('label') || {}).textContent || ''))
      .map(f => f.querySelector('input').value));
    let list = await accts();
    const ia = list.indexOf('ZZTEST Bank A'), ib = list.indexOf('ZZTEST Bank B');
    await page.locator('.field:has(> label:has-text("Account name")) input').nth(ia).fill('ZZTEST Bank A renamed');
    await page.locator('button:has-text("Remove this account")').nth(ib).click(); await settle(1500);
    list = await accts();
    assert(!list.includes('ZZTEST Bank B') && list.includes('ZZTEST Bank A renamed'),
      `removing one account keeps the other's unsaved name (saw ${JSON.stringify(list)})`);

    await page.click('.subnav button:has-text("Salaries and partners")'); await settle(1500);
    const names = () => page.$$eval('.prow', rs => rs.map(r => (r.querySelector('input') || {}).value));
    let pl = await names();
    const pa = pl.indexOf('ZZTEST Partner A'), pb = pl.indexOf('ZZTEST Partner B');
    await page.locator('.prow').nth(pa).locator('input').first().fill('ZZTEST Partner A renamed');
    await page.locator('.prow').nth(pb).locator('button.xbtn').click(); await settle(1500);
    pl = await names();
    assert(!pl.includes('ZZTEST Partner B') && pl.includes('ZZTEST Partner A renamed'),
      `removing one partner keeps the other's unsaved name (saw ${JSON.stringify(pl)})`);
  } finally {
    await sql("delete from bank_accounts where name like 'ZZTEST%'; delete from partners where name like 'ZZTEST%'");
  }
};

// A realistic supplier invoice, rendered in a page and captured as a PNG, the way a
// screenshot of one arrives. Returns the picture and what is printed on it.
async function invoicePicture(browser, printed) {
  const ctx = await browser.newContext({ viewport: { width: 820, height: 900 } });
  const p = await ctx.newPage();
  await p.setContent(`<div style="font-family:Arial,sans-serif;padding:40px;width:720px;color:#111">
    <div style="display:flex;justify-content:space-between"><div><b style="font-size:20px">${printed.supplier}</b><br>
    Dubai Silicon Oasis, Dubai, United Arab Emirates<br>TRN 100234567800003</div>
    <div style="text-align:right"><b style="font-size:24px">TAX INVOICE</b><br>Invoice No: ${printed.number}<br>
    Date: ${printed.dateText}<br>Due: ${printed.dueText}</div></div>
    <p style="margin-top:28px">Bill to: BUILD TECH PROTECTION MATERIALS L.L.C</p>
    <table style="width:100%;border-collapse:collapse;margin-top:12px" border="1" cellpadding="8">
      <tr style="background:#eee"><th align="left">Description</th><th align="right">Amount AED</th></tr>
      <tr><td>${printed.item}</td><td align="right">${printed.subtotalText}</td></tr>
      <tr><td>VAT 5%</td><td align="right">${printed.vatText}</td></tr>
      <tr><td><b>Total payable AED</b></td><td align="right"><b>${printed.totalText}</b></td></tr></table>
    <p style="margin-top:24px">Payment by bank transfer within 30 days.</p></div>`);
  const buffer = await p.screenshot({ fullPage: true });
  await ctx.close();
  return buffer;
}
const formValues = page => page.evaluate(() => Object.fromEntries([...document.querySelectorAll('.panel .field')]
  .filter(f => f.querySelector('label') && f.querySelector('input,select'))
  .map(f => [f.querySelector('label').textContent.trim(), f.querySelector('input,select').value])));

// Charles, 11 September: upload an invoice, or a screenshot of one, and the cost fills itself in.
checks.invoice_reader_ui = async page => {
  const answer = {
    is_invoice: true, supplier: 'ZZTEST Green Ocean Businessmen Services FZCO', invoice_number: 'GO-INV-4471',
    invoice_date: '2026-09-03', due_date: '2026-10-03', is_paid: false, currency: 'AED',
    subtotal: 16523.81, vat: 826.19, total: 17350, description: 'ZZTEST Trade licence renewal package',
    category: 'Trade licence', doubts: ['The date 03/09/2026 was read as 3 September.'],
  };
  let sent = null, reply = answer;
  await page.route('**/functions/v1/read-invoice', async route => {
    if (route.request().method() === 'OPTIONS') return route.continue();
    const body = route.request().postDataJSON() || {};
    const cors = { 'Access-Control-Allow-Origin': 'http://127.0.0.1:5173' };
    // the page asks, with nothing attached, whether the reader is switched on
    if (!body.data) return route.fulfill({ status: 400, contentType: 'application/json', headers: cors,
      body: JSON.stringify({ error: 'Send a PDF, or a JPEG, PNG, WebP or GIF picture of the invoice.' }) });
    sent = body;
    await route.fulfill({ status: 200, contentType: 'application/json', headers: cors, body: JSON.stringify({ invoice: reply }) });
  });
  const picture = await invoicePicture(page.context().browser(), { supplier: 'Green Ocean Businessmen Services FZCO',
    number: 'GO-INV-4471', dateText: '03/09/2026', dueText: '03/10/2026', item: 'Trade licence renewal package',
    subtotalText: '16,523.81', vatText: '826.19', totalText: '17,350.00' });
  try {
    await login(page); await page.click('.offsw button:has-text("DXB")'); await settle(400);
    await go(page, 'Finance'); await page.click('.subnav button:has-text("Money out")'); await settle(1500);
    await page.waitForSelector('label.invpick', { timeout: 15000 });
    assert(true, 'a reader that is switched on is offered on Money out');
    await page.locator('label.invpick input[type=file]').setInputFiles({ name: 'invoice.png', mimeType: 'image/png', buffer: picture });
    await page.waitForSelector('.flagbox.invread', { timeout: 20000 }); await settle(400);
    assert(sent && sent.media_type === 'image/jpeg' && sent.data.length > 1000, `the picture was sent as a JPEG (saw ${sent && sent.media_type})`);
    const dims = await page.evaluate(b64 => new Promise(ok => { const i = new Image(); i.onload = () => ok([i.naturalWidth, i.naturalHeight]); i.src = 'data:image/jpeg;base64,' + b64; }), sent.data);
    assert(Math.max(...dims) <= 2000, `and no bigger than 2000 pixels (saw ${dims.join('x')})`);
    const v = await formValues(page);
    assert(v['Date'] === '2026-09-03' && v['Supplier'] === answer.supplier && v['Reference'] === 'GO-INV-4471'
      && v['Amount'] === '17350' && v['Currency'] === 'AED' && v['Category'] === 'Trade licence'
      && v['What was it for'] === answer.description && v['Paid on, leave blank if still owed'] === '',
      `the form is filled from the invoice, left owed (saw ${JSON.stringify(v)})`);
    const marked = await page.locator('.field.filled').count();
    assert(marked >= 7, `the boxes it filled are marked (saw ${marked})`);
    const note = (await page.locator('.flagbox.invread').innerText()).replace(/\s+/g, ' ');
    assert(/Read from invoice\.png/.test(note) && /AED 17,350\.00/.test(note) && /including 826\.19 VAT/.test(note)
      && /still owed/.test(note) && /read as 3 September/.test(note), `the note says what was read and what is in doubt (saw "${note}")`);
    const [none] = await sql("select count(*)::int as n from expenses where reference='GO-INV-4471'");
    assert(none.n === 0, 'nothing is saved before Add cost');
    await page.locator('.field:has(> label:has-text("Supplier")) input').fill('ZZTEST Green Ocean FZCO');
    assert(!(await page.locator('.field.filled:has(> label:has-text("Supplier"))').count()), 'a box that is changed loses its mark');
    await page.click('button:has-text("Add cost")'); await settle(2000);
    const [row] = await sql("select supplier, reference, amount, currency, category, expense_date, paid_on from expenses where reference='GO-INV-4471'");
    assert(row && row.supplier === 'ZZTEST Green Ocean FZCO' && Number(row.amount) === 17350 && row.currency === 'AED'
      && row.category === 'Trade licence' && row.expense_date === '2026-09-03' && row.paid_on === null,
      `Add cost saves what was checked (saw ${JSON.stringify(row)})`);
    assert(!(await page.locator('.flagbox.invread').count()), 'and the note goes');

    // a receipt in dollars: paid, and the currency left for a person
    reply = { ...answer, invoice_number: 'ZZTEST-USD-1', currency: 'USD', total: 99, subtotal: null, vat: null, is_paid: true, doubts: [] };
    await page.evaluate(b64 => {
      const bin = atob(b64); const bytes = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const dt = new DataTransfer(); dt.items.add(new File([bytes], 'screenshot.png', { type: 'image/png' }));
      window.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt }));
    }, picture.toString('base64'));
    await page.waitForFunction(() => /screenshot\.png/.test((document.querySelector('.flagbox.invread') || {}).textContent || ''), null, { timeout: 20000 });
    const note2 = (await page.locator('.flagbox.invread').innerText()).replace(/\s+/g, ' ');
    const v2 = await formValues(page);
    assert(/It is in USD/.test(note2) && v2['Currency'] === 'AED', `a pasted screenshot is read, and USD is flagged rather than guessed (saw "${note2}", currency ${v2['Currency']})`);
    assert(v2['Paid on, leave blank if still owed'] === '2026-09-03', `a paid receipt is dated paid on its own date (saw ${v2['Paid on, leave blank if still owed']})`);

    // the reader saying no is said on screen
    await page.unroute('**/functions/v1/read-invoice');
    await page.route('**/functions/v1/read-invoice', async route => {
      if (route.request().method() === 'OPTIONS') return route.continue();
      await route.fulfill({ status: 503, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': 'http://127.0.0.1:5173' },
        body: JSON.stringify({ error: 'ZZTEST: the reader is resting.' }) });
    });
    await page.locator('label.invpick input[type=file]').setInputFiles({ name: 'invoice.png', mimeType: 'image/png', buffer: picture });
    await settle(3000);
    const err = (await page.locator('.err').allTextContents()).join(' | ');
    assert(/ZZTEST: the reader is resting\./.test(err), `the reader's own reason is shown when it refuses (saw "${err}")`);
  } finally {
    await sql("delete from expenses where reference in ('GO-INV-4471','ZZTEST-USD-1') or description like 'ZZTEST%'");
  }
};

// The real reader, end to end: a screenshot of an invoice goes to the deployed function.
// Until the Anthropic key is set on the function, the page must say it is not switched on.
checks.invoice_reader_live = async page => {
  const picture = await invoicePicture(page.context().browser(), { supplier: 'Green Ocean Businessmen Services FZCO',
    number: 'GO-INV-4471', dateText: '03/09/2026', dueText: '03/10/2026', item: 'Trade licence renewal package',
    subtotalText: '16,523.81', vatText: '826.19', totalText: '17,350.00' });
  await login(page); await page.click('.offsw button:has-text("DXB")'); await settle(400);
  await go(page, 'Finance'); await page.click('.subnav button:has-text("Money out")'); await settle(3000);
  if (!(await page.locator('label.invpick').count())) {
    const [{ n }] = await sql("select count(*)::int as n from expenses where description like 'ZZTEST%'");
    assert(n === 0, 'without its key the reader is not offered on Money out, and nothing was written');
    console.log('    (the Anthropic key is not set on the test function yet, so the reading itself was not exercised)');
    return;
  }
  const started = Date.now();
  await page.locator('label.invpick input[type=file]').setInputFiles({ name: 'invoice.png', mimeType: 'image/png', buffer: picture });
  await page.waitForFunction(() => document.querySelector('.flagbox.invread') || document.querySelector('.err'), null, { timeout: 150000 });
  const seconds = Math.round((Date.now() - started) / 100) / 10;
  const err = (await page.locator('.err').allTextContents()).join(' | ');
  assert(!err, `no error from the live reader (saw "${err}")`);
  const v = await formValues(page);
  const note = (await page.locator('.flagbox.invread').innerText()).replace(/\s+/g, ' ');
  assert(/Green Ocean/i.test(v['Supplier'] || ''), `the supplier was read (saw "${v['Supplier']}")`);
  assert((v['Reference'] || '').replace(/\s/g, '') === 'GO-INV-4471', `the invoice number was read (saw "${v['Reference']}")`);
  assert(v['Amount'] === '17350', `the total payable was read (saw "${v['Amount']}")`);
  assert(v['Currency'] === 'AED', `the currency was read (saw "${v['Currency']}")`);
  assert(v['Date'] === '2026-09-03', `03/09/2026 was read day first (saw "${v['Date']}")`);
  assert(/826\.19/.test(note), `the VAT was read (saw "${note}")`);
  console.log(`    (read in ${seconds}s; category "${v['Category']}"; note: ${note.slice(0, 160)})`);
};

// Recording a movement or a reorder level reloaded the whole Stock screen and threw away
// unsaved typing on the warehouses; ticking a requirement did the same to an approval's form.
checks.stock_keeps_typing = async page => {
  const [dxb] = await sql("select id from offices where code='DXB'");
  const [wh] = await sql(`insert into warehouses (name, dcd_certified, dcd_certificate_ref, dcd_expiry, office_id)
    values ('ZZTEST WH Keep', true, 'ZZTEST', current_date + 365, '${dxb.id}') returning id`);
  const [prod] = await sql(`insert into products (category, name, dcd_approved, dcd_expiry)
    values ((select category from products limit 1), 'ZZTEST Stock Keep', true, current_date + 365) returning id`);
  await sql(`insert into stock_movements (product_id, warehouse_id, direction, quantity, office_id) values ('${prod.id}', '${wh.id}', 'in', 10, '${dxb.id}')`);
  const whPanel = () => page.locator('.panel:has(h2:has-text("Warehouses"))');
  const noteOfTest = async () => {
    const names = await whPanel().locator('.field:has(> label:has-text("Name")) input').evaluateAll(els => els.map(e => e.value));
    const i = names.indexOf('ZZTEST WH Keep');
    return i < 0 ? null : whPanel().locator('.field:has(> label:has-text("Notes")) input').nth(i);
  };
  const field = l => page.locator(`.field:has(> label:has-text("${l}"))`).first();
  try {
    await login(page); await page.click('.offsw button:has-text("DXB")'); await settle(400);
    await go(page, 'Stock'); await settle(1500);
    await (await noteOfTest()).fill('ZZTEST unsaved note');
    await field('Product').locator('input').fill('ZZTEST Stock Keep');
    await field('Warehouse').locator('select').selectOption({ label: 'ZZTEST WH Keep' });
    await field('In or out').locator('select').selectOption('in');
    await field('Quantity').locator('input').fill('5');
    await page.click('button:has-text("Record movement")'); await settle(2000);
    const ok = (await page.locator('.ok').allTextContents()).join(' | ');
    assert(/Received 5 of ZZTEST Stock Keep/.test(ok), `the movement was recorded (saw "${ok}")`);
    assert(await (await noteOfTest()).inputValue() === 'ZZTEST unsaved note', 'recording a movement keeps the unsaved warehouse note');
    const reorderBox = page.locator('tr', { hasText: 'ZZTEST Stock Keep' }).locator('input').first();
    await reorderBox.fill('3'); await reorderBox.press('Tab'); await settle(2000);
    const [st] = await sql(`select reorder_level from stock where product_id='${prod.id}' and warehouse_id='${wh.id}'`);
    assert(st && Number(st.reorder_level) === 3, `the reorder level was saved (saw ${st && st.reorder_level})`);
    assert(await (await noteOfTest()).inputValue() === 'ZZTEST unsaved note', 'setting a reorder level keeps it too');
  } finally {
    await sql(`delete from stock_movements where product_id='${prod.id}'; delete from stock where product_id='${prod.id}';
      delete from products where id='${prod.id}'; delete from warehouses where id='${wh.id}'`);
  }
};

checks.approval_keeps_typing = async page => {
  const [dxb] = await sql("select id from offices where code='DXB'");
  const [ap] = await sql(`insert into approvals (title, kind, status, office_id) values ('ZZTEST Approval Keep', 'other', 'submitted', '${dxb.id}') returning id`);
  await sql(`insert into approval_requirements (approval_id, position, title) values ('${ap.id}', 1, 'ZZTEST Req 1'), ('${ap.id}', 2, 'ZZTEST Req 2')`);
  const next = () => page.locator('.field:has(> label:has-text("Next action")) input').first();
  try {
    await login(page); await page.click('.offsw button:has-text("DXB")'); await settle(400);
    await go(page, 'Approvals'); await settle(1000);
    await page.locator('tr', { hasText: 'ZZTEST Approval Keep' }).locator('td').nth(1).click();
    await page.waitForSelector('.reqrow', { timeout: 15000 }); await settle(500);
    await next().fill('ZZTEST unsaved next step');
    await page.locator('.reqrow', { hasText: 'ZZTEST Req 1' }).locator('button.reqtick').click(); await settle(1500);
    assert(await next().inputValue() === 'ZZTEST unsaved next step', 'ticking a requirement keeps the unsaved next action');
    const tick = await page.locator('.reqrow', { hasText: 'ZZTEST Req 1' }).locator('button.reqtick').innerText();
    assert(tick.trim() === '✓', `the requirement shows as sent (saw "${tick}")`);
    const [rq] = await sql(`select provided, provided_on from approval_requirements where approval_id='${ap.id}' and title='ZZTEST Req 1'`);
    assert(rq && rq.provided === true && !!rq.provided_on, `and it was saved as sent (saw ${JSON.stringify(rq)})`);
    const head = (await page.locator('.panel-head', { hasText: 'What they asked for' }).innerText()).replace(/\s+/g, ' ');
    assert(/1 of 2 sent/.test(head), `the count follows the tick (saw "${head}")`);
  } finally {
    await sql(`delete from approval_requirements where approval_id='${ap.id}'; delete from approvals where id='${ap.id}'`);
  }
};

// Tenders 7089 and 7090: one of our own quotation sheets, uploaded as a PDF, comes in with every field
// on it, and saved it adds up to the subtotal the sheet printed. The two PDFs carry a client's prices,
// so they are read from outside the repo: TENDER_DIR, or the Desktop folder they arrived in.
checks.quotation_sheet = async page => {
  const fs = require('fs'), path = require('path');
  const dir = process.env.TENDER_DIR || path.join(require('os').homedir(), 'Desktop', 'build---tech');
  const cases = [
    { file: '0732 - TENDER 7090.pdf', ref: '7090', subtotal: 7692847, printed: '7,692,847', sections: 6,
      units: ['m²', 'm²', 'm²', 'LS', 'm²', 'm²'] },
    { file: '0731 - TENDER 7089.pdf', ref: '7089', subtotal: 3843812.8, printed: '3,843,813', sections: 7,
      units: ['sq.m', 'sq.m', 'sq.m', 'm', 'm', 'm', 'm'] },
  ].filter(c => fs.existsSync(path.join(dir, c.file)));
  if (!cases.length) { console.log('    (skipped: the tender PDFs are not in ' + dir + ')'); return; }
  const [{ now: start }] = await sql('select now()::text as now');
  const [{ quote_next: counter }] = await sql("select quote_next from offices where code='DXB'");
  try {
    await login(page); await page.click('.offsw button:has-text("DXB")'); await settle(400);
    await go(page, 'Quotations');
    for (const c of cases) {
      console.log('   ', c.file);
      await page.click('button:has-text("Read a scope")'); await settle(1200);
      await page.setInputFiles('.dropzone input[type=file]', path.join(dir, c.file));
      await page.waitForSelector('h1:has-text("What it read")', { timeout: 40000 }); await settle(800);
      const cards = (await page.locator('.cards').innerText()).replace(/\s+/g, ' ');
      assert(/The same as the sheet/.test(cards), `the review says the lines add up to the sheet's subtotal (saw "${cards.slice(0, 160)}")`);
      const facts = (await page.locator('dl.kv').innerText()).replace(/\s+/g, ' ');
      assert(facts.includes(c.ref) && /P O Box: 65565/.test(facts) && /Not applied/.test(facts),
        `the review shows the tender reference, the client's address and the tax (saw "${facts.slice(0, 220)}")`);
      await page.click('button:has-text("Create the draft")');
      await page.waitForSelector('.qhead', { timeout: 20000 }); await settle(1500);
      // the client is offered, not created; the first sheet adds it, the second finds it on the books
      const offer = page.locator('.flagbox button:has-text("Add as a client")');
      if (await offer.count()) { await offer.click(); await page.waitForSelector('.flagbox button:has-text("Add as a client")', { state: 'detached', timeout: 15000 }); }
      assert(await page.locator('.field:has(> label:has-text("Tender / client ref.")) input').inputValue() === c.ref, 'the tender reference is in its own box');
      await page.click('.page-head button:text-is("Save")');
      await page.waitForSelector('.ok:has-text("Saved")', { timeout: 30000 }); await settle(1000);
      const [q] = await sql(`select * from quotations where created_at >= ${lit(start)}::timestamptz and client_reference=${lit(c.ref)} order by created_at desc limit 1`);
      assert(!!q, 'the quotation was saved');
      if (!q) continue;
      assert(q.project_name === 'Epoxy - Waterproof' && q.quote_date === '2026-09-12' && q.vat_applies === false,
        `the reference, the sheet's date and no tax are on it (saw ${q.project_name} / ${q.quote_date} / ${q.vat_applies})`);
      assert(/m² - net floor surface area/.test(q.remarks || '') && !/m2 - net/.test(q.remarks || ''), "the sheet's own remarks replace the standard ones");
      assert(/Read from quotation 0?73[12] BT/.test(q.meeting_notes || ''), 'where it was read from is in the meeting notes');
      const [cl] = await sql(`select name, location from clients where id='${q.client_id}'`);
      assert(cl && cl.name === 'Waterfront Market LLC' && cl.location === 'P O Box: 65565, Dubai, UAE', `the client is on the books with the sheet's address (saw ${JSON.stringify(cl)})`);
      const secs = await sql(`select s.position, s.is_optional, l.position as lp, l.description, l.is_spec_note, l.is_bold, l.unit
        from quotation_sections s join quotation_lines l on l.section_id=s.id where s.quotation_id='${q.id}' order by s.position, l.position`);
      const priced = secs.filter(l => !l.is_spec_note);
      assert(new Set(secs.map(l => l.position)).size === c.sections && secs.every(l => l.is_optional === false),
        `${c.sections} sections, none left out of the total, as the sheet has them`);
      assert(JSON.stringify(priced.map(l => l.unit)) === JSON.stringify(c.units), `units as the sheet writes them (saw ${priced.map(l => l.unit).join(', ')})`);
      const [t] = await sql(`select subtotal from quotation_totals where quotation_id='${q.id}'`);
      assert(Math.abs(Number(t.subtotal) - c.subtotal) < 0.005, `the saved subtotal is exactly the sheet's ${c.subtotal} (saw ${t.subtotal})`);
      const sheet = (await page.locator('.print-area').textContent()).replace(/\s+/g, ' ');
      assert(sheet.includes('Tender Ref. :' + c.ref) && new RegExp('SUBTOTAL ?' + c.printed + ' AED').test(sheet) && !/not included in the total/.test(sheet),
        `the printed sheet carries the tender reference and the subtotal (saw ${(sheet.match(/SUBTOTAL ?[\d,]+ AED/) || [])[0]})`);
      if (c.ref === '7090') {
        assert(secs.some(l => l.description === 'PU-SYSTEM:' && l.is_bold) && secs.some(l => /^\*\*Note:\*\* The above lump sum/.test(l.description)),
          'the headings the sheet prints in bold stay bold');
      } else {
        assert(secs.some(l => /high adhesion “links” between the substrate/.test(l.description)), 'the text in the second font reads as words');
        assert(priced.some(l => l.description === 'Supply and Install: **Provisional Quantity**'), 'the stressed words on a priced line stay bold');
      }
      await page.click('button:has-text("All quotations")'); await settle(1500);
    }
  } finally {
    const qs = await sql(`select id from quotations where created_at >= ${lit(start)}::timestamptz`);
    const docs = await sql(`select id, file_path from scope_documents where created_at >= ${lit(start)}::timestamptz`);
    const paths = docs.map(d => d.file_path).filter(Boolean);
    if (paths.length) { try { await page.evaluate(p => sb.storage.from('scope-docs').remove(p), paths); } catch (e) { console.log('    ✗ could not remove the stored PDFs:', e.message); } }
    const cls = await sql(`select id from clients where created_at >= ${lit(start)}::timestamptz`);
    const ids = [...qs, ...cls, ...docs].map(r => `'${r.id}'`);
    if (qs.length) await sql(`delete from quotations where id in (${qs.map(r => `'${r.id}'`).join(',')})`);
    if (docs.length) await sql(`delete from scope_documents where id in (${docs.map(r => `'${r.id}'`).join(',')})`);
    if (cls.length) await sql(`delete from clients where id in (${cls.map(r => `'${r.id}'`).join(',')})`);
    if (ids.length) await sql(`delete from activity_log where happened_at >= ${lit(start)}::timestamptz and row_id::text in (${ids.join(',')})`);
    await sql(`update offices set quote_next=${Number(counter)} where code='DXB'`);
    const [left] = await sql(`select (select count(*)::int from quotations where created_at >= ${lit(start)}::timestamptz) q,
      (select count(*)::int from scope_documents where created_at >= ${lit(start)}::timestamptz) d,
      (select count(*)::int from clients where created_at >= ${lit(start)}::timestamptz) c`);
    assert(left.q === 0 && left.d === 0 && left.c === 0, `nothing it created is left behind (saw ${JSON.stringify(left)})`);
  }
};

// The optional section and the tender reference: an option is priced on the sheet and left out of every
// total, the reference prints under the client, and a quotation using neither prints as it always did.
checks.optional_section = async page => {
  const [dxb] = await sql("select id from offices where code='DXB'");
  const [q] = await sql(`insert into quotations (reference, eur_aed_rate, office_id, project_name, vat_applies) values ('ZZTEST-Q-OPT', 4.27, '${dxb.id}', 'ZZTEST optional', false) returning id`);
  const [s1] = await sql(`insert into quotation_sections (quotation_id, position, title) values ('${q.id}', 1, 'Floor') returning id`);
  const [s2] = await sql(`insert into quotation_sections (quotation_id, position, title) values ('${q.id}', 2, 'Soffits') returning id`);
  await sql(`insert into quotation_lines (section_id, position, description, unit, quantity, sell_rate) values
    ('${s1.id}', 1, 'Floor coating', 'm²', 100, 50), ('${s2.id}', 1, 'Soffit coating', 'm²', 10, 55)`);
  const sheet = async () => (await page.locator('.print-area').textContent()).replace(/\s+/g, ' ');
  try {
    await login(page); await page.click('.offsw button:has-text("DXB")'); await settle(400);
    await go(page, 'Quotations'); await settle(800);
    const row = page.locator('tr', { hasText: 'ZZTEST-Q-OPT' });
    const margin = (await row.locator('td').last().innerText()).trim();
    assert(margin === '—', `a quotation with no cost on it shows no margin in the list rather than 100% (saw "${margin}")`);
    await row.locator('td').first().click();
    await page.waitForSelector('.qhead', { timeout: 15000 }); await settle(800);
    let text = await sheet();
    assert(/1\. Floor/.test(text) && !/not included in the total/.test(text) && !/Tender Ref/.test(text), 'before: no optional marker and no tender row on the sheet');
    assert(/SUBTOTAL ?5,550 AED/.test(text), `before: the subtotal counts both sections (saw ${(text.match(/SUBTOTAL ?[\d,]+ AED/) || [])[0]})`);
    await page.locator('.sec-box').nth(1).locator('button.xbtn.tag', { hasText: 'optional' }).click(); await settle(400);
    await page.locator('.field:has(> label:has-text("Tender / client ref.")) input').fill('ZZTEST-7090'); await settle(400);
    const tot = (await page.locator('.totmain .tot').first().innerText()).replace(/\s+/g, ' ');
    assert(/Subtotal AED 5,000\.00/.test(tot), `the editor's subtotal leaves the optional section out (saw "${tot}")`);
    text = await sheet();
    assert(/2\. Soffits \(optional, not included in the total\)/.test(text), 'the sheet marks the optional section');
    assert(/550 AED/.test(text) && /SUBTOTAL ?5,000 AED/.test(text), `it still prints its price, and leaves it out of the subtotal (saw ${(text.match(/SUBTOTAL ?[\d,]+ AED/) || [])[0]})`);
    assert(/Tender Ref\. : ?ZZTEST-7090/.test(text), 'the tender reference prints under the client');
    await page.click('.page-head button:text-is("Save")'); await page.waitForSelector('.ok:has-text("Saved")', { timeout: 20000 }); await settle(800);
    const [t] = await sql(`select subtotal from quotation_totals where quotation_id='${q.id}'`);
    assert(Number(t.subtotal) === 5000, `quotation_totals leaves the optional section out (saw ${t.subtotal})`);
    const secs = await sql(`select position, is_optional from quotation_sections where quotation_id='${q.id}' order by position`);
    assert(secs.length === 2 && secs[0].is_optional === false && secs[1].is_optional === true, `the flag is saved on the section (saw ${JSON.stringify(secs)})`);
    const [qq] = await sql(`select client_reference from quotations where id='${q.id}'`);
    assert(qq.client_reference === 'ZZTEST-7090', 'the tender reference is saved');
  } finally {
    await sql(`delete from quotations where id='${q.id}'`);
  }
};

(async () => {
  const names = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(checks);
  const browser = await chromium.launch();
  for (const name of names) {
    if (!checks[name]) { console.log('no such check:', name); fails.push(name); continue; }
    console.log('▶', name);
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    page.on('pageerror', e => fails.push(`${name}: pageerror ${e.message}`));
    try { await checks[name](page); } catch (e) { fails.push(`${name}: ${e.message}`); console.log('    ✗ threw', e.message.slice(0, 200)); }
    await context.close();
  }
  await browser.close();
  console.log(fails.length ? `\nFAILED ${fails.length}: ${fails.join(' ; ')}` : '\nall checks passed');
  process.exit(fails.length ? 1 : 0);
})();
