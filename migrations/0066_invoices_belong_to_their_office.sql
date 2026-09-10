-- 0066: an invoice is numbered by its office (F-002).
--
-- Every invoice took its number from the one counter in settings, whichever office raised
-- it, so a Belgian invoice would have carried a Dubai number. Each office now keeps its own
-- series, next to the quotation series it already had. Dubai carries on from the settings
-- counter it was using, so nothing already issued is disturbed; Bruges starts its own.

alter table public.offices
  add column if not exists invoice_prefix text not null default 'INV-',
  add column if not exists invoice_suffix text not null default '',
  add column if not exists invoice_digits int  not null default 4,
  add column if not exists invoice_next   int  not null default 1;

update public.offices set
  invoice_prefix = coalesce((select value from public.settings where key = 'invoice_prefix'), 'INV-'),
  invoice_suffix = coalesce((select value from public.settings where key = 'invoice_suffix'), ''),
  invoice_digits = coalesce((select nullif(trim(value), '')::int from public.settings where key = 'invoice_number_digits'), 4),
  invoice_next   = coalesce((select nullif(trim(value), '')::int from public.settings where key = 'invoice_next_number'), 1)
  where code = 'DXB';

update public.offices set invoice_prefix = 'INV-BE-' where code = 'BRU' and invoice_prefix = 'INV-';

-- The no-argument version updated settings; the office version replaces it. Security
-- definer, as for quotations (0060), because offices is owner-only and a full user has to
-- be able to number an invoice too.
drop function if exists public.next_invoice_reference();
create or replace function public.next_invoice_reference(p_office uuid default null)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare o record;
begin
  if p_office is null then select id into p_office from offices where code = 'DXB'; end if;
  update offices set invoice_next = invoice_next + 1
   where id = p_office
  returning invoice_prefix, invoice_suffix, invoice_digits, invoice_next - 1 as n into o;
  if not found then raise exception 'There is no office with that id.'; end if;
  return coalesce(o.invoice_prefix, '') || lpad(o.n::text, coalesce(o.invoice_digits, 4), '0')
         || coalesce(o.invoice_suffix, '');
end $$;

revoke execute on function public.next_invoice_reference(uuid) from public, anon;
grant execute on function public.next_invoice_reference(uuid) to authenticated;

insert into public.applied_migrations (name) values ('0066_invoices_belong_to_their_office') on conflict do nothing;
