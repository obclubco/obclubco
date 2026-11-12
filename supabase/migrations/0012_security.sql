-- OB Club Networking: security fixes from the review of November 2026.
-- Run in Supabase (SQL Editor → paste → Run), after the other files. Running it again is safe.
--
-- 1. Applying again no longer replaces or removes an earlier application. Anyone can type any email on the
--    application page, so a stranger could wipe out someone's waiting application, and the call notes on it, and
--    the same trick slipped past the brake on floods of applications.
-- 2. Draft events never take applications, so their details stay private even with applications switched on.
-- 3. Accepting an application from someone whose profile was archived brings them back as a guest, without admin
--    rights (anyone can apply with a former admin's email). Restore in Archives still brings back everything.
-- 4. Setting a password in the guests table also confirms the login's email, so a login someone else started for
--    that email can't keep the guest out.
-- 5. Each interest on a profile is at most 100 characters, so nobody can make everyone's pages heavy.
--
-- The same changes are in 0004, 0005, 0006 and 0009, so running any of those again keeps them.

-- ─────────────────────────────────────────────────────────────
-- 1–3. Applications
-- ─────────────────────────────────────────────────────────────
-- Published events taking applications that haven't finished yet, soonest first. (Drafts stay private, even with
-- applications switched on.)
create or replace function public.get_open_events()
returns table (
  id              uuid,
  title           text,
  description     text,
  starts_at       timestamptz,
  ends_at         timestamptz,
  cover_image_url text
)
language sql stable security definer
set search_path = ''
as $$
  select e.id, e.title, e.description, e.starts_at, e.ends_at, e.cover_image_url
  from public.events e
  where e.applications_open and e.is_published and coalesce(e.ends_at, e.starts_at + interval '5 hours') > now()
  order by e.starts_at
$$;

-- p: {"event_id", "full_name", "email", "phone", "contact_via", "role", "note", "company", "city", "referred_by",
--     "consent": true, "trap": ""}
create or replace function public.submit_application(p jsonb)
returns void language plpgsql security definer
set search_path = ''
as $$
declare
  v_event uuid;
  v_email text := lower(trim(p ->> 'email'));
begin
  -- "trap" is a field people never see on the page; bots fill it in. Let them think it worked.
  if coalesce(p ->> 'trap', '') <> '' then
    return;
  end if;
  if (p ->> 'consent') is distinct from 'true' then
    raise exception 'CONSENT_REQUIRED';
  end if;
  -- Name, email and phone are required by the table; what they do and why they'd like to come, here.
  if nullif(trim(p ->> 'role'), '') is null or nullif(trim(p ->> 'note'), '') is null then
    raise exception 'ANSWERS_REQUIRED';
  end if;
  if nullif(p ->> 'event_id', '') is not null then
    select e.id into v_event from public.events e
    where e.id::text = lower(p ->> 'event_id') and e.applications_open and e.is_published
      and coalesce(e.ends_at, e.starts_at + interval '5 hours') > now();
    if v_event is null then
      raise exception 'EVENT_CLOSED';
    end if;
  end if;
  -- A brake on floods of automated sign-ups.
  if (select count(*) from public.applications a where a.created_at > now() - interval '10 minutes') >= 60 then
    raise exception 'TRY_LATER';
  end if;

  -- Applying again never replaces or removes an earlier application: anyone can type any email here, so that would
  -- let a stranger wipe out someone's application and the call notes on it. The very same application sent twice
  -- is kept once.
  if exists (
    select 1 from public.applications a
    where a.email = v_email and a.event_id is not distinct from v_event and a.status = 'new'
      and a.full_name = trim(p ->> 'full_name') and a.phone = trim(p ->> 'phone')
      and a.note is not distinct from nullif(trim(p ->> 'note'), '')
  ) then
    return;
  end if;

  insert into public.applications
    (event_id, full_name, email, phone, contact_via, links, company, role, city, note, referred_by)
  values (
    v_event,
    trim(p ->> 'full_name'),
    v_email,
    trim(p ->> 'phone'),
    coalesce(nullif(p ->> 'contact_via', ''), 'whatsapp'),
    nullif(trim(p ->> 'links'), ''),
    nullif(trim(p ->> 'company'), ''),
    nullif(trim(p ->> 'role'), ''),
    nullif(trim(p ->> 'city'), ''),
    nullif(trim(p ->> 'note'), ''),
    nullif(trim(p ->> 'referred_by'), '')
  );
