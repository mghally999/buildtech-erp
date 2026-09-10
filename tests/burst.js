// Sign in from a fresh browser context N times and look closely at any request that
// comes back 401 in the first burst: which token it carried and what PostgREST said.
const { chromium } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const env = Object.fromEntries(fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8')
  .split('\n').filter(l => l.includes('=')).map(l => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]));
const base = process.env.BASE || 'http://127.0.0.1:5173';
const runs = Number(process.env.RUNS || 5);
const decode = jwt => { try { return JSON.parse(Buffer.from(jwt.split('.')[1], 'base64url').toString()); } catch (e) { return {}; } };

(async () => {
  const browser = await chromium.launch();
  let bad = 0;
  for (let i = 1; i <= runs; i++) {
    const context = await browser.newContext();
    const page = await context.newPage();
    const t0 = Date.now(); let signedInAt = 0; let n = 0;
    page.on('response', async r => {
      if (!r.url().includes('/rest/v1/')) return;
      n++;
      if (r.status() === 401) {
        bad++;
        const req = r.request(); const h = req.headers()['authorization'] || '';
        const jwt = h.replace(/^Bearer /, ''); const p = decode(jwt);
        let body = ''; try { body = (await r.text()).slice(0, 200); } catch (e) {}
        console.log(`  run ${i}: 401 on ${r.url().split('/rest/v1/')[1].slice(0, 50)} at +${Date.now() - signedInAt}ms after sign-in`
          + ` | token role=${p.role} iat=${p.iat} exp=${p.exp} sub=${(p.sub || '').slice(0, 8)} | now=${Math.floor(Date.now() / 1000)} | body=${body}`);
      }
    });
    await page.goto(base + '/', { waitUntil: 'load' });
    await page.waitForSelector('#e');
    await page.fill('#e', env.SWEEP_OWNER_EMAIL); await page.fill('#p', env.SWEEP_OWNER_PASS);
    await page.click('button.btn.wide'); signedInAt = Date.now();
    await page.waitForSelector('.deck', { timeout: 30000 });
    await page.waitForTimeout(2500);
    console.log(`run ${i}: ${n} rest requests in the first burst, 401s so far ${bad}`);
    await context.close();
  }
  await browser.close();
  console.log('total 401s:', bad, 'across', runs, 'sign-ins');
})();
