-- 0063  Views run as the person reading them (SECURITY-AUDIT 7.1)
--
-- Twenty of the views ran with their owner's rights and so ignored row-level security on
-- the tables underneath. Today that changes nothing, because every table policy is open;
-- it is done now so that the day an office or owner rule is added to a table, the views
-- follow it instead of quietly showing every row.

do $$
declare v text;
begin
  for v in select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
            where n.nspname = 'public' and c.relkind = 'v'
              and coalesce(array_to_string(c.reloptions, ','), '') not like '%security_invoker=true%'
  loop
    execute format('alter view public.%I set (security_invoker = true)', v);
  end loop;
end $$;

insert into public.applied_migrations (name) values ('0063_views_obey_rls') on conflict do nothing;