end;
$$;

create or replace function public.accept_application(p_id uuid)
returns uuid language plpgsql security definer
set search_path = ''
as $$
declare
  a           public.applications;
  v_guest     uuid;
  v_token     text;
  v_url       text;
  v_linkedin  text;
  v_instagram text;
  v_website   text;
begin
  if not public.is_networking_admin() then raise exception 'NOT_AUTHORIZED'; end if;
  select * into a from public.applications x where x.id = p_id for update;
  if not found then raise exception 'APPLICATION_NOT_FOUND'; end if;
  if a.status = 'archived' then raise exception 'APPLICATION_ARCHIVED'; end if;  -- restore it first

  for v_token in
    select regexp_replace(t, '^[(<"''\[]+|[.,;:!?)>"''\]]+$', '', 'g') from regexp_split_to_table(a.links, '\s+') t
  loop
    continue when v_token !~* '^(https?://)?([a-z0-9-]+\.)+[a-z]{2,}(/\S*)?$';
    v_url := left(case when v_token ~* '^https?://' then v_token else 'https://' || v_token end, 300);
    if v_token ~* '^(https?://)?([a-z0-9-]+\.)*linkedin\.com/' then
      v_linkedin := coalesce(v_linkedin, v_url);
    elsif v_token ~* '^(https?://)?([a-z0-9-]+\.)*instagram\.com/' then
      v_instagram := coalesce(v_instagram, v_url);
    else
      v_website := coalesce(v_website, v_url);
    end if;
  end loop;

  select g.id into v_guest from public.guests g where g.email = a.email;
  if v_guest is null then
    insert into public.guests (email, full_name, company, role, city, phone, linkedin, instagram, website)
    values (a.email, a.full_name, a.company, a.role, a.city, a.phone, v_linkedin, v_instagram, v_website)
    returning id into v_guest;
  else
    update public.guests g set archived_at = null, is_admin = false where g.id = v_guest and g.archived_at is not null;
  end if;
  if a.event_id is not null then
    insert into public.event_guests (event_id, guest_id) values (a.event_id, v_guest) on conflict do nothing;
  end if;

  update public.applications x set status = 'accepted', reviewed_at = now(), guest_id = v_guest where x.id = p_id;
  return v_guest;
end;
$$;

-- ─────────────────────────────────────────────────────────────
-- 4. Logins
-- ─────────────────────────────────────────────────────────────
-- After a guests row is saved: move the login to a changed email, then create the login or set its password.
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
      -- Also confirms the email: a login someone else started for this email (by signing up, while sign-ups were
      -- on) would otherwise stay unconfirmed and keep the guest out.
      update auth.users
      set encrypted_password = v_hash, email_confirmed_at = coalesce(email_confirmed_at, now()), updated_at = now()
      where id = v_user;
    end if;
  exception when insufficient_privilege then
    raise exception 'Supabase didn''t allow setting the password from this table. Create the login under Authentication → Users instead.';
  end;
  return null;
end;
$$;

-- ─────────────────────────────────────────────────────────────
-- 5. Profiles
-- ─────────────────────────────────────────────────────────────
create or replace function public.texts_within(p_texts text[], p_max int)
returns boolean language sql immutable
set search_path = ''
as $$ select coalesce(bool_and(char_length(t) <= p_max), true) from unnest(p_texts) t $$;
grant execute on function public.texts_within(text[], int) to authenticated;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'guests_interests_length' and conrelid = 'public.guests'::regclass) then
    alter table public.guests add constraint guests_interests_length check (public.texts_within(interests, 100)) not valid;
  end if;
end $$;

-- ─────────────────────────────────────────────────────────────
-- Check: the result should say true.
-- ─────────────────────────────────────────────────────────────
select
  (position('is_published' in pg_get_functiondef('public.get_open_events()'::regprocedure)) > 0
    and position('delete from public.applications' in pg_get_functiondef('public.submit_application(jsonb)'::regprocedure)) = 0
    and position('is_admin = false' in pg_get_functiondef('public.accept_application(uuid)'::regprocedure)) > 0
    and position('email_confirmed_at = coalesce' in pg_get_functiondef('public.guests_sync_login()'::regprocedure)) > 0
    and exists (select 1 from pg_constraint where conname = 'guests_interests_length'))
    as "security fixes in place";
