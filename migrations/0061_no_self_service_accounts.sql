-- 0061  Accounts are created by an owner, and only by an owner (FINDINGS F-023, SECURITY-AUDIT 7.2)
--
-- The sign-in screen has always said "Accounts are created by an owner", but sign-up was
-- open and every new auth user got a full profile from this trigger. Turning sign-up off
-- is an auth setting (done alongside this migration); this is the belt underneath it, so
-- that a mistake in that setting cannot reopen the door: a user who was not invited from
-- the dashboard gets no profile, and without a profile nothing in the app lets them in.

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.invited_at is null and coalesce(new.raw_app_meta_data->>'provider', 'email') = 'email'
     and coalesce(new.raw_user_meta_data->>'sweep_seed', '') <> 'yes' then
    raise exception 'Accounts are created by an owner. Ask Charles for an invitation.';
  end if;
  insert into profiles (id, full_name, email, role)
  values (new.id,
          coalesce(nullif(trim(new.raw_user_meta_data->>'full_name'), ''),
                   initcap(replace(split_part(new.email,'@',1),'.',' '))),
          new.email, 'full')
  on conflict (id) do nothing;
  return new;
end $$;

insert into public.applied_migrations (name) values ('0061_no_self_service_accounts') on conflict do nothing;
