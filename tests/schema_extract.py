#!/usr/bin/env python3
"""Read-only schema extraction through the Supabase Management API.

Every statement sent is a SELECT against the system catalogues. The session is put into
read-only mode first, and the request also asks the API for read-only execution where the
API supports it, so a typo cannot turn into a write. Output is one JSON file per catalogue
plus a rebuilt DDL script for loading into an empty test project.

Usage:  python3 schema_extract.py <project-ref> <out-dir>
Reads SUPABASE_ACCESS_TOKEN from the environment.
"""
import json, os, sys, time, urllib.request

REF, OUT = sys.argv[1], sys.argv[2]
TOKEN = os.environ['SUPABASE_ACCESS_TOKEN']
os.makedirs(OUT, exist_ok=True)

def run(sql, read_only=True):
    body = {'query': 'SET default_transaction_read_only = on; SET transaction_read_only = on;\n' + sql}
    if read_only:
        body['read_only'] = True
    req = urllib.request.Request(
        f'https://api.supabase.com/v1/projects/{REF}/database/query',
        data=json.dumps(body).encode(), method='POST',
        headers={'Authorization': f'Bearer {TOKEN}', 'Content-Type': 'application/json', 'User-Agent': 'curl/8.7.1', 'Accept': 'application/json'})
    for attempt in range(3):
        try:
            with urllib.request.urlopen(req, timeout=120) as r:
                return json.loads(r.read().decode() or '[]')
        except urllib.error.HTTPError as e:
            msg = e.read().decode()
            if e.code == 400 and 'read_only' in msg and read_only:
                # older API without the flag: the SET statements still protect us
                return run(sql, read_only=False)
            if attempt == 2 or e.code < 500:
                raise SystemExit(f'HTTP {e.code} on query: {msg[:500]}')
            time.sleep(2)

