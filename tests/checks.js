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
checks.both_stamp = async page => {
  const [bru] = await sql("select id from offices where code='BRU'");
  await sql(`alter table profiles disable trigger profiles_role_is_the_owners;
    update profiles set office_id='${bru.id}' where email='sweep-full@example.com';
    alter table profiles enable trigger profiles_role_is_the_owners`);
  try {
    await login(page, 'FULL'); await page.click('.offsw button:has-text("BOTH")'); await settle(1000);
    const note = (await page.locator('.offnote').count()) ? await page.locator('.offnote').textContent() : '';
    assert(/Bruges/.test(note), `the header says where new records go (saw "${note}")`);
    await go(page, 'Finance'); await page.click('.subnav button:has-text("Bank accounts")'); await settle(1500);
    await page.click('button:has-text("Add account")'); await settle(1500);
    const rows = await sql("select office_id from bank_accounts where name='New account' order by created_at desc limit 1");
    assert(rows.length === 1 && rows[0].office_id === bru.id, "a record added in the company view is filed under the person's own office");
  } finally { await sql("delete from bank_accounts where name='New account'"); }
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
