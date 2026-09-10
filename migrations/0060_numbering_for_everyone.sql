-- 0060  Every user can number a quotation and an invoice (FINDINGS F-022, SECURITY-AUDIT 7.4)
--
-- next_quotation_reference bumps offices.quote_next and next_invoice_reference bumps a
-- settings row. Both tables are owner-only to write, and both functions ran as the caller,
-- so for anybody who is not an owner the update matched no rows: the quotation save said
-- "There is no office with that id" and the invoice insert failed on a null reference.
-- Running them as the definer is safe: each moves one counter and touches nothing else.
-- The anonymous role loses execute on every function that writes or reveals a number.

alter function public.next_quotation_reference(uuid) security definer set search_path = public;
alter function public.next_invoice_reference()       security definer set search_path = public;
drop function if exists public.next_quotation_reference();   -- the legacy overload nothing calls

revoke execute on function public.next_quotation_reference(uuid) from anon, public;
revoke execute on function public.next_invoice_reference()       from anon, public;
revoke execute on function public.next_po_reference()            from anon, public;
revoke execute on function public.receive_po_line(uuid, numeric, uuid, date, text) from anon, public;
revoke execute on function public.is_owner()                     from anon, public;

insert into public.applied_migrations (name) values ('0060_numbering_for_everyone') on conflict do nothing;
