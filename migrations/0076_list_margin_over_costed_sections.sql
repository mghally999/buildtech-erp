-- 0076: the Quotations list's margin is worked out over the sections that carry a cost.
--
-- The editor has always done it this way: a section with no cost on any of its lines is left
-- out of the margin, because its revenue with nothing against it reads as pure profit. The
-- list divided by the whole subtotal instead, so a quotation with one section costed and six
-- not read 91.0%. The view gains costed_subtotal, the subtotal of the costed sections, as its
-- last column, so everything that reads the view by name is untouched.

create or replace view public.quotation_totals with (security_invoker = true) as
select v.quotation_id, v.subtotal, v.cost_total, v.gross_profit, p.office_id, v.costed_subtotal
from (
  select q.id as quotation_id,
         coalesce(sum(l.quantity * l.sell_rate) filter (where not l.is_costing), 0::numeric) as subtotal,
         coalesce(sum(l.quantity * l.cost_rate), 0::numeric) as cost_total,
         coalesce(sum(l.quantity * l.sell_rate) filter (where not l.is_costing), 0::numeric)
           - coalesce(sum(l.quantity * l.cost_rate), 0::numeric) as gross_profit,
         coalesce(sum(l.quantity * l.sell_rate) filter (where not l.is_costing and s.costed), 0::numeric) as costed_subtotal
  from quotations q
  left join (select s.id, s.quotation_id, s.is_optional,
                    exists (select 1 from quotation_lines c
                             where c.section_id = s.id and not c.is_spec_note and c.cost_rate is not null) as costed
               from quotation_sections s) s on s.quotation_id = q.id and not s.is_optional
  left join quotation_lines l on l.section_id = s.id and l.is_spec_note = false
  group by q.id) v
left join quotations p on p.id = v.quotation_id;

insert into public.applied_migrations (name) values ('0076_list_margin_over_costed_sections') on conflict do nothing;
