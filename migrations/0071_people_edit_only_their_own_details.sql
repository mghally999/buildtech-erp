-- 0071: a person who is not an owner can change their own name, language and password,
-- and nothing else about anybody (Charles's decision on SECURITY-AUDIT 7.8, taken
-- 11 September 2026). The role was already guarded; the office and the email were not,
-- and with 0068 the office decides what a person can see.

create or replace function public.guard_profile_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_owner() then
    if new.role      is distinct from old.role      then raise exception 'Only an owner can change what access somebody has.'; end if;
    if new.office_id is distinct from old.office_id then raise exception 'Only an owner can move somebody to another office.'; end if;
    if new.email     is distinct from old.email     then raise exception 'Email is changed by an owner.'; end if;
  end if;
  return new;
end $$;

-- the trigger that calls it already exists (profiles_role_is_the_owners); this only
-- replaces the body it runs

insert into public.applied_migrations (name) values ('0071_people_edit_only_their_own_details') on conflict do nothing;
