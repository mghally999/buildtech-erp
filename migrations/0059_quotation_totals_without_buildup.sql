-- 0059  quotation_totals must not count build-up lines (FINDINGS F-001)
--
-- The editor and the printed sheet price a section on its priced lines only; the lines
-- marked is_costing are what the price is made of, shown to us and never charged. The
-- view summed them into the subtotal, so the Quotations list, its margin column and the
-- contract value copied onto a new project were all too high whenever a section carried
-- build-up. Cost still counts every line with a cost on it, because that is real money out.

create or replace view public.quotation_totals as
select v.quotation_id, v.subtotal, v.cost_total, v.gross_profit, p.office_id
from (
  select q.id as quotation_id,
         coalesce(sum(l.quantity * l.sell_rate) filter (where not l.is_costing), 0::numeric) as subtotal,
         coalesce(sum(l.quantity * l.cost_rate), 0::numeric) as cost_total,
         coalesce(sum(l.quantity * l.sell_rate) filter (where not l.is_costing), 0::numeric)
           - coalesce(sum(l.quantity * l.cost_rate), 0::numeric) as gross_profit
  from quotations q
  left join quotation_sections s on s.quotation_id = q.id
  left join quotation_lines l on l.section_id = s.id and l.is_spec_note = false
  group by q.id) v
left join quotations p on p.id = v.quotation_id;

insert into public.applied_migrations (name) values ('0059_quotation_totals_without_buildup') on conflict do nothing;
