// TEST 3 — permissions.
//
// The rules that matter are the ones the database enforces, because the anon key ships to
// the browser and anything guarded only in JavaScript can be bypassed from the console.
// So each rule is attacked directly through the page's own Supabase client, not just the UI.
const { test, expect } = require('@playwright/test');
const { sql, login, go, settle, lit } = require('../lib');
const { RUN, purge } = require('./helpers/run');
const { seedProduct, seedWarehouse } = require('./fixtures/seed');

test.afterAll(async () => { await purge(); });

test('only an owner can approve an order — in the database, not just the UI', async ({ page }) => {
  const dxb = (await sql("select id from offices where code='DXB'"))[0].id;
  const po = (await sql(`insert into purchase_orders (reference, supplier, status, currency, eur_aed_rate, office_id, notes)
    values (${lit(RUN + '-PERM-PO')}, 'Krypton Chemical S.L.', 'pending_approval', 'EUR', 4.27, '${dxb}', ${lit(RUN + ' perm')}) returning id`))[0];

  // a full user, through the console (sb is a top-level const, reachable in evaluate), is refused by the trigger
  await login(page, 'FULL'); await page.click('.offsw button:has-text("DXB")').catch(() => {}); await settle(400);
  const refused = await page.evaluate(id => sb.from('purchase_orders').update({ status: 'approved' }).eq('id', id)
    .then(r => r.error ? r.error.message : 'NO ERROR — approval was allowed'), po.id);
  expect(refused).toMatch(/Only an owner can approve/);
  expect((await sql(`select status from purchase_orders where id='${po.id}'`))[0].status).toBe('pending_approval');

  // and is not even offered the button in the UI
  await go(page, 'Orders');
  await page.locator('tr', { hasText: RUN + '-PERM-PO' }).locator('td').first().click();
  await page.waitForSelector('.flowrow', { timeout: 15000 }); await settle(400);
  expect(await page.locator('button:has-text("Approve")').count()).toBe(0);

  // an owner, through the console, is allowed (sign the full user out first, same page)
  await page.evaluate(() => sb.auth.signOut()).catch(() => {}); await settle(400);
  await login(page, 'OWNER'); await settle(300);
  const owned = await page.evaluate(id => sb.from('purchase_orders').update({ status: 'approved' }).eq('id', id)
    .then(r => r.error ? r.error.message : 'ok'), po.id);
  expect(owned).toBe('ok');
  expect((await sql(`select status from purchase_orders where id='${po.id}'`))[0].status).toBe('approved');
});

test('held stock cannot be issued, in the database not just the UI', async ({ page }) => {
  const dxb = (await sql("select id from offices where code='DXB'"))[0].id;
  const prod = (await sql(`insert into products (category, name, is_dangerous, dcd_approved) values ((select category from products limit 1), ${lit(RUN + ' Held product')}, true, false) returning id`))[0];
  const wh = await seedWarehouse({ name: RUN + ' PermWH', office_id: dxb });
  await sql(`insert into stock_movements (product_id, warehouse_id, direction, quantity, office_id) values ('${prod.id}', '${wh}', 'in', 10, '${dxb}')`);

  await login(page, 'FULL');
  const blocked = await page.evaluate(a => sb.from('stock_movements')
    .insert({ product_id: a.p, warehouse_id: a.w, direction: 'out', quantity: 5 })
    .then(r => r.error ? r.error.message : 'NO ERROR — held stock left the warehouse'), { p: prod.id, w: wh });
  expect(blocked).toMatch(/civil defence|held|approval/i);
  const [{ n }] = await sql(`select count(*)::int as n from stock_movements where product_id='${prod.id}' and direction='out'`);
  expect(n).toBe(0);
});

test('owner-only controls are hidden from a full user', async ({ page, browser }) => {
  // the access list, where roles are granted, is under Settings → "Who can get in"; the
  // "give/take the dials" button is shown to an owner only
  const seesDials = async p => {
    await go(p, 'Settings'); await settle(400);
    await p.click('.settab:has-text("Who can get in")'); await settle(700);
    return p.locator('button:has-text("the dials")').count();
  };
  await login(page, 'OWNER');
  const ownerSees = await seesDials(page);
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const fp = await ctx.newPage();
  await login(fp, 'FULL');
  const fullSees = await seesDials(fp);
  await ctx.close();
  expect(ownerSees).toBeGreaterThan(0);
  expect(fullSees).toBe(0);
});

test('KNOWN GAP: office separation is not yet enforced by the database (a decision for Charles)', async ({ page }) => {
  // Documented in SECURITY-AUDIT §7.3: every table policy today is "any signed-in user".
  // The UI hides the other office; a direct query does not. This test records the current
  // reality so that tightening RLS later shows up here as a change to update, not a silent one.
  const bru = (await sql("select id from offices where code='BRU'"))[0].id;
  const p = (await sql(`insert into projects (name, status, value, office_id) values (${lit(RUN + ' cross-office')}, 'in_progress', 1, '${bru}') returning id`))[0];
  await login(page, 'FULL');  // a Dubai user
  const seen = await page.evaluate(id => sb.from('projects').select('id').eq('id', id)
    .then(r => (r.data || []).length), p.id);
  expect(seen).toBe(1);   // the Bruges row is readable across offices — the known gap
});
