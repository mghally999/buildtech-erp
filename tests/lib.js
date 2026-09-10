// Shared helpers for every browser check and test in this folder.
//
// Everything here talks only to the TEST project: the SQL helper is hard-wired to its ref
// and uses the sweep token, which cannot see production; the page helper refuses to drive
// a page whose config points anywhere else.
const fs = require('fs');
const path = require('path');
const https = require('https');

const env = Object.fromEntries(fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8')
  .split('\n').filter(l => l.includes('=')).map(l => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]));
const TEST_REF = 'otwzrmwvvrtjosxgqhkb';
const base = process.env.BASE || 'http://127.0.0.1:5173';

function sql(query) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ query });
    const req = https.request({ hostname: 'api.supabase.com', path: `/v1/projects/${TEST_REF}/database/query`, method: 'POST',
      headers: { Authorization: `Bearer ${env.SUPABASE_SWEEP_TOKEN}`, 'Content-Type': 'application/json',
                 'Content-Length': Buffer.byteLength(body), 'User-Agent': 'curl/8.7.1', Accept: 'application/json' } },
      res => { let d = ''; res.on('data', c => d += c); res.on('end', () => {
        if (res.statusCode >= 300) return reject(new Error(`SQL ${res.statusCode}: ${d.slice(0, 300)}`));
        try { resolve(d ? JSON.parse(d) : []); } catch (e) { resolve([]); } }); });
    req.on('error', reject); req.write(body); req.end();
  });
}

async function login(page, who = 'OWNER') {
  await page.goto(base + '/', { waitUntil: 'load' });
  const cfg = await page.evaluate(() => window.BT_CONFIG && window.BT_CONFIG.SUPABASE_URL);
  if (!cfg || !cfg.includes(TEST_REF)) throw new Error('REFUSING: the page is not configured for the test project');
  await page.waitForSelector('#e', { timeout: 20000 });
  await page.fill('#e', env[`SWEEP_${who}_EMAIL`]); await page.fill('#p', env[`SWEEP_${who}_PASS`]);
  await page.click('button.btn.wide');
  await page.waitForSelector('.deck', { timeout: 30000 });
}
const go = async (page, title) => { await page.click(`nav.rail button[title="${title}"]`); await page.waitForSelector('.page-head h1'); };
const settle = ms => new Promise(r => setTimeout(r, ms));
const lit = v => v == null ? 'NULL' : typeof v === 'number' ? String(v) : typeof v === 'boolean' ? String(v) : `$q$${String(v)}$q$`;

module.exports = { env, base, sql, login, go, settle, lit, TEST_REF };
