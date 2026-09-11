-- 0070: a quotation is marked approved by an owner only (Charles's decision on
-- SECURITY-AUDIT 7.6, taken 11 September 2026). Same rule as an order's approval.

create or replace function public.guard_quotation_approval()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- a session with nobody signed in is the SQL editor or a migration: an administrator
  if auth.uid() is null then return new; end if;
  if new.status = 'approved'
     and (tg_op = 'INSERT' or old.status is distinct from 'approved')
     and not is_owner() then
    raise exception 'Only an owner can mark a quotation approved.';
  end if;
  return new;
end $$;

drop trigger if exists quotations_approval_is_the_owners on public.quotations;
create trigger quotations_approval_is_the_owners
  before insert or update of status on public.quotations
  for each row execute function public.guard_quotation_approval();

insert into public.applied_migrations (name) values ('0070_quotation_approval_is_the_owners') on conflict do nothing;
