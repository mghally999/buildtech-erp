-- 0072: a purchase order is numbered by its office (Charles's decision on F-045, taken
-- 11 September 2026), the way quotations (0048) and invoices (0066) already are.
--
-- Orders drew their number by scanning every existing "PO-" reference for the largest
-- figure, so a Belgian order took the next Dubai number. Each office now keeps its own
-- series. Dubai carries on from where the scan had reached; Bruges starts PO-BE-0001.

alter table public.offices
  add column if not exists po_prefix text not null default 'PO-',
  add column if not exists po_suffix text not null default '',
  add column if not exists po_digits int  not null default 4,
  add column if not exists po_next   int  not null default 1;

update public.offices set po_next = (
  select coalesce(max(nullif(regexp_replace(reference, '\D', '', 'g'), '')::int), 0) + 1
  from public.purchase_orders where reference like 'PO-%')
  where code = 'DXB' and po_next = 1;

update public.offices set po_prefix = 'PO-BE-' where code = 'BRU' and po_prefix = 'PO-';

drop function if exists public.next_po_reference();
create or replace function public.next_po_reference(p_office uuid default null)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare o record;
begin
  if p_office is null then p_office := my_office_id(); end if;
  if p_office is null then select id into p_office from offices where code = 'DXB'; end if;
  update offices set po_next = po_next + 1
   where id = p_office
  returning po_prefix, po_suffix, po_digits, po_next - 1 as n into o;
  if not found then raise exception 'There is no office with that id.'; end if;
  return coalesce(o.po_prefix, '') || lpad(o.n::text, coalesce(o.po_digits, 4), '0') || coalesce(o.po_suffix, '');
end $$;

revoke execute on function public.next_po_reference(uuid) from public, anon;
grant execute on function public.next_po_reference(uuid) to authenticated;

insert into public.applied_migrations (name) values ('0072_orders_are_numbered_by_their_office') on conflict do nothing;
