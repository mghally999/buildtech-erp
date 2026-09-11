// TEST 6 — failure and offline.
//
// When a write fails — whether the server rejects it or the network is down — the screen
// must say so, and must never pretend the save succeeded. (F-025 made every "add a row"
// report its error instead of blanking the screen.)
const { test, expect } = require('@playwright/test');
const { sql, login, go, settle } = require('../lib');
const { purge } = require('./helpers/run');

test.afterAll(async () => {
  await sql("delete from bank_accounts where name = 'New account'");   // in case any slipped through
  await purge();
});

const openBankAccounts = async page => {
  await go(page, 'Finance');
  await page.click('.subnav button:has-text("Bank accounts")').catch(() => {});
  await settle(1000);
};

test('a server error on save is shown, and nothing is silently written', async ({ page }) => {
  await login(page, 'OWNER'); await page.click('.offsw button:has-text("DXB")').catch(() => {}); await settle(400);
  await openBankAccounts(page);
  const before = (await sql("select count(*)::int as n from bank_accounts where name='New account'"))[0].n;

  // force the insert to fail at the server
  await page.route('**/rest/v1/bank_accounts*', route =>
    route.request().method() === 'POST'
      ? route.fulfill({ status: 500, contentType: 'application/json', body: '{"message":"forced failure for the test"}' })
      : route.continue());
  await page.click('button:has-text("Add account")'); await settle(1000);
  expect((await page.locator('.err').allTextContents()).join(' | ')).toMatch(/forced failure|error/i);
  expect(await page.locator('.page-head h1').count()).toBe(1);   // the screen is still there, not blank
  await page.unroute('**/rest/v1/bank_accounts*');
  const afterServer = (await sql("select count(*)::int as n from bank_accounts where name='New account'"))[0].n;
  expect(afterServer).toBe(before);                               // nothing was written
});

test('an add while offline is reported, and recovers when back online', async ({ page }) => {
  await login(page, 'OWNER'); await page.click('.offsw button:has-text("DXB")').catch(() => {}); await settle(400);
  await openBankAccounts(page);
  const before = (await sql("select count(*)::int as n from bank_accounts where name='New account'"))[0].n;

  await page.context().setOffline(true);
  await page.click('button:has-text("Add account")'); await settle(1500);
  expect((await page.locator('.err').allTextContents()).join(' | ')).not.toBe('');   // an error is shown, not a silent success
  const offlineCount = (await sql("select count(*)::int as n from bank_accounts where name='New account'"))[0].n;
  expect(offlineCount).toBe(before);                              // nothing written while offline

  await page.context().setOffline(false); await settle(500);
  await page.reload({ waitUntil: 'load' });
  await expect(page.locator('.deck')).toBeVisible({ timeout: 20000 });   // recovers, still signed in
});
