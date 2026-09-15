-- 0078: the log of who changed what belongs to an office, and so does a remembered cost.
--
-- activity_log had no office, and every signed-in person could read all of it, so Dubai's
-- changes were listed under Latest changes on Bruges's screens and a Bruges user could read
-- Dubai's price changes straight from the database. Each row now carries the office of the
-- record it is about, the rows already written get it where that record still exists, and a
-- row can be read by an owner or by the office it belongs to. A row about a record deleted
-- before today has no office left to find, so only an owner sees it.
--
-- product_wordings remembered one cost per product and wording, in whichever currency was
-- saved last, so a Bruges quotation could be handed a Dubai cost in dirhams. It now remembers
-- one per currency.

alter table public.activity_log
  add column if not exists office_id uuid references public.offices(id) on delete set null;

do $$
declare t text;
begin
  for t in select distinct a.table_name from public.activity_log a
            where exists (select 1 from information_schema.columns c
                           where c.table_schema = 'public' and c.table_name = a.table_name
                             and c.column_name = 'office_id')
  loop
    execute format('update public.activity_log a set office_id = x.office_id from public.%I x
                     where a.office_id is null and a.table_name = %L and a.row_id = x.id::text', t, t);
  end loop;
end $$;

-- a requirement has no office of its own; its approval has
update public.activity_log a set office_id = p.office_id
  from public.approval_requirements r join public.approvals p on p.id = r.approval_id
 where a.office_id is null and a.table_name = 'approval_requirements' and a.row_id = r.id::text;

create index if not exists activity_log_office_idx on public.activity_log (office_id, happened_at desc);

-- log_activity as before, now recording the office
create or replace function public.log_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old jsonb; v_new jsonb; v_id text; v_email text; v_sum text;
  v_parts text[] := '{}';
  v_key text; v_actor uuid; v_office uuid;
begin
  -- Everything goes through jsonb. Naming columns directly (old.status, old.value) only
  -- compiles on the tables that have them, so one trigger function shared across eight
  -- tables fails at runtime on the first table missing a column.
  if tg_op <> 'INSERT' then v_old := to_jsonb(old); end if;
  if tg_op <> 'DELETE' then v_new := to_jsonb(new); end if;
  v_id := coalesce(v_new->>'id', v_old->>'id', '');

  -- auth.uid() exists on Supabase and not in a plain Postgres. Never let the absence of a
  -- signed-in user, or anything else in here, stop the write it is recording.
  begin
    execute 'select auth.uid()' into v_actor;
    select email into v_email from auth.users where id = v_actor;
  exception when others then v_actor := null; v_email := null;
  end;

  -- the office of the record, or of the approval a requirement belongs to
  begin
    v_office := nullif(coalesce(v_new->>'office_id', v_old->>'office_id'), '')::uuid;
    if v_office is null and tg_table_name = 'approval_requirements' then
      select office_id into v_office from approvals
       where id = nullif(coalesce(v_new->>'approval_id', v_old->>'approval_id'), '')::uuid;
    end if;
  exception when others then v_office := null;
  end;

  if tg_op = 'INSERT' then
    v_sum := 'created';
  elsif tg_op = 'DELETE' then
    v_sum := 'deleted';
  else
    -- name the fields worth naming, and only those, so the log reads as English
    foreach v_key in array array['status','value','sell_rate','cost_rate','quantity',
                                 'amount','reference','paid_on','qty_ordered','qty_received']
    loop
      if v_old ? v_key and (v_old->>v_key) is distinct from (v_new->>v_key) then
        v_parts := v_parts || (replace(v_key,'_',' ') || ' ' ||
                   coalesce(nullif(v_old->>v_key,''),'blank') || ' to ' ||
                   coalesce(nullif(v_new->>v_key,''),'blank'));
      end if;
    end loop;
    v_sum := coalesce(nullif(array_to_string(v_parts, ', '), ''), 'edited');
  end if;

  begin
    insert into activity_log (actor, actor_email, table_name, row_id, action, summary, office_id)
    values (v_actor, v_email, tg_table_name, v_id, lower(tg_op), left(v_sum, 400), v_office);
  exception when others then null;   -- the log is never worth losing a real write over
  end;
  return null;
end $$;

drop policy if exists activity_log_read on public.activity_log;
create policy activity_log_read on public.activity_log for select to authenticated
  using (is_owner() or office_id = my_office_id());

-- one remembered cost per product, wording and currency
update public.product_wordings set currency = 'AED' where currency is null;
alter table public.product_wordings alter column currency set default 'AED';
alter table public.product_wordings alter column currency set not null;
alter table public.product_wordings drop constraint if exists product_wordings_product_id_wording_key;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'product_wordings_product_wording_currency_key') then
    alter table public.product_wordings
      add constraint product_wordings_product_wording_currency_key unique (product_id, wording, currency);
  end if;
end $$;

insert into public.applied_migrations (name) values ('0078_the_log_and_wordings_keep_to_their_office') on conflict do nothing;
