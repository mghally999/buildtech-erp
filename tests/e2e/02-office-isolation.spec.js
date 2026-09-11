// TEST 2 — office isolation.
//
// A Dubai record and a Bruges record. In the Dubai view only Dubai's is listed; in the
// Bruges view only Bruges's; in the company view both, each labelled in its own currency.
// The company view also states that a new record is filed under the signed-in person's
// office, which is what stops a Belgian's work landing in Dubai's books.
const { test, expect } = require('@playwright/test');
const { sql, login, go, settle, lit } = require('../lib');
const { RUN, purge } = require('./helpers/run');

test.afterAll(async () => { await purge(); });

test('records stay in their office, and the company view converts and says so', async ({ page }) => {
  const dxb = (await sql("select id from offices where code='DXB'"))[0].id;
  const bru = (await sql("select id from offices where code='BRU'"))[0].id;
  const tag = RUN + ' iso';
  await sql(`insert into projects (name, status, value, office_id) values
    (${lit(tag + ' Dubai job')}, 'in_progress', 1000, '${dxb}'),
    (${lit(tag + ' Bruges job')}, 'in_progress', 1000, '${bru}')`);

  const row = async name => { const r = page.locator('tr', { hasText: name });
    return (await r.count()) ? (await r.first().innerText()).replace(/\s+/g, ' ') : ''; };
  const office = async label => { await page.click(`.offsw button:has-text("${label}")`); await settle(1200); };

  await login(page, 'OWNER'); await go(page, 'Projects');

  await office('DXB');
  expect(await row(tag + ' Dubai job')).toMatch(/AED\s*1,000/);
  expect(await row(tag + ' Bruges job')).toBe('');            // not in the Dubai view

  await office('BEL');                                         // Bruges is tagged BEL
  expect(await row(tag + ' Bruges job')).toMatch(/EUR\s*1\.000/);
  expect(await row(tag + ' Dubai job')).toBe('');

  await office('BOTH');
  expect(await row(tag + ' Dubai job')).toMatch(/AED\s*1,000/);
  expect(await row(tag + ' Bruges job')).toMatch(/EUR\s*1\.000/);
  const note = (await page.locator('.offnote').count()) ? await page.locator('.offnote').innerText() : '';
  expect(note).toMatch(/New records go to (Dubai|Bruges)/);   // the owner's own office

  // the offices carry their own currency and VAT rate
  const offs = await sql("select code, currency, vat_rate from offices order by code");
  expect(offs.find(o => o.code === 'DXB')).toMatchObject({ currency: 'AED' });
  expect(offs.find(o => o.code === 'BRU')).toMatchObject({ currency: 'EUR' });
  expect(Number(offs.find(o => o.code === 'DXB').vat_rate)).toBeCloseTo(0.05, 4);
  expect(Number(offs.find(o => o.code === 'BRU').vat_rate)).toBeCloseTo(0.21, 4);
});
