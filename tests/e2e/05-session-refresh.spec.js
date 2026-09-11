// TEST 5 — session and refresh.
//
// The reported symptom was that refreshing appeared to sign the user out. It must not: a
// hard reload keeps the session, mid-edit work is offered back, and signing out in one tab
// takes effect in another. (True token expiry is covered by Phase 4's REFRESH.md run, which
// showed the session survives a navigate and a reload after the token has expired.)
const { test, expect } = require('@playwright/test');
const { sql, login, go, settle, lit } = require('../lib');
const { RUN, purge } = require('./helpers/run');

test.afterAll(async () => { await purge(); });

test('a hard refresh keeps the user signed in', async ({ page }) => {
  await login(page, 'OWNER');
  await expect(page.locator('.deck')).toBeVisible();
  await page.reload({ waitUntil: 'load' });
  await expect(page.locator('.deck')).toBeVisible({ timeout: 20000 });   // still in
  expect(await page.locator('#e').count()).toBe(0);                      // not back at the login gate
});

test('unsaved editing survives a refresh and is offered back', async ({ page }) => {
  const dxb = (await sql("select id from offices where code='DXB'"))[0].id;
  const q = (await sql(`insert into quotations (reference, eur_aed_rate, office_id, project_name) values (${lit(RUN + '-SESS-Q')}, 4.27, '${dxb}', ${lit(RUN + ' session')}) returning id`))[0];
  await sql(`insert into quotation_sections (quotation_id, position, title) values ('${q.id}', 1, 'Roof')`);

  await login(page, 'OWNER'); await page.click('.offsw button:has-text("DXB")').catch(() => {}); await settle(400);
  await go(page, 'Quotations');
  await page.locator('tr', { hasText: RUN + '-SESS-Q' }).locator('td').first().click();
  await page.waitForSelector('.field:has(> label:has-text("Project")) input', { timeout: 15000 }); await settle(500);
  await page.locator('.field:has(> label:has-text("Project")) input').first().fill(RUN + ' edited but not saved');
  await settle(800);
  await page.reload({ waitUntil: 'load' });
  await expect(page.locator('.deck')).toBeVisible({ timeout: 20000 });   // still signed in after refresh mid-edit
  // reopen the quotation: the unsaved edit is offered as a draft, never silently lost
  await go(page, 'Quotations');
  await page.locator('tr', { hasText: RUN + '-SESS-Q' }).locator('td').first().click();
  await page.waitForSelector('.flagbox', { timeout: 15000 });
  expect(await page.locator('.flagbox').innerText()).toMatch(/Picked up where you left off/);
});

test('signing out in one tab signs the other out on its next check', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const a = await ctx.newPage(); await login(a, 'OWNER');
  // tab B shares the session (same context), so it opens straight into the app
  const b = await ctx.newPage(); await b.goto('http://127.0.0.1:5173/', { waitUntil: 'load' });
  await expect(b.locator('.deck')).toBeVisible({ timeout: 20000 });
  // sign out in tab A (the toolbar's sign-out calls the same thing)
  await a.evaluate(() => sb.auth.signOut().catch(() => {})); await settle(1000);
  await b.reload({ waitUntil: 'load' });
  await expect(b.locator('#e')).toBeVisible({ timeout: 20000 });   // tab B is now at the login gate
  await ctx.close();
});
