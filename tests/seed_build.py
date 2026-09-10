#!/usr/bin/env python3
"""Seed the TEST project with production's reference data and two test logins.

Reference data only (catalogue, packs, aliases, document metadata, transport, equivalents,
offices, settings, warehouses). Nothing with a person or a client in it is copied.
Users are created directly in auth.users / auth.identities with bcrypt hashes, which is
the standard way to seed a Supabase project without the service key; the production
trigger on auth.users then creates their profiles.

Usage: python3 seed_build.py           (SUPABASE_SWEEP_TOKEN in the environment)
"""
import json, os, secrets, string, sys, time, urllib.request

REF = 'otwzrmwvvrtjosxgqhkb'                      # the TEST project, never production
TOKEN = os.environ['SUPABASE_SWEEP_TOKEN']
ENV = '/Users/amu/Documents/buildtech2026.09.10e/.env.local'
S = lambda k: json.load(open(f'schema/seed/{k}.json'))

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

TAG = '$zq$'
def lit(v):
    if v is None: return 'NULL'
    if isinstance(v, bool): return 'true' if v else 'false'
    if isinstance(v, (int, float)): return repr(v)
    if isinstance(v, list): return TAG + '{' + ','.join(json.dumps(str(x)) for x in v) + '}' + TAG
    if isinstance(v, dict): return TAG + json.dumps(v) + TAG + '::jsonb'
    s = str(v)
    assert TAG not in s
    return TAG + s + TAG

def insert(table, rows, drop=(), batch=40):
    if not rows: print(f'  {table}: nothing to insert'); return
    cols = [c for c in rows[0].keys() if c not in drop]
    total = 0; errs = 0
    for i in range(0, len(rows), batch):
        chunk = rows[i:i + batch]
        vals = ',\n'.join('(' + ', '.join(lit(r.get(c)) for c in cols) + ')' for r in chunk)
        q = f'insert into public.{table} ({", ".join(chr(34) + c + chr(34) for c in cols)}) values\n{vals}\non conflict do nothing'
        ok, out = sql(q)
        if ok: total += len(chunk)
        else: errs += 1; print(f'  {table} batch {i}: FAIL {str(out)[:300]}')
    ok, out = sql(f'select count(*)::int as n from public.{table}')
    print(f'  {table}: sent {total} rows, batches failed {errs}, now in table: {out[0]["n"] if ok else out}')

print('1. reference data')
insert('offices', S('offices'))
insert('settings', S('settings'), drop=('updated_by',))
insert('products', S('products'))
insert('product_packs', S('product_packs'))
insert('product_aliases', S('product_aliases'))
insert('product_documents', S('product_documents'))
insert('product_transport', S('product_transport'))
insert('spec_equivalents', S('spec_equivalents'))
insert('warehouses', S('warehouses'))

print('2. test logins')
alphabet = string.ascii_letters + string.digits
def pw(): return ''.join(secrets.choice(alphabet) for _ in range(20))
env = open(ENV).read()
users = [('SWEEP_OWNER', 'sweep-owner@example.com', 'Sweep Owner', 'owner'),
         ('SWEEP_FULL',  'sweep-full@example.com',  'Sweep Full',  'full')]
dubai = [o for o in S('offices') if o['code'] == 'DXB'][0]['id']
for key, email, name, role in users:
    m = [l for l in env.split('\n') if l.startswith(key + '_PASS=')]
    password = m[0].split('=', 1)[1] if m else pw()
    if not m: env += f'{key}_EMAIL={email}\n{key}_PASS={password}\n'
    q = f"""
    with u as (
      insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
        raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
        confirmation_token, recovery_token, email_change, email_change_token_new, email_change_token_current, is_sso_user)
      select '00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated',
        {lit(email)}, extensions.crypt({lit(password)}, extensions.gen_salt('bf')), now(),
        '{{"provider":"email","providers":["email"]}}'::jsonb, {lit({'full_name': name})}, now(), now(),
        '', '', '', '', '', false
      where not exists (select 1 from auth.users where email = {lit(email)})
      returning id, email)
    insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    select gen_random_uuid(), u.id, u.id::text,
           jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true, 'phone_verified', false),
           'email', now(), now(), now()
    from u"""
    ok, out = sql(q)
    print(f'  {email}: {"created" if ok else "FAIL " + str(out)[:300]}')
    ok, out = sql(f"update public.profiles set role = {lit(role)}, office_id = {lit(dubai)}, full_name = {lit(name)} where email = {lit(email)} returning id, role, office_id")
    print(f'    profile: {out if ok else "FAIL " + str(out)[:300]}')
open(ENV, 'w').write(env)

print('3. counts')
ok, out = sql("""select (select count(*) from auth.users) as users, (select count(*) from profiles) as profiles,
                        (select count(*) from products) as products, (select count(*) from product_packs) as packs,
                        (select count(*) from offices) as offices, (select count(*) from settings) as settings,
                        (select count(*) from storage.buckets) as buckets""")
print('  ', out)
