-- 0069: salaries, the partner ledger and the bank accounts are the owners' business
-- (Charles's decision on SECURITY-AUDIT 7.7, taken 11 September 2026).
--
-- Any signed-in user could read every salary, every drawing and every bank balance.
-- From here only an owner can read or write payroll, partners and bank_accounts; the
-- views built on them (cash_position, partner_ledger) follow, because since 0063 every
-- view runs as the person reading it. A payment or a cost still records which account
-- it went through, because that is an id, not a read of the account.

do $$
declare t text;
begin
  for t in select unnest(array['payroll','partners','bank_accounts']) loop
    execute format('drop policy if exists %I on public.%I', t || '_all_authenticated', t);
    execute format('drop policy if exists %I on public.%I', t || '_own_office', t);
    execute format('drop policy if exists %I on public.%I', t || '_owners_only', t);
    execute format('create policy %I on public.%I for all to authenticated using (is_owner()) with check (is_owner())',
                   t || '_owners_only', t);
  end loop;
end $$;

insert into public.applied_migrations (name) values ('0069_money_is_the_owners') on conflict do nothing;
