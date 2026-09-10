// Smoke test: the app served locally against the TEST project signs in and shows the
// catalogue. Run with the dev server up:  node tests/serve.js & node tests/smoke.js
// Reads the test login from .env.local. Takes screenshots into tests/out/.
const { chromium } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const env = Object.fromEntries(fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8')
  .split('\n').filter(l => l.includes('=')).map(l => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]));
const base = process.env.BASE || 'http://127.0.0.1:5173';
const who = process.env.WHO || 'OWNER';
const email = env[`SWEEP_${who}_EMAIL`], password = env[`SWEEP_${who}_PASS`];
if (!email || !password) { console.error('no test login in .env.local'); process.exit(1); }
fs.mkdirSync(path.join(__dirname, 'out'), { recursive: true });

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  // The test server refuses to serve sw.js on purpose, and the browser logs that as an
  // error of its own; it is not the app's.
  page.on('console', m => { if (m.type() === 'error' && !/fetching the script|Failed to load resource/.test(m.text())) errors.push('console: ' + m.text()); });
  page.on('response', r => { if (r.status() >= 400 && r.url().includes('supabase')) errors.push(`http ${r.status()} ${r.url().slice(0, 140)}`); });

  await page.goto(base + '/', { waitUntil: 'load' });
  const cfg = await page.evaluate(() => window.BT_CONFIG && window.BT_CONFIG.SUPABASE_URL);
  console.log('config url:', cfg);
  if (!cfg || cfg.includes('zlyqecpsgzgbpbikrlro')) { console.error('REFUSING: the page is configured for production'); process.exit(2); }

  await page.waitForSelector('#e', { timeout: 15000 });
  await page.fill('#e', email); await page.fill('#p', password);
  await page.click('button.btn.wide');
  await page.waitForSelector('.deck', { timeout: 20000 });
  console.log('signed in as', email, '| heading:', await page.textContent('.page-head h1'));
  await page.screenshot({ path: path.join(__dirname, 'out', 'home.png') });

  await page.click('nav.rail button[title="Catalogue"]');
  await page.waitForSelector('.plist .prod', { timeout: 20000 });
  const cards = await page.locator('.plist .prod').count();
  const counter = await page.textContent('.page-head .muted');
  console.log('catalogue cards:', cards, '| counter:', counter);
  await page.screenshot({ path: path.join(__dirname, 'out', 'catalogue.png') });

  await page.click('nav.rail button[title="Settings"]');
  await page.waitForSelector('.settabs', { timeout: 15000 });
  const build = await page.textContent('.page-head .muted');
  console.log('settings shows', build.trim());
  const office = await page.locator('.offsw .offbtn.on').textContent().catch(() => '(no office switch)');
  console.log('office selected:', office.trim());

  console.log('errors:', errors.length ? errors : 'none');
  await browser.close();
  process.exit(cards > 0 && errors.length === 0 ? 0 : 1);
})().catch(e => { console.error('smoke failed:', e.message); process.exit(1); });
