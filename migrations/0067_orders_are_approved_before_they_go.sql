-- 0067: a purchase order is asked for, approved by an owner, and only then sent (Phase 5 B,
-- Charles's item 2).
--
-- An order used to go from draft straight to sent with nobody signing it off. It now
-- passes through "waiting for approval" and "approved", the approval is an owner's alone,
-- and who asked, who approved and who sent are written on the order with the time.

alter type public.po_status add value if not exists 'pending_approval' before 'sent';
alter type public.po_status add value if not exists 'approved' before 'sent';

alter table public.purchase_orders
  add column if not exists submitted_by uuid references public.profiles(id),
  add column if not exists submitted_at timestamptz,
  add column if not exists approved_by  uuid references public.profiles(id),
  add column if not exists approved_at  timestamptz,
  add column if not exists sent_by      uuid references public.profiles(id),
  add column if not exists sent_at      timestamptz;

-- The status values are compared as text on purpose: an enum value added in this same
-- migration cannot be named in it until the migration has been committed.
create or replace function public.guard_po_status()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  was text := coalesce(old.status::text, '');
  becomes text := new.status::text;
  uid uuid;
begin
  if was = becomes then return new; end if;
  begin
    execute 'select auth.uid()' into uid;
  exception when others then uid := null;
  end;
  if becomes = 'pending_approval' then
    new.submitted_by := coalesce(uid, new.submitted_by);
    new.submitted_at := now();
  elsif becomes = 'approved' then
    if not is_owner() then
      raise exception 'Only an owner can approve an order.';
    end if;
    new.approved_by := coalesce(uid, new.approved_by);
    new.approved_at := now();
  elsif becomes = 'sent' then
    if was <> 'approved' then
      raise exception 'An order has to be approved before it is sent.';
    end if;
    new.sent_by := coalesce(uid, new.sent_by);
    new.sent_at := now();
  end if;
  return new;
end $$;

drop trigger if exists po_status_flow on public.purchase_orders;
create trigger po_status_flow before update of status on public.purchase_orders
  for each row execute function public.guard_po_status();

insert into public.applied_migrations (name) values ('0067_orders_are_approved_before_they_go') on conflict do nothing;
