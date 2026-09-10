-- Build-Tech Pro sweep: read-only inspection queries.
--
-- Run these in the Supabase SQL editor (Dashboard → SQL Editor) on the project you want
-- inspected. Every statement is a SELECT on the system catalogues; nothing is changed.
-- Download each result as JSON or CSV and drop the files into docs/schema/ so the audit
-- can read them. Run them one block at a time: the editor shows one result per run.

-- 1. Row-level security: which tables have it on, and every policy in words.
select c.relname as table_name, c.relrowsecurity as rls_enabled, c.relforcerowsecurity as rls_forced
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind in ('r','p')
order by c.relname;

-- 2. The policies themselves.
select schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
from pg_policies
where schemaname in ('public','storage')
order by schemaname, tablename, policyname;

-- 3. Functions, including which ones run as SECURITY DEFINER (they bypass RLS).
select p.proname as name,
       pg_get_function_identity_arguments(p.oid) as args,
       p.prosecdef as security_definer,
       p.proconfig as config,
       pg_get_functiondef(p.oid) as definition
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
order by p.proname;

-- 4. Triggers on application tables.
select c.relname as table_name, t.tgname as trigger_name, pg_get_triggerdef(t.oid, true) as definition
from pg_trigger t join pg_class c on c.oid = t.tgrelid
join pg_namespace n on n.oid = c.relnamespace
where not t.tgisinternal and n.nspname = 'public'
order by c.relname, t.tgname;

-- 5. Constraints: primary keys, foreign keys, unique and check rules.
select r.relname as table_name, con.conname, con.contype, pg_get_constraintdef(con.oid, true) as definition
from pg_constraint con join pg_class r on r.oid = con.conrelid
join pg_namespace n on n.oid = r.relnamespace
where n.nspname = 'public'
order by r.relname, con.contype, con.conname;

-- 6. Column defaults and types, exactly as Postgres holds them.
select table_name, ordinal_position, column_name, data_type, udt_name,
       numeric_precision, numeric_scale, is_nullable, column_default, is_generated
from information_schema.columns
where table_schema = 'public'
order by table_name, ordinal_position;

-- 7. View definitions.
select c.relname as view_name, pg_get_viewdef(c.oid, true) as definition
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind in ('v','m')
order by c.relname;

-- 8. Table grants to the roles the browser can hold.
select grantee, table_name, string_agg(privilege_type, ',' order by privilege_type) as privileges
from information_schema.role_table_grants
where table_schema = 'public' and grantee in ('anon','authenticated')
group by grantee, table_name
order by table_name, grantee;

-- 9. Which migrations have been applied.
select version, name from supabase_migrations.schema_migrations order by version;

-- 10. Approximate row counts (no data is read, only statistics).
select relname as table_name, n_live_tup as approx_rows
from pg_stat_user_tables where schemaname = 'public' order by relname;
