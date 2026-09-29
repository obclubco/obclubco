-- OB Club Networking: manage logins from the guests table
-- Run once in Supabase (SQL Editor → paste → Run), after 0004_networking.sql.
--
-- Table Editor → guests: type a password in `set_password` and save. That creates the guest's login
-- (or changes their password if they already have one); `password_set_at` shows when it took effect.
-- The password is stored only scrambled, inside Supabase Auth, and the cell empties itself.
-- Changing a guest's email moves their login to the new email; deleting a guest deletes their login.
-- Works with CSV import too (columns email, full_name, set_password).

alter table public.guests
  add column set_password text,
  add column password_set_at timestamptz;

comment on column public.guests.set_password is
  'Type a password to create this guest''s login or change their password. It is saved securely and this cell empties itself.';
comment on column public.guests.password_set_at is
  'When a password was last set in set_password.';

-- Before the row is saved: keep only the scrambled password, for the step below, and empty the cell.
-- (The login is created after the row is saved, because Supabase only allows logins for guests on the list.)
create or replace function public.guests_take_password()
returns trigger language plpgsql
set search_path = ''
as $$
begin
  if coalesce(new.set_password, '') <> '' then
    if char_length(new.set_password) < 8 then
      raise exception 'Passwords need at least 8 characters.';
    end if;
    perform set_config('obc.pw_' || replace(new.id::text, '-', ''),
                       extensions.crypt(new.set_password, extensions.gen_salt('bf')), true);
    new.password_set_at := now();
  end if;
  new.set_password := null;
  return new;
end;
$$;

-- Whether an email also has a Partnership Program account (only when both sites share one project).
-- Those logins are never moved or deleted from here.
create or replace function public.is_partner_email(p_email text)
returns boolean language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_found boolean := false;
begin
  if to_regclass('public.allowed_emails') is not null then
    execute 'select exists (select 1 from public.allowed_emails a where a.email = $1)' into v_found using lower(p_email);
  end if;
  return v_found;
end;
$$;

-- After the row is saved: move the login to a changed email, then create the login or set its password.
create or replace function public.guests_sync_login()
returns trigger language plpgsql security definer
set search_path = ''
as $$
declare
  v_key  text := 'obc.pw_' || replace(new.id::text, '-', '');
  v_hash text := nullif(current_setting(v_key, true), '');
  v_user uuid;
begin
  if tg_op = 'UPDATE' and new.email <> old.email and not public.is_partner_email(old.email)
     and not exists (select 1 from auth.users u where lower(u.email) = new.email) then
    begin
      update auth.users set email = new.email, updated_at = now()
      where lower(email) = old.email
      returning id into v_user;
      update auth.identities
      set identity_data = identity_data || jsonb_build_object('email', new.email), updated_at = now()
      where user_id = v_user and provider = 'email';
    exception when insufficient_privilege then
      raise notice 'Change this guest''s email under Authentication → Users too.';
    end;
  end if;

  if v_hash is null then
    return null;
  end if;
  perform set_config(v_key, '', true);

  begin
    select u.id into v_user from auth.users u where lower(u.email) = new.email;
    if v_user is null then
      v_user := gen_random_uuid();
      insert into auth.users (
        instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
        raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
        confirmation_token, recovery_token, email_change_token_new, email_change
      ) values (
        '00000000-0000-0000-0000-000000000000', v_user, 'authenticated', 'authenticated', new.email, v_hash, now(),
        '{"provider": "email", "providers": ["email"]}', jsonb_build_object('full_name', new.full_name), now(), now(),
        '', '', '', ''
      );
      insert into auth.identities (provider_id, user_id, provider, identity_data, last_sign_in_at, created_at, updated_at)
      values (
        v_user::text, v_user, 'email',
        jsonb_build_object('sub', v_user::text, 'email', new.email, 'email_verified', true, 'phone_verified', false),
        now(), now(), now()
      );
    else
      update auth.users set encrypted_password = v_hash, updated_at = now() where id = v_user;
    end if;
  exception when insufficient_privilege then
    raise exception 'Supabase didn''t allow setting the password from this table. Create the login under Authentication → Users instead.';
  end;
  return null;
end;
$$;

-- After a guest is deleted: delete their login too.
create or replace function public.guests_delete_login()
returns trigger language plpgsql security definer
set search_path = ''
as $$
begin
  if not public.is_partner_email(old.email) then
    delete from auth.users where lower(email) = old.email;
  end if;
  return null;
exception when insufficient_privilege then
  raise notice 'Delete this guest''s login under Authentication → Users too.';
  return null;
end;
$$;

create trigger guests_take_password
  before insert or update on public.guests
  for each row execute function public.guests_take_password();

create trigger guests_sync_login
  after insert or update on public.guests
  for each row execute function public.guests_sync_login();

create trigger guests_delete_login
  after delete on public.guests
  for each row execute function public.guests_delete_login();

revoke execute on function public.is_partner_email(text) from public, anon, authenticated;
