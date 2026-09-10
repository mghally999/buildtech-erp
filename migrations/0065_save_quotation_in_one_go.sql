-- 0065: a quotation's sections and lines are saved in one transaction (F-021), the
-- activity log stops recording every line (F-027), and a quotation remembers when it was
-- last saved so a stale draft on one machine can be told from a colleague's newer copy
-- (F-024).
--
-- Before this the editor deleted every section and then re-inserted sections and lines one
-- request at a time. Anything that failed after the delete (a dropped connection, a policy
-- refusal, a line the check constraint would not take) left the quotation with no sections
-- in the database, and the draft on that one machine as the only copy. A function runs
-- inside one transaction: either the whole new set is in, or the old set is untouched.

alter table public.quotations
  add column if not exists updated_at timestamptz not null default now();

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists quotations_touch_updated_at on public.quotations;
create trigger quotations_touch_updated_at before update on public.quotations
  for each row execute function public.touch_updated_at();

-- Runs as the caller (security invoker), so row level security decides what may be
-- touched exactly as it did for the separate requests.
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
    insert into quotation_sections (quotation_id, position, title)
      values (p_quotation, i, coalesce(nullif(s->>'title', ''), 'Section ' || i))
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

revoke execute on function public.save_quotation(uuid, jsonb) from public, anon;
grant execute on function public.save_quotation(uuid, jsonb) to authenticated;

-- One save of a 128-line quotation wrote about 256 rows to the activity log, and "Latest
-- changes" on the home screen was line churn. The quotation-level trigger stays.
drop trigger if exists log_quotation_lines on public.quotation_lines;

insert into public.applied_migrations (name) values ('0065_save_quotation_in_one_go') on conflict do nothing;
