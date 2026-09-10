-- 0064  Held stock cannot be issued (FINDINGS F-026, SECURITY-AUDIT 7.5)
--
-- The Stock page lists what Civil Defence has not cleared, but nothing stopped an "out"
-- movement on it, in the app or in the database, and nothing stopped a movement for more
-- than was on hand. Both rules now live where they cannot be bypassed. Receiving is not
-- affected: material can always come in; it is leaving that needs the paperwork.

create or replace function public.refuse_issue_of_held_stock()
returns trigger language plpgsql as $$
declare p products%rowtype; w warehouses%rowtype; v_on_hand numeric;
begin
  if new.direction <> 'out' then return new; end if;
  select * into p from products   where id = new.product_id;
  select * into w from warehouses where id = new.warehouse_id;
  if not p.dcd_approved or (p.dcd_expiry is not null and p.dcd_expiry < current_date) then
    raise exception '% has no valid Civil Defence approval, so it cannot leave the warehouse.', p.name;
  end if;
  if not w.dcd_certified or (w.dcd_expiry is not null and w.dcd_expiry < current_date) then
    raise exception '% has no valid Civil Defence storage certificate, so nothing can leave it.', w.name;
  end if;
  select coalesce(qty_on_hand, 0) into v_on_hand from stock
   where product_id = new.product_id and warehouse_id = new.warehouse_id;
  if coalesce(v_on_hand, 0) < new.quantity then
    raise exception 'Only % % of % is on hand at %, so % cannot be issued.',
      round(coalesce(v_on_hand, 0), 3), coalesce(p.name, ''), p.name, w.name, new.quantity;
  end if;
  return new;
end $$;

drop trigger if exists stock_out_needs_civil_defence on public.stock_movements;
create trigger stock_out_needs_civil_defence before insert on public.stock_movements
  for each row execute function public.refuse_issue_of_held_stock();

insert into public.applied_migrations (name) values ('0064_held_stock_stays_put') on conflict do nothing;
