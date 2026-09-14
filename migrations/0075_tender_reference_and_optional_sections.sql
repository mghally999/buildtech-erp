-- 0075: two things a tender and a quotation sheet carry that a quotation could not.
--
-- The client's tender or enquiry reference ("Tender Ref. 7090") had no column. The scope
-- reader read it off the document and dropped it, and a quotation typed by hand had nowhere
-- to put it. It prints under the client on the sheet, and only when there is one.
--
-- A section offered as an option, priced for the client to see but not part of the price,
-- had no flag, so it counted in every total. An optional section is left out of the
-- quotation's subtotal and cost here, as it is on the screen and on the sheet. Every
-- section that exists today is not optional, so no total that exists today moves.

alter table public.quotations
  add column if not exists client_reference text;

alter table public.quotation_sections
  add column if not exists is_optional boolean not null default false;

-- save_quotation as in 0065, carrying the flag
create or replace function public.save_quotation(p_quotation uuid, p_sections jsonb)
returns timestamptz
language plpgsql
security invoker
set search_path = public
as $$
declare
  s jsonb; l jsonb; sid uuid; i int := 0; j int; ts timestamptz;
begin
  if not exists (select 1 from quotations where id = p_quotation) then
    raise exception 'That quotation is not there, or is not yours to change.';
  end if;
  delete from quotation_sections where quotation_id = p_quotation;
  for s in select * from jsonb_array_elements(coalesce(p_sections, '[]'::jsonb)) loop
    i := i + 1;
    insert into quotation_sections (quotation_id, position, title, is_optional)
      values (p_quotation, i, coalesce(nullif(s->>'title', ''), 'Section ' || i),
              coalesce((s->>'is_optional')::boolean, false))
      returning id into sid;
    j := 0;
    for l in select * from jsonb_array_elements(coalesce(s->'lines', '[]'::jsonb)) loop
      j := j + 1;
      insert into quotation_lines (section_id, position, description, is_spec_note, is_bold,
                                   is_costing, product_id, unit, quantity, sell_rate,
                                   cost_rate, is_provisional)
      values (sid, j, coalesce(l->>'description', ''),
              coalesce((l->>'is_spec_note')::boolean, false),
              coalesce((l->>'is_bold')::boolean, false),
              coalesce((l->>'is_costing')::boolean, false),
              nullif(l->>'product_id', '')::uuid,
              nullif(l->>'unit', ''),
              nullif(l->>'quantity', '')::numeric,
              nullif(l->>'sell_rate', '')::numeric,
              nullif(l->>'cost_rate', '')::numeric,
              coalesce((l->>'is_provisional')::boolean, false));
    end loop;
  end loop;
  update quotations set updated_at = now() where id = p_quotation returning updated_at into ts;
  return ts;
end $$;

-- quotation_totals as in 0059, over the sections that are part of the price. The option is
-- restated because a replaced view keeps only the options it is given, and 0063 made every
-- view run as the person reading it.
create or replace view public.quotation_totals with (security_invoker = true) as
select v.quotation_id, v.subtotal, v.cost_total, v.gross_profit, p.office_id
from (
  select q.id as quotation_id,
         coalesce(sum(l.quantity * l.sell_rate) filter (where not l.is_costing), 0::numeric) as subtotal,
         coalesce(sum(l.quantity * l.cost_rate), 0::numeric) as cost_total,
         coalesce(sum(l.quantity * l.sell_rate) filter (where not l.is_costing), 0::numeric)
           - coalesce(sum(l.quantity * l.cost_rate), 0::numeric) as gross_profit
  from quotations q
  left join quotation_sections s on s.quotation_id = q.id and not s.is_optional
  left join quotation_lines l on l.section_id = s.id and l.is_spec_note = false
  group by q.id) v
left join quotations p on p.id = v.quotation_id;

insert into public.applied_migrations (name) values ('0075_tender_reference_and_optional_sections') on conflict do nothing;
