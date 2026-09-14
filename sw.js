// Service worker for Build-Tech Pro.
//
// Its whole job is to make the app open instantly and keep opening when the phone
// is on a bad connection in a basement car park. It deliberately does NOT try to be
// clever, because the one thing worse than a slow app is an app that keeps showing
// last week's version after a fix has been shipped.
//
// The rule is: the program itself is fetched fresh every time and only falls back to
// the copy on the device when the network fails. Everything that never changes
// without its name changing, the fonts and the icons and the React files, is served
// straight from the device and never asked for twice.
//
// Nothing from Supabase is touched. Every one of those calls goes to a different
// origin, so it never reaches this file, which is what you want: the data must
// always be the real data and never a stale copy.

const VERSION = 'bt-2026.09.14-2';
const SHELL   = 'shell-' + VERSION;

// Fetched once and kept until the version changes.
//
// index.html and config.js are in this list only so that a first visit already has a
// copy to fall back on. At runtime they are still fetched from the network first, so
// this never serves a stale build to somebody who has a connection. Without them here
// the very first offline open would find nothing, because a worker does not see the
// request that installed it.
const STATIC = [
  './index.html',
  './config.js',
  './vendor/react.production.min.js',
  './vendor/react-dom.production.min.js',
  './vendor/htm.umd.js',
  './vendor/supabase.min.js',
  './fonts/oswald-latin-500-normal.woff2',
  './fonts/oswald-latin-600-normal.woff2',
  './fonts/oswald-latin-700-normal.woff2',
  './fonts/lato-latin-300-normal.woff2',
  './fonts/lato-latin-400-normal.woff2',
  './fonts/lato-latin-700-normal.woff2',
  './logo.png',
  './logo-mark.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './manifest.webmanifest',
];

self.addEventListener('install', e => {
  // A failed pre-cache must not stop the worker installing, or one missing file
  // takes the whole thing down. Each file is fetched on its own and forgiven.
  e.waitUntil((async () => {
    const c = await caches.open(SHELL);
    await Promise.all(STATIC.map(u => c.add(u).catch(() => {})));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== SHELL).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

const isStatic = url =>
  /\/(vendor|fonts|icons)\//.test(url.pathname) ||
  /\.(woff2|png|svg|webmanifest)$/.test(url.pathname);

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;   // Supabase, and anything else

  // The program and its configuration: always ask the network first, so a new build
  // is picked up the moment it is published. The cached copy is the safety net for
  // a dead connection, nothing more.
  if (req.mode === 'navigate' || /\.(html|js)$/.test(url.pathname) && !isStatic(url)) {
    e.respondWith((async () => {
      try {
        const fresh = await fetch(req);
        const c = await caches.open(SHELL);
        c.put(req, fresh.clone());
        return fresh;
      } catch (err) {
        const hit = await caches.match(req);
        if (hit) return hit;
        const index = await caches.match('./index.html');
        if (index) return index;
        throw err;
      }
    })());
    return;
  }

  // Fonts, icons, logos, the React and Supabase libraries: from the device, and only
  // fetched if they are not there yet.
  if (isStatic(url)) {
    e.respondWith((async () => {
      const hit = await caches.match(req);
      if (hit) return hit;
      const fresh = await fetch(req);
      const c = await caches.open(SHELL);
      c.put(req, fresh.clone());
      return fresh;
    })());
  }
});
