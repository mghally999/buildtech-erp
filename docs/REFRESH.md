# Build-Tech Pro — The refresh problem (Phase 4)

Reported symptom: refreshing the page appears to sign the user out.

Tested on the test project (an exact copy of production's schema, policies, triggers and
auth settings, seeded with the catalogue) with the app served locally through
`tests/serve.js`, driven by Playwright in **Chromium** and **WebKit** (Safari's engine).
Script: `tests/phase4.js`; sign-in burst: `tests/burst.js`.

## What the client does, read from the vendored library

`vendor/supabase.min.js` is supabase-js 2.45.4 with gotrue-js 2.65.0. Created with no
options (index.html 1919), it defaults to `persistSession: true`, `autoRefreshToken: true`,
`detectSessionInUrl: true`, storage = `localStorage`, key `sb-<project ref>-auth-token`.
Cross-tab: a `BroadcastChannel` on that key carries sign-in and sign-out to other tabs, and
`navigator.locks` serialises refreshes so two tabs never race the refresh token. The token
is attached per request through `getSession()` under that lock, read from storage each
time. Refresh-token rotation is on with a 10-second reuse window (production and test).

## What actually happened, with evidence

| Scenario | Chromium | WebKit | Evidence |
|---|---|---|---|
| Sign in, then soft refresh (reload) | stays signed in, same tab | same | phase4 step 2: `screen: app`, 40 requests, 0 without token |
| Hard refresh (navigate with cache bypassed) | stays signed in | same | step 3 |
| Second tab in the same browser | already signed in | same | step 4 |
| Sign out in tab B | tab A goes to login within 3 s, storage cleared | same | step 5 |
| Close the tab, reopen | signed in | same | step 6 |
| Access token past expiry in storage, refresh token valid, reload | refreshed, signed in, new `expires_at` | same | step 7 |
| Refresh token dead (invalid), reload | login screen — correct | same | step 8 |
| **Real expiry**: token lifetime set to 60 s on the test project, sign in, wait 75 s, navigate, reload | navigate ok, reload ok, still signed in | — | step 9 (`WAIT=75`) |
| Offline with the service worker installed, reload, navigate, back online | shell loads from cache, still signed in; data screens show "Failed to fetch"; back online everything loads | — | step 10 (`SW=1`) |
| Sign in fresh 26 times and watch the first burst of 32 requests | 0 × 401 in the last 26; **3 of the first 7 runs had one 401** on a random query, all within the first minutes after the test project was created | — | `tests/burst.js`, smoke runs |

**Refreshing does not sign the user out.** Not on soft or hard refresh, not after the token
has expired, not with two tabs, not offline, and not in Safari's engine. Every mechanism
the report pointed at (persistSession, storage key, service worker, token refresh, the
same-user shortcut in `onAuthStateChange`) was exercised and behaved.

The service worker: it pre-caches index.html and config.js and serves both network-first,
falling back to the cache only when the network fails (sw.js 84–98). The storage key comes
from the project ref inside config.js, which has only ever pointed at one project, so no
cached copy can produce a different key. Confirmed offline: the cached shell used the same
session.

The same-user shortcut (index.html 13605–13608): `TOKEN_REFRESHED` arrives with the same
user, the state keeps the old session object, and nothing downstream reads
`session.access_token`; the client attaches its own current token to every request. Step
9 proves a refreshed token is used correctly after the state object went stale.

## What does produce "it looks like I'm signed out"

1. **The first-burst 401 (F-074).** In 3 of the first 7 sign-ins after the project was
   created, one of the home screen's 32 start-up requests came back 401. The home screen
   checks errors on only 4 of its 17 queries (3012), so the failed one contributed an empty
   list and a vital, a queue row or a tile silently showed nothing. Not reproducible in 26
   later sign-ins, which fits PostgREST warming its signing-key cache on a fresh project;
   production (whose PostgREST has held its key since 1 September) would only see this
   after a restart. Real, rare, and it looks like a broken app, not a sign-out.
2. **An invitation completed halfway.** The invite or recovery link signs the person in and
   the app shows "Choose a password". That gate is decided from the URL on that one page
   load (1868–1877, 13533–13535). Refresh during it, and the URL is clean, the gate is gone,
   the person is in the app **with no password**. The session lasts until the refresh token
   dies (a week away, a cleared browser, a Safari storage purge), and then sign-in fails
   with a password nobody ever set. The code's own comment (1860–1865) says this is what
   happened to Chris. It reads to the user as "the app signed me out".
3. **Two storage contexts on the phone.** Safari and a home-screen web app keep separate
   storage. Signing in in one and opening the other shows a login screen. Not a bug, worth
   a line in the report.
4. **The device clock.** The client compares `expires_at` with the device's clock. A phone
   whose clock is more than an hour ahead sees every token as expired, refreshes on every
   request, hits the 150-per-5-minutes refresh limit and is signed out. Not reproducible
   remotely; check on the device if the symptom is one person's.

## Root cause, stated

There is no sign-out on refresh. The reported experience comes from (1) an invite or
recovery that was refreshed mid-way and left the account without a password, and (2) a
rare start-up failure that leaves the home screen half-empty and is never reported. Both
are in the app, both are fixed below. (3) and (4) are for the report's "what to check".

## The fix (index.html)

- The client is created with its options written out, so the next person does not have to
  read the library to know what it does (1919).
- The password gate is remembered on the machine (`localStorage.bt-needs-password`) from
  the moment an invite or recovery link is seen until a password has actually been saved,
  and cleared on sign-out; a refresh in between no longer skips it (13533–13543, 13668).
- The `sb.from()` wrapper retries a request **once** when it comes back 401, after waiting
  for the session, so a start-up race costs a few hundred milliseconds instead of an empty
  screen (1949–1964).
- The home screen now checks all seventeen of its queries for an error, not four (3012).

Verified after the change: the full scenario set above again, plus 10 fresh sign-ins.
