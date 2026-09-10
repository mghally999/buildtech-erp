// Phase 4: what actually happens to the session on refresh, in a real browser, against
// the TEST project. Each scenario prints what it saw; nothing here asserts, it observes.
//
//   node tests/phase4.js                (Chromium)
//   ENGINE=webkit node tests/phase4.js  (Safari's engine)
//
// Needs tests/serve.js running on 5173. Scenario "offline" needs it started with SW=1.
const pw = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const env = Object.fromEntries(fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8')
  .split('\n').filter(l => l.includes('=')).map(l => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]));
const base = process.env.BASE || 'http://127.0.0.1:5173';
const email = env.SWEEP_OWNER_EMAIL, password = env.SWEEP_OWNER_PASS;
const engine = pw[process.env.ENGINE || 'chromium'];
const out = path.join(__dirname, 'out'); fs.mkdirSync(out, { recursive: true });
const say = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

function watch(page, label) {
  const seen = { unauth: 0, requests: 0, auth: 0, events: [] };
  page.on('request', r => {
    if (!r.url().includes('/rest/v1/')) return;
    seen.requests++;
    const h = r.headers()['authorization'] || '';
    if (h.startsWith('Bearer eyJ') && h.length > 200) seen.auth++;
    else seen.unauth++;
  });
  page.on('response', r => { if (r.status() === 401 && r.url().includes('/rest/v1/')) seen.events.push('401 ' + r.url().split('/rest/v1/')[1].slice(0, 40)); });
  page.on('pageerror', e => seen.events.push('pageerror ' + e.message.slice(0, 80)));
  page.__seen = seen; page.__label = label;
  return seen;
}
const state = async page => ({
  screen: await page.evaluate(() => document.querySelector('.deck') ? 'app' : document.querySelector('.login') ? 'login' : document.querySelector('.spinner') ? 'spinner' : 'blank'),
  heading: await page.evaluate(() => (document.querySelector('.page-head h1') || {}).textContent || ''),
  where: await page.evaluate(() => (document.querySelector('.cmdbar .where') || {}).textContent || ''),
});
const storage = async page => page.evaluate(() => {
  const o = {};
  for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k.startsWith('sb-')) {
    try { const v = JSON.parse(localStorage.getItem(k)); o[k] = { expires_at: v.expires_at, expires_in: v.expires_in, has_refresh: !!v.refresh_token, token_head: (v.access_token || '').slice(0, 12), user: v.user && v.user.email }; }
    catch (e) { o[k] = 'unparseable'; } } }
  return o;
});
const signIn = async page => {
  await page.goto(base + '/', { waitUntil: 'load' });
  await page.waitForSelector('#e', { timeout: 20000 });
  await page.fill('#e', email); await page.fill('#p', password);
  await page.click('button.btn.wide');
  await page.waitForSelector('.deck', { timeout: 30000 });
};
const settle = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const browser = await engine.launch();
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage(); watch(page, 'A');

  say('1. sign in');
  await signIn(page); await settle(2500);
  say('   ', await state(page)); say('    storage:', JSON.stringify(await storage(page)));
  say('    first burst: rest requests', page.__seen.requests, 'with token', page.__seen.auth, 'WITHOUT token', page.__seen.unauth, page.__seen.events);

  say('2. go to Quotations, then soft refresh (page.reload)');
  await page.click('nav.rail button[title="Quotations"]'); await page.waitForSelector('.page-head h1'); await settle(800);
  page.__seen.requests = page.__seen.auth = page.__seen.unauth = 0; page.__seen.events.length = 0;
  await page.reload({ waitUntil: 'load' }); await page.waitForSelector('.deck, .login', { timeout: 30000 }); await settle(2500);
  say('   ', await state(page), '| rest requests', page.__seen.requests, 'with token', page.__seen.auth, 'WITHOUT', page.__seen.unauth, page.__seen.events);

  say('3. hard refresh (navigate again with the cache bypassed)');
  page.__seen.requests = page.__seen.auth = page.__seen.unauth = 0; page.__seen.events.length = 0;
  await page.goto(base + '/?nocache=' + Date.now(), { waitUntil: 'load' }); await page.waitForSelector('.deck, .login', { timeout: 30000 }); await settle(2500);
  say('   ', await state(page), '| rest requests', page.__seen.requests, 'with token', page.__seen.auth, 'WITHOUT', page.__seen.unauth, page.__seen.events);

  say('4. second tab in the same browser');
  const tab2 = await context.newPage(); watch(tab2, 'B');
  await tab2.goto(base + '/', { waitUntil: 'load' }); await tab2.waitForSelector('.deck, .login', { timeout: 30000 }); await settle(1500);
  say('    tab B:', await state(tab2));

  say('5. sign out in tab B; what does tab A do?');
  await tab2.click('nav.rail button[title="Sign out"]'); await settle(3000);
  say('    tab B:', await state(tab2)); say('    tab A:', await state(page));
  say('    storage after sign-out:', JSON.stringify(await storage(page)));
  await tab2.close();

  say('6. sign in again, close the tab, reopen');
  await signIn(page); await settle(1500);
  await page.close();
  const page3 = await context.newPage(); watch(page3, 'C');
  await page3.goto(base + '/', { waitUntil: 'load' }); await page3.waitForSelector('.deck, .login', { timeout: 30000 }); await settle(1500);
  say('    reopened tab:', await state(page3));

  say('7. token past its expiry in storage, valid refresh token, then reload');
  await page3.evaluate(() => { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k.startsWith('sb-')) {
    const v = JSON.parse(localStorage.getItem(k)); v.expires_at = Math.floor(Date.now() / 1000) - 120; localStorage.setItem(k, JSON.stringify(v)); } } });
  page3.__seen.requests = page3.__seen.auth = page3.__seen.unauth = 0; page3.__seen.events.length = 0;
  await page3.reload({ waitUntil: 'load' }); await page3.waitForSelector('.deck, .login', { timeout: 30000 }); await settle(3000);
  say('   ', await state(page3), '| rest requests', page3.__seen.requests, 'with token', page3.__seen.auth, 'WITHOUT', page3.__seen.unauth, page3.__seen.events);
  say('    storage now:', JSON.stringify(await storage(page3)));

  say('8. token expired AND refresh token invalid, then reload (a genuinely dead session)');
  await page3.evaluate(() => { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k.startsWith('sb-')) {
    const v = JSON.parse(localStorage.getItem(k)); v.expires_at = Math.floor(Date.now() / 1000) - 120; v.refresh_token = 'not-a-real-token'; localStorage.setItem(k, JSON.stringify(v)); } } });
  await page3.reload({ waitUntil: 'load' }); await page3.waitForSelector('.deck, .login', { timeout: 30000 }); await settle(2000);
  say('   ', await state(page3));

  if (process.env.WAIT) {
    say(`9. sign in and wait ${process.env.WAIT}s for a real expiry (set the test project jwt_exp low first), then reload`);
    await signIn(page3); await settle(Number(process.env.WAIT) * 1000);
    say('    before reload:', await state(page3), JSON.stringify(await storage(page3)));
    page3.__seen.events.length = 0;
    await page3.click('nav.rail button[title="Projects"]'); await settle(2500);
    say('    after navigating post-expiry:', await state(page3), page3.__seen.events);
    await page3.reload({ waitUntil: 'load' }); await page3.waitForSelector('.deck, .login', { timeout: 30000 }); await settle(2500);
    say('    after reload post-expiry:', await state(page3), page3.__seen.events);
  }

  if (process.env.OFFLINE) {
    say('10. offline and back online (server must run with SW=1)');
    await signIn(page3); await settle(4000);                       // let the worker install and pre-cache
    const sw = await page3.evaluate(async () => !!(navigator.serviceWorker && (await navigator.serviceWorker.getRegistration())));
    say('    service worker registered:', sw);
    await context.setOffline(true);
    await page3.reload({ waitUntil: 'load' }).catch(e => say('    reload offline threw:', e.message.slice(0, 80)));
    await settle(3000); say('    offline reload:', await state(page3));
    await page3.click('nav.rail button[title="Stock"]').catch(() => {}); await settle(2000);
    say('    offline navigate:', await state(page3), (await page3.locator('.err').allTextContents()).slice(0, 2));
    await context.setOffline(false); await settle(1000);
    await page3.click('nav.rail button[title="Catalogue"]'); await settle(2500);
    say('    back online:', await state(page3), 'cards', await page3.locator('.plist .prod').count());
  }

  await browser.close();
})().catch(e => { console.error('phase4 failed:', e); process.exit(1); });
