-- 0077: a document uploaded by anyone but an owner is kept, with its record.
--
-- The upload wrote the file into storage, then a scope_documents row with no office on it.
-- Since 0068 a row is only allowed in the uploader's own office, so for everyone who is not
-- an owner the row was refused after the file was already stored: the PDF sat in the bucket
-- with nothing pointing at it and never appeared under "Scopes we have been sent". The page
-- now puts the office on the row. This puts it on the rows written before, gives every file
-- already stored without a row the row it should have had, and makes a row written without
-- an office take the writer's own.

-- the office a document is filed under is the first part of its path: DXB/…, BRU/…
update public.scope_documents d set office_id = o.id
  from public.offices o
 where d.office_id is null and split_part(d.file_path, '/', 1) = o.code;

-- a row for every stored file that has none, named as it was uploaded
insert into public.scope_documents (office_id, file_name, file_path, mime, size_bytes, uploaded_by, created_at, note)
select o.id,
       regexp_replace(split_part(s.name, '/', 2), '^[0-9]+-', ''),
       s.name,
       s.metadata->>'mimetype',
       nullif(s.metadata->>'size', '')::bigint,
       (select p.id from public.profiles p where p.id = s.owner),
       s.created_at,
       'The file was kept when it was uploaded but its record was not; put back on 14 September 2026.'
  from storage.objects s
  left join public.offices o on o.code = split_part(s.name, '/', 1)
 where s.bucket_id = 'scope-docs'
   and not exists (select 1 from public.scope_documents d where d.file_path = s.name);

alter table public.scope_documents alter column office_id set default public.my_office_id();

insert into public.applied_migrations (name) values ('0077_uploaded_documents_are_kept') on conflict do nothing;