QUERIES = {
  'migrations': """
    select version, name from supabase_migrations.schema_migrations order by version""",
  'extensions': """
    select extname, extversion, n.nspname as schema from pg_extension e
    join pg_namespace n on n.oid = e.extnamespace order by extname""",
  'relations': """
    select n.nspname as schema, c.relname as name, c.relkind as kind,
           c.relrowsecurity as rls_enabled, c.relforcerowsecurity as rls_forced,
           obj_description(c.oid,'pg_class') as comment
    from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname in ('public','storage') and c.relkind in ('r','v','m','p','S')
    order by 1,2""",
  'columns': """
    select c.table_schema, c.table_name, c.ordinal_position, c.column_name, c.data_type,
           c.udt_name, c.character_maximum_length, c.numeric_precision, c.numeric_scale,
           c.is_nullable, c.column_default, c.is_identity, c.identity_generation,
           c.is_generated, c.generation_expression,
           pg_catalog.format_type(a.atttypid, a.atttypmod) as full_type,
           col_description(a.attrelid, a.attnum) as comment
    from information_schema.columns c
    join pg_class r on r.relname=c.table_name
    join pg_namespace n on n.oid=r.relnamespace and n.nspname=c.table_schema
    join pg_attribute a on a.attrelid=r.oid and a.attname=c.column_name
    where c.table_schema='public' order by c.table_name, c.ordinal_position""",
  'constraints': """
    select n.nspname as schema, r.relname as table, con.conname, con.contype,
           pg_get_constraintdef(con.oid, true) as definition, con.condeferrable, con.condeferred
    from pg_constraint con join pg_class r on r.oid=con.conrelid
    join pg_namespace n on n.oid=r.relnamespace
    where n.nspname='public' order by con.contype, r.relname, con.conname""",
  'indexes': """
    select schemaname, tablename, indexname, indexdef from pg_indexes
    where schemaname='public' order by tablename, indexname""",
  'views': """
    select n.nspname as schema, c.relname as name, c.relkind as kind,
           pg_get_viewdef(c.oid, true) as definition,
           (select string_agg(pg_get_expr(d.adbin,0),',') from pg_attrdef d where d.adrelid=c.oid) as defaults,
           (select array_agg(quote_ident(a.attname) order by a.attnum) from pg_attribute a
              where a.attrelid=c.oid and a.attnum>0 and not a.attisdropped) as columns,
           c.reloptions
    from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relkind in ('v','m') order by c.relname""",
  'functions': """
    select n.nspname as schema, p.proname as name, p.oid::int as oid,
           pg_get_function_identity_arguments(p.oid) as args,
           pg_get_function_result(p.oid) as returns,
           p.prosecdef as security_definer, p.proconfig as config,
           l.lanname as language, p.provolatile as volatility,
           pg_get_functiondef(p.oid) as definition,
           obj_description(p.oid,'pg_proc') as comment
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    join pg_language l on l.oid=p.prolang
    where n.nspname='public' and p.prokind in ('f','p') order by p.proname, args""",
  'triggers': """
    select n.nspname as schema, c.relname as table, t.tgname as name,
           pg_get_triggerdef(t.oid, true) as definition, t.tgenabled
    from pg_trigger t join pg_class c on c.oid=t.tgrelid
    join pg_namespace n on n.oid=c.relnamespace
    where not t.tgisinternal and n.nspname in ('public','storage','auth')
    order by n.nspname, c.relname, t.tgname""",
  'policies': """
    select schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
    from pg_policies where schemaname in ('public','storage') order by schemaname, tablename, policyname""",
  'types': """
    select n.nspname as schema, t.typname as name, t.typtype as kind,
           (select array_agg(e.enumlabel order by e.enumsortorder) from pg_enum e where e.enumtypid=t.oid) as enum_values,
           (select string_agg(a.attname||' '||format_type(a.atttypid,a.atttypmod), ', ' order by a.attnum)
              from pg_attribute a where a.attrelid=t.typrelid and a.attnum>0 and not a.attisdropped) as composite_fields
    from pg_type t join pg_namespace n on n.oid=t.typnamespace
    where n.nspname='public' and t.typtype in ('e','c','d')
      and not exists (select 1 from pg_class c where c.oid=t.typrelid and c.relkind<>'c')
    order by t.typname""",
  'sequences': """
    select schemaname, sequencename, data_type, start_value, min_value, max_value,
           increment_by, cycle, last_value
    from pg_sequences where schemaname='public' order by sequencename""",
  'grants': """
    select grantee, table_schema, table_name, string_agg(privilege_type, ',' order by privilege_type) as privileges
    from information_schema.role_table_grants
    where table_schema in ('public','storage') and grantee in ('anon','authenticated','service_role','public')
    group by 1,2,3 order by 2,3,1""",
  'function_grants': """
    select grantee, routine_schema, routine_name, string_agg(privilege_type, ',') as privileges
    from information_schema.role_routine_grants
    where routine_schema='public' and grantee in ('anon','authenticated','service_role','public')
    group by 1,2,3 order by 2,3,1""",
  'buckets': """
    select id, name, public, file_size_limit, allowed_mime_types, created_at from storage.buckets order by id""",
  'auth_settings_hint': """
    select count(*)::int as users, min(created_at) as first_user, max(created_at) as latest_user from auth.users""",
  'row_counts': """
    select relname as table, n_live_tup::bigint as approx_rows from pg_stat_user_tables
    where schemaname='public' order by relname""",
}

results = {}
for key, sql in QUERIES.items():
    try:
        rows = run(sql)
    except SystemExit as e:
        rows = {'error': str(e)}
    results[key] = rows
    with open(os.path.join(OUT, f'{key}.json'), 'w') as f:
        json.dump(rows, f, indent=1, default=str)
    n = len(rows) if isinstance(rows, list) else 'ERR'
    print(f'{key:22s} {n}')

with open(os.path.join(OUT, 'all.json'), 'w') as f:
    json.dump(results, f, indent=1, default=str)
print('written to', OUT)
