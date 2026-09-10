#!/usr/bin/env python3
"""Apply the SQL files in migrations/ to the TEST project, in order, idempotently.

Each file is sent whole to the Management API SQL endpoint using the sweep token, which
is scoped to the test project only and cannot reach production. Pass a single filename to
apply just one; otherwise every migrations/*.sql not already in applied_migrations runs.

Usage: python3 tests/apply_migrations.py [migrations/0059_*.sql ...]
"""
import glob, json, os, sys, time, urllib.request

REF = 'otwzrmwvvrtjosxgqhkb'
TOKEN = os.environ['SUPABASE_SWEEP_TOKEN']
ROOT = os.path.join(os.path.dirname(__file__), '..')

def sql(query):
    req = urllib.request.Request(f'https://api.supabase.com/v1/projects/{REF}/database/query',
        data=json.dumps({'query': query}).encode(), method='POST',
        headers={'Authorization': f'Bearer {TOKEN}', 'Content-Type': 'application/json',
                 'User-Agent': 'curl/8.7.1', 'Accept': 'application/json'})
    for attempt in range(3):
        try:
            with urllib.request.urlopen(req, timeout=180) as r:
                return True, json.loads(r.read().decode() or '[]')
        except urllib.error.HTTPError as e:
            msg = e.read().decode()
            if e.code >= 500 and attempt < 2: time.sleep(3); continue
            return False, msg
        except Exception as e:
            if attempt < 2: time.sleep(3); continue
            return False, str(e)

ok, done = sql("select name from applied_migrations")
applied = {r['name'] for r in done} if ok else set()
files = sys.argv[1:] or sorted(glob.glob(os.path.join(ROOT, 'migrations', '*.sql')))
for f in files:
    name = os.path.basename(f)[:-4]
    if name in applied and not sys.argv[1:]:
        print(f'  {name}: already applied, skipping'); continue
    ok, out = sql(open(f).read())
    print(f'  {name}: {"OK" if ok else "FAIL " + str(out)[:400]}')
