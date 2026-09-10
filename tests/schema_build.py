#!/usr/bin/env python3
"""Rebuild the production schema inside the TEST project from the catalogue exports.

Reads schema/*.json (taken read-only from production) and issues DDL, one statement at a
time, through the Management API SQL endpoint using the sweep token, which is scoped to
the test project only. Nothing here can reach production: the ref is hard-coded to the
test project and the token cannot see any other project.

Usage: python3 schema_build.py            (reads SUPABASE_SWEEP_TOKEN from the environment)
"""
import json, os, re, sys, time, urllib.request, collections

REF = 'otwzrmwvvrtjosxgqhkb'                      # the TEST project, never production
TOKEN = os.environ['SUPABASE_SWEEP_TOKEN']
L = lambda k: json.load(open(f'schema/{k}.json'))
log = open('schema/build.log', 'w')

def sql(query, quiet=False):
    body = json.dumps({'query': query}).encode()
    req = urllib.request.Request(f'https://api.supabase.com/v1/projects/{REF}/database/query',
        data=body, method='POST', headers={'Authorization': f'Bearer {TOKEN}',
        'Content-Type': 'application/json', 'User-Agent': 'curl/8.7.1', 'Accept': 'application/json'})
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

ok_n = 0; fail = []
def run(label, query):
    global ok_n
    ok, out = sql(query)
    log.write(f'\n-- {label}\n{query}\n-- {"OK" if ok else "FAIL: " + str(out)[:400]}\n'); log.flush()
    if ok: ok_n += 1
    else: fail.append((label, str(out)[:300]))
    return ok, out

def retry_until_stable(items, label):
    """items: list of (name, sql). Runs them, retrying failures until no progress."""
    pending = list(items); rounds = 0
    while pending and rounds < 8:
        rounds += 1; nxt = []
        for name, q in pending:
            ok, out = sql(q)
            log.write(f'\n-- {label} {name} (round {rounds})\n{q[:2000]}\n-- {"OK" if ok else "FAIL: " + str(out)[:300]}\n')
            if ok: globals()['ok_n'] += 1
            else: nxt.append((name, q, str(out)[:200]))
        if len(nxt) == len(pending):
            for name, q, err in nxt: fail.append((f'{label} {name}', err))
            break
        pending = [(n, q) for n, q, _ in nxt]
    return pending

rel = L('relations'); cols = L('columns'); cons = L('constraints'); idx = L('indexes')
views = L('views'); funcs = L('functions'); trig = L('triggers'); pol = L('policies')
types = L('types'); seqs = L('sequences'); buckets = L('buckets')
tables = [r['name'] for r in rel if r['schema'] == 'public' and r['kind'] in ('r', 'p')]
bycol = collections.defaultdict(list)
for c in cols:
    if c['table_name'] in tables: bycol[c['table_name']].append(c)
bycon = collections.defaultdict(list)
for c in cons: bycon[c['table']].append(c)
con_names = {c['conname'] for c in cons}

print('0. sanity: test project is empty of app objects?')
ok, out = sql("select count(*) as n from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind in ('r','v')")
print('   public relations before build:', out)
if ok and out and out[0]['n'] > 0 and '--force' not in sys.argv:
    print('   refusing: the project already has public relations. Pass --force to build anyway.'); sys.exit(1)

print('1. extensions and enums')
run('ext pgcrypto', 'create extension if not exists pgcrypto with schema extensions')
def pg_array(v):
    """The API hands Postgres arrays back as their text literal, '{a,b,c}'."""
    if isinstance(v, list): return v
    s = str(v or '').strip()
    if s.startswith('{') and s.endswith('}'): s = s[1:-1]
    return [x.strip().strip('"') for x in s.split(',') if x.strip()]
for t in types:
    if t['kind'] == 'e':
        vals = ', '.join("'" + v.replace("'", "''") + "'" for v in pg_array(t['enum_values']))
        run(f'enum {t["name"]}', f"do $$ begin create type public.{t['name']} as enum ({vals}); "
                                 f"exception when duplicate_object then null; end $$")

print('2. sequences')
for s in seqs:
    run(f'seq {s["sequencename"]}', f'create sequence if not exists public.{s["sequencename"]} as {s["data_type"]} '
        f'increment by {s["increment_by"]} minvalue {s["min_value"]} maxvalue {s["max_value"]} start with {s["start_value"]}')

