// Local static server for the sweep.
//
// The app is a folder of static files that loads ./config.js, and config.js points at
// production. This server serves the same folder but answers a request for /config.js
// with config.local.js, which points at the test project. Nothing in the app changes,
// and the shipped config.js is never served while this is running, so a browser on
// http://localhost:5173 can only ever talk to the test database.
//
// Usage: node tests/serve.js [port]
const http = require('http');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const port = Number(process.argv[2] || 5173);
const local = path.join(root, 'config.local.js');
if (!fs.existsSync(local)) {
  console.error('config.local.js is missing; refusing to serve the app against production.');
  process.exit(1);
}
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png',
  '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.css': 'text/css' };

http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p === '/' ) p = '/index.html';
  if (p === '/config.js') p = '/config.local.js';
  // The service worker is only served when a test asks for it (SW=1), because a cached
  // shell makes every other test harder to reason about.
  if (p === '/sw.js' && process.env.SW !== '1') { res.writeHead(404); return res.end(); }
  const file = path.join(root, p);
  if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404); return res.end('not found');
  }
  res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream',
                       'Cache-Control': 'no-store' });
  fs.createReadStream(file).pipe(res);
}).listen(port, '127.0.0.1', () => console.log(`serving ${root} on http://127.0.0.1:${port} (config.js → config.local.js)`));
