-- 0062  Teaching the scope reader, and the role list (SECURITY-AUDIT 7.9 and 7.12)
--
-- The Remember button in the scope reader inserts into spec_equivalents, whose write policy
-- was owner-only, so everybody else was told "new row violates row-level security policy".
-- Anyone who can build a quotation can teach it a wording. Changing or deleting what has
-- been taught stays with the owners.
--
-- The role check allowed a third role, 'staff', that nothing in the app or the policies
-- gives any meaning. Two roles, as the Access list says.

drop policy if exists spec_equivalents_write on public.spec_equivalents;
create policy spec_equivalents_insert on public.spec_equivalents for insert to authenticated with check (true);
create policy spec_equivalents_update on public.spec_equivalents for update to authenticated using (is_owner()) with check (is_owner());
create policy spec_equivalents_delete on public.spec_equivalents for delete to authenticated using (is_owner());

alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check check (role in ('owner', 'full'));

insert into public.applied_migrations (name) values ('0062_equivalents_and_roles') on conflict do nothing;