print('3. tables')
for t in tables:
    parts = []
    for c in sorted(bycol[t], key=lambda x: x['ordinal_position']):
        d = f'"{c["column_name"]}" {c["full_type"]}'
        if c['is_generated'] == 'ALWAYS':
            d += f' generated always as ({c["generation_expression"]}) stored'
        elif c['is_identity'] == 'YES':
            d += f' generated {c["identity_generation"].lower()} as identity'
        elif c['column_default'] is not None:
            d += f' default {c["column_default"]}'
        if c['is_nullable'] == 'NO': d += ' not null'
        parts.append(d)
    for c in bycon[t]:
        if c['contype'] in ('p', 'u', 'c', 'x'):
            parts.append(f'constraint "{c["conname"]}" {c["definition"]}')
    run(f'table {t}', f'create table if not exists public.{t} (\n  ' + ',\n  '.join(parts) + '\n)')
for s in seqs:
    owner = [c for c in cols if c['column_default'] and s['sequencename'] in str(c['column_default'])]
    if owner:
        run(f'seq owner {s["sequencename"]}', f'alter sequence public.{s["sequencename"]} owned by public.{owner[0]["table_name"]}.{owner[0]["column_name"]}')
        if s.get('last_value'): run(f'seq value {s["sequencename"]}', f"select setval('public.{s['sequencename']}', {int(s['last_value'])})")

print('4. foreign keys')
for c in cons:
    if c['contype'] == 'f':
        run(f'fk {c["table"]}.{c["conname"]}', f'do $$ begin alter table public.{c["table"]} add constraint "{c["conname"]}" {c["definition"]}; '
                                                 f'exception when duplicate_object then null; end $$')

print('5. indexes (those not owned by a constraint)')
for i in idx:
    if i['indexname'] in con_names: continue
    run(f'index {i["indexname"]}', re.sub(r'^CREATE (UNIQUE )?INDEX ', lambda m: f'CREATE {m.group(1) or ""}INDEX IF NOT EXISTS ', i['indexdef']))

print('6. views')
pending = retry_until_stable([(v['name'], f'create or replace view public.{v["name"]} as {v["definition"]}') for v in views], 'view')
for v in views:
    if v.get('reloptions') and any('security_invoker=true' in o for o in v['reloptions']):
        run(f'view opt {v["name"]}', f'alter view public.{v["name"]} set (security_invoker = true)')

print('7. functions')
retry_until_stable([(f'{f["name"]}({f["args"]})', f['definition']) for f in funcs], 'function')

print('8. triggers')
for t in trig:
    if t['schema'] == 'storage': continue
    run(f'trigger {t["schema"]}.{t["table"]}.{t["name"]}',
        f'drop trigger if exists {t["name"]} on {t["schema"]}.{t["table"]}; ' + t['definition'])

print('9. row level security and policies')
for r in rel:
    if r['schema'] == 'public' and r['kind'] in ('r', 'p') and r['rls_enabled']:
        run(f'rls {r["name"]}', f'alter table public.{r["name"]} enable row level security'
            + (f'; alter table public.{r["name"]} force row level security' if r['rls_forced'] else ''))
def roles_of(v):
    return ', '.join(pg_array(v))
for p in pol:
    cmd = p['cmd']; q = (f'drop policy if exists "{p["policyname"]}" on {p["schemaname"]}.{p["tablename"]}; '
                         f'create policy "{p["policyname"]}" on {p["schemaname"]}.{p["tablename"]} as {p["permissive"].lower()} for {cmd.lower()} to {roles_of(p["roles"])}')
    if cmd != 'INSERT' and p['qual'] is not None: q += f' using ({p["qual"]})'
    if cmd in ('INSERT', 'UPDATE', 'ALL') and p['with_check'] is not None: q += f' with check ({p["with_check"]})'
    run(f'policy {p["schemaname"]}.{p["tablename"]}.{p["policyname"]}', q)

print('10. grants: anon has nothing in public, as in production')
for q in ['revoke all on all tables in schema public from anon',
          'revoke all on all sequences in schema public from anon',
          'revoke all on all routines in schema public from anon',
          'alter default privileges for role postgres in schema public revoke all on tables from anon',
          'alter default privileges for role postgres in schema public revoke all on sequences from anon',
          'alter default privileges for role postgres in schema public revoke all on routines from anon']:
    run('grant ' + q[:40], q)

print('11. storage buckets')
for b in buckets:
    run(f'bucket {b["id"]}', f"insert into storage.buckets (id, name, public) values ('{b['id']}', '{b['name']}', {str(bool(b['public'])).lower()}) on conflict (id) do nothing")

print(f'\nstatements ok: {ok_n}   failed: {len(fail)}')
for name, err in fail: print('  FAIL', name, '→', err)
log.close()
