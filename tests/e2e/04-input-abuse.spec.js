// TEST 4 — input abuse.
//
// Bad input on the forms that feed money and stock: empty, non-numeric, negative, enormous,
// and awkward text (emoji, Arabic, a leading apostrophe, SQL-shaped). Each must be either
// refused with a clear message or handled safely, and nothing may render NaN or blank out.
const { test, expect } = require('@playwright/test');
const { sql, login, go, settle, lit } = require('../lib');
const { RUN, purge } = require('./helpers/run');
const { seedWarehouse } = require('./fixtures/seed');

test.afterAll(async () => { await purge(); });

const noNaN = async page => expect(await page.locator('body').innerText()).not.toMatch(/\bNaN\b/);

test('the new-product form refuses bad input and accepts awkward text safely', async ({ page }) => {
  await login(page, 'OWNER'); await go(page, 'Catalogue');
  await page.click('button:has-text("New product")'); await settle(500);
  const field = l => page.locator(`.modal .field:has(> label:has-text("${l}")) input`).first();
  const err = () => page.locator('.modal .err').innerText().catch(() => '');

  await page.click('.modal button:has-text("Create product")');
  expect(await err()).toMatch(/name/i);                              // empty name refused

  await field('Name').fill('ZZTEST Abuse 🚧 عربي O\'Brien "quote"');  // awkward but valid
  await field('Category').fill('flooring');
  // a number field refuses letters at the browser itself: typing them leaves it empty, so
  // no NaN can ever reach the app from here
  await field('Pack quantity').pressSequentially('abc');
  expect(await field('Pack quantity').inputValue()).toBe('');
  await field('Pack price').fill('100');
  await page.click('.modal button:has-text("Create product")');
  expect(await err()).toMatch(/pack quantity/i);                     // empty quantity refused

  await field('Pack quantity').fill('-5');
  await field('Pack price').fill('-9');
  await page.click('.modal button:has-text("Create product")');
  expect(await err()).toMatch(/pack (quantity|costs?)|euros/i);      // negative refused

  await field('Pack quantity').fill('25');
  await field('Pack price').fill('100');
  await page.click('.modal button:has-text("Create product")');
  await page.waitForSelector('.pp-title', { timeout: 15000 });
  await noNaN(page);
  const made = await sql("select name from products where name like '%ZZTEST Abuse%'");
  expect(made.length).toBe(1);                                       // the awkward text stored safely
  expect(made[0].name).toContain("O'Brien");
});

test('stock issue refuses more than is on hand and non-numeric quantities', async ({ page }) => {
  const dxb = (await sql("select id from offices where code='DXB'"))[0].id;
  const prod = (await sql(`insert into products (category, name, dcd_approved, dcd_expiry) values ((select category from products limit 1), ${lit(RUN + ' AbuseStock')}, true, current_date+365) returning id, name`))[0];
  const wh = await seedWarehouse({ name: RUN + ' AbuseWH', office_id: dxb });
  await sql(`insert into stock_movements (product_id, warehouse_id, direction, quantity, office_id) values ('${prod.id}', '${wh}', 'in', 10, '${dxb}')`);

  await login(page, 'OWNER'); await go(page, 'Stock'); await settle(800);
  const field = l => page.locator(`.field:has(> label:has-text("${l}"))`);
  const issue = async qty => {
    await field('Product').locator('input').fill(prod.name);
    await field('Warehouse').locator('select').selectOption({ label: RUN + ' AbuseWH' });
    await field('In or out').locator('select').selectOption('out');
    const box = field('Quantity').locator('input');
    await box.fill('');
    // a number field takes digits and a minus; letters are typed key-by-key and rejected,
    // leaving it empty — which the app then treats as no quantity
    if (/^-?\d/.test(String(qty))) await box.fill(String(qty)); else await box.pressSequentially(String(qty));
    await page.click('button:has-text("Record movement")'); await settle(800);
    return (await page.locator('.err').allTextContents()).join(' | ');
  };
  expect(await issue(999999999999)).toMatch(/Only 10|cannot be issued/);
  await noNaN(page);
  expect(await issue('abc')).toMatch(/greater than zero/);   // letters rejected → empty → refused
  await noNaN(page);
  const [{ n }] = await sql(`select count(*)::int as n from stock_movements where product_id='${prod.id}' and direction='out'`);
  expect(n).toBe(0);                                                 // nothing left the warehouse
});
