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
    const [q] = await sql(`select id, reference, client_id, project_name, meeting_notes from quotations where id not in (${[...before].map(x => `'${x}'`).join(',') || "'00000000-0000-0000-0000-000000000000'"})`);
    assert(q && q.client_id === cl.id && /Replacement of Fruits and Vegetable/.test(q.project_name), `the saved quotation has the client and the title (saw ${q && q.reference})`);
    assert(q && /taking the old one off/.test(q.meeting_notes) && /is measured in lm/.test(q.meeting_notes), 'and the reader\'s notes saved as meeting notes');
    const lines = q ? await sql(`select l.description, l.is_spec_note, l.unit, l.quantity, l.sell_rate from quotation_lines l join quotation_sections s on s.id=l.section_id where s.quotation_id='${q.id}'`) : [];
    const priced = lines.filter(l => !l.is_spec_note);
    assert(priced.length === 14, `14 priced lines saved (saw ${priced.length})`);
    assert(priced.filter(l => l.unit === 'lm').every(l => l.sell_rate == null), 'the metre-run lines were left unpriced rather than priced per square metre');
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
