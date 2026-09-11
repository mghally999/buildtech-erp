-- 0068: each office sees and writes only its own records; owners see and write both
-- (Charles's decision on SECURITY-AUDIT 7.3 and 7.10, taken 11 September 2026).
--
-- Until now every policy said "any signed-in user", and the two offices were kept apart
-- only by the screens. A person with the right tools could read the other office's books.
-- From here the database itself decides: an owner sees both offices (that is the BOTH
-- view they work in); everyone else sees their own office and nothing else, and a record
-- written into the other office is refused rather than silently accepted.

-- Whose office a request comes from. A profile with no office yet counts as the first
-- office (Dubai), so nobody is locked out on the day this goes live; an owner moves
-- people to Bruges from Settings, "Who can get in".
create or replace function public.my_office_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(p.office_id, (select id from offices order by position, code limit 1))
  from profiles p where p.id = auth.uid();
$$;
revoke execute on function public.my_office_id() from public, anon;
grant execute on function public.my_office_id() to authenticated;

-- every table that carries an office
do $$
declare t text;
begin
  for t in select unnest(array[
    'clients','field_visits','inquiries','quotations','projects','project_materials',
    'purchase_orders','shipments','warehouses','stock','stock_movements','approvals',
    'correspondence','invoices','expenses','bank_accounts','partners','payroll',
    'commitments','scope_documents'])
  loop
    execute format('drop policy if exists %I on public.%I', t || '_all_authenticated', t);
    execute format('drop policy if exists %I on public.%I', t || '_all', t);
    execute format('drop policy if exists %I on public.%I', t || '_own_office', t);
    execute format($p$
      create policy %I on public.%I for all to authenticated
      using (is_owner() or office_id = my_office_id())
      with check (is_owner() or office_id = my_office_id())
    $p$, t || '_own_office', t);
  end loop;
end $$;

-- the tables that belong to one of those records reach the rule through their parent
do $$
declare r record;
begin
  for r in select * from (values
      ('quotation_sections',    'quotation_id',  'quotations'),
      ('purchase_order_lines',  'po_id',         'purchase_orders'),
      ('po_documents',          'po_id',         'purchase_orders'),
      ('shipment_lines',        'shipment_id',   'shipments'),
      ('shipment_documents',    'shipment_id',   'shipments'),
      ('invoice_lines',         'invoice_id',    'invoices'),
      ('invoice_payments',      'invoice_id',    'invoices'),
      ('payment_milestones',    'project_id',    'projects'),
      ('commitment_lines',      'commitment_id', 'commitments'),
      ('commitment_documents',  'commitment_id', 'commitments'),
      ('approval_requirements', 'approval_id',   'approvals'),
      ('approval_documents',    'approval_id',   'approvals')
    ) as v(child, fk, parent)
  loop
    execute format('drop policy if exists %I on public.%I', r.child || '_all_authenticated', r.child);
    execute format('drop policy if exists %I on public.%I', r.child || '_all', r.child);
    execute format('drop policy if exists %I on public.%I', r.child || '_via_parent', r.child);
    execute format($p$
      create policy %I on public.%I for all to authenticated
      using (exists (select 1 from public.%I p where p.id = %I and (is_owner() or p.office_id = my_office_id())))
      with check (exists (select 1 from public.%I p where p.id = %I and (is_owner() or p.office_id = my_office_id())))
    $p$, r.child || '_via_parent', r.child, r.parent, r.fk, r.parent, r.fk);
  end loop;
end $$;

-- a quotation line reaches its office through its section
drop policy if exists quotation_lines_all_authenticated on public.quotation_lines;
drop policy if exists quotation_lines_via_parent on public.quotation_lines;
create policy quotation_lines_via_parent on public.quotation_lines for all to authenticated
  using (exists (select 1 from public.quotation_sections s join public.quotations q on q.id = s.quotation_id
                 where s.id = section_id and (is_owner() or q.office_id = my_office_id())))
  with check (exists (select 1 from public.quotation_sections s join public.quotations q on q.id = s.quotation_id
                 where s.id = section_id and (is_owner() or q.office_id = my_office_id())));

-- The document buckets follow their tables. A file is stored under the record's id
-- (scope documents under the office code), so the first part of its path says which
-- office it belongs to. The catalogue's sheets are shared, as the catalogue is.
create or replace function public.doc_in_my_office(p_bucket text, p_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare k text := split_part(p_name, '/', 1); ok boolean := false;
begin
  if is_owner() then return true; end if;
  if p_bucket = 'product-docs' then return true; end if;
  if p_bucket = 'scope-docs' then
    return k = (select code from offices where id = my_office_id());
  end if;
  if k !~ '^[0-9a-f-]{36}$' then return false; end if;
  if    p_bucket = 'po-docs'         then select true into ok from purchase_orders where id = k::uuid and office_id = my_office_id();
  elsif p_bucket = 'shipment-docs'   then select true into ok from shipments       where id = k::uuid and office_id = my_office_id();
  elsif p_bucket = 'commitment-docs' then select true into ok from commitments     where id = k::uuid and office_id = my_office_id();
  elsif p_bucket = 'approval-docs'   then select true into ok from approvals       where id = k::uuid and office_id = my_office_id();
  end if;
  return coalesce(ok, false);
end $$;
revoke execute on function public.doc_in_my_office(text, text) from public, anon;
grant execute on function public.doc_in_my_office(text, text) to authenticated;

do $$
declare r record;
begin
  for r in select * from (values
      ('po-docs', 'po_docs'), ('shipment-docs', 'shipment_docs'), ('commitment-docs', 'commitment_docs'),
      ('approval-docs', 'approval_docs'), ('scope-docs', 'scope_docs')
    ) as v(bucket, pre)
  loop
    execute format('drop policy if exists %I on storage.objects', r.pre || '_read');
    execute format('drop policy if exists %I on storage.objects', r.pre || '_write');
    execute format('drop policy if exists %I on storage.objects', r.pre || '_update');
    execute format('drop policy if exists %I on storage.objects', r.pre || '_delete');
    execute format($p$create policy %I on storage.objects for select to authenticated
      using (bucket_id = %L and public.doc_in_my_office(bucket_id, name))$p$, r.pre || '_read', r.bucket);
    execute format($p$create policy %I on storage.objects for insert to authenticated
      with check (bucket_id = %L and public.doc_in_my_office(bucket_id, name))$p$, r.pre || '_write', r.bucket);
    execute format($p$create policy %I on storage.objects for update to authenticated
      using (bucket_id = %L and public.doc_in_my_office(bucket_id, name))
      with check (bucket_id = %L and public.doc_in_my_office(bucket_id, name))$p$, r.pre || '_update', r.bucket, r.bucket);
    execute format($p$create policy %I on storage.objects for delete to authenticated
      using (bucket_id = %L and public.doc_in_my_office(bucket_id, name))$p$, r.pre || '_delete', r.bucket);
  end loop;
end $$;

insert into public.applied_migrations (name) values ('0068_each_office_sees_its_own') on conflict do nothing;
