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
