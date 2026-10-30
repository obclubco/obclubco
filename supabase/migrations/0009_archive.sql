-- OB Club Networking: Archives. Leads you don't accept and profiles you remove are archived, not deleted.
-- Run in Supabase (SQL Editor → paste → Run), after 0004–0008. Running it again is safe.
--
-- On the Admin page:
--   · Leads: Archive (where Delete used to be) moves a lead you won't accept to Archives. Its details and call
--     notes are kept, and its Telegram message is marked "Archived".
--   · Guests: Archive hides a profile from every guest list and stops that person's login. Their profile, events
--     and login are kept, so Restore brings everything back. Accepting a new application from them does too.
--   · Archives (at the bottom): Restore, or Delete for good, the only place anything is deleted from the site.
-- Some functions from 0004, 0006 and 0007 are repeated here as those files have them now, with archives in mind.

-- ─────────────────────────────────────────────────────────────
-- 1. Profiles
-- ─────────────────────────────────────────────────────────────
alter table public.guests add column if not exists archived_at timestamptz;

-- From 0004_networking.sql: archived people can't log in and are left out of every list.
-- The signed-in person's guest id (null if their email isn't on the guest list, or they're archived).
create or replace function public.my_guest_id()
returns uuid language sql stable security definer
set search_path = ''
as $$
  select g.id from public.guests g
  where g.email = lower(coalesce(auth.jwt() ->> 'email', '')) and g.archived_at is null
$$;

create or replace function public.is_networking_admin()
returns boolean language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.guests g
    where g.email = lower(coalesce(auth.jwt() ->> 'email', '')) and g.is_admin and g.archived_at is null
  )
$$;

-- Events the signed-in guest is on the list for, newest first, with their guest counts.
-- Admins get every event; `attending` says whether they're on its list themselves.
-- Like the guest list, the count stays private (null) until the event is over, except for admins.
create or replace function public.get_my_events()
returns table (
  id              uuid,
  title           text,
  description     text,
  starts_at       timestamptz,
  ends_at         timestamptz,
  location        text,
  cover_image_url text,
  is_published    boolean,
  attending       boolean,
  guest_count     int
)
language sql stable security definer
set search_path = ''
as $$
  with me as (select public.my_guest_id() as id, public.is_networking_admin() as admin)
  select e.id, e.title, e.description, e.starts_at, e.ends_at, e.location, e.cover_image_url, e.is_published,
         exists (select 1 from public.event_guests x where x.event_id = e.id and x.guest_id = me.id),
         case when me.admin or coalesce(e.ends_at, e.starts_at + interval '5 hours') <= now() then
           (select count(*)::int
              from public.event_guests x join public.guests g on g.id = x.guest_id
             where x.event_id = e.id and g.archived_at is null and (g.is_visible or g.id = me.id or me.admin))
         end
  from public.events e
  cross join me
  where me.id is not null
    and (me.admin or (e.is_published and exists (
      select 1 from public.event_guests x where x.event_id = e.id and x.guest_id = me.id
    )))
  order by e.starts_at desc
$$;

-- The other guests of those events: their public profile plus the events shared with the
-- signed-in guest (newest first). Email and phone are only included when that guest chose to
-- share them, and guests who hid their profile are left out. Who's on an event's list stays
-- private until the event is over (or 5 hours after it starts, without an end time).
-- Admins see everyone, in full. Archived guests are left out for everyone.
create or replace function public.get_network()
returns table (
  id            uuid,
  full_name     text,
  role          text,
  company       text,
  city          text,
  photo_url     text,
  bio           text,
  interests     text[],
  looking_for   text,
  can_help_with text,
  linkedin      text,
  instagram     text,
  website       text,
  email         text,
  phone         text,
  is_visible    boolean,
  event_ids     uuid[]
)
language sql stable security definer
set search_path = ''
as $$
  with me as (select public.my_guest_id() as id, public.is_networking_admin() as admin),
  my_events as (
    select e.id, e.starts_at
    from public.events e
    cross join me
    where me.admin or (e.is_published
      and coalesce(e.ends_at, e.starts_at + interval '5 hours') <= now()
      and exists (select 1 from public.event_guests x where x.event_id = e.id and x.guest_id = me.id))
  )
  select g.id, g.full_name, g.role, g.company, g.city, g.photo_url, g.bio, g.interests,
         g.looking_for, g.can_help_with, g.linkedin, g.instagram, g.website,
         case when g.share_contact or me.admin then g.email end,
         case when g.share_contact or me.admin then g.phone end,
         g.is_visible,
         array_agg(eg.event_id order by m.starts_at desc)
  from public.event_guests eg
  join my_events m on m.id = eg.event_id
  join public.guests g on g.id = eg.guest_id
  cross join me
  where me.id is not null and g.id <> me.id and g.archived_at is null and (g.is_visible or me.admin)
  group by g.id, me.admin
  order by g.full_name
$$;

-- Admins: every guest (not archived) with their number of events and whether they have a login yet.
create or replace function public.admin_guest_overview()
returns table (
  id              uuid,
  email           text,
  full_name       text,
  role            text,
  company         text,
  is_admin        boolean,
  is_visible      boolean,
  created_at      timestamptz,
  events          int,
  last_event_at   timestamptz,
  has_login       boolean,
  last_sign_in_at timestamptz
)
language plpgsql stable security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  if not public.is_networking_admin() then raise exception 'NOT_AUTHORIZED'; end if;
  return query
    select g.id, g.email, g.full_name, g.role, g.company, g.is_admin, g.is_visible, g.created_at,
           (select count(*)::int from public.event_guests x where x.guest_id = g.id),
           (select max(e.starts_at)
              from public.event_guests x join public.events e on e.id = x.event_id
             where x.guest_id = g.id and e.starts_at <= now()),
           u.id is not null,
           u.last_sign_in_at
    from public.guests g
    left join auth.users u on lower(u.email) = g.email
    where g.archived_at is null
    order by g.full_name;
end;
$$;

-- Admins: put people on an event's guest list by email. Someone who isn't on the guest list yet is
-- added to it when a name is given. Archived people are left out (restore them first).
-- p_guests: [{"email": "…", "full_name": "…", "company": "…"}, …]
-- Returns {"added": n, "created": n, "missing": [emails that need a name], "archived": [archived emails]}.
create or replace function public.add_event_guests(p_event_id uuid, p_guests jsonb)
returns jsonb language plpgsql security definer
set search_path = ''
as $$
declare
  v_item     jsonb;
  v_email    text;
  v_name     text;
  v_guest    uuid;
  v_gone     boolean;
  v_added    int := 0;
  v_created  int := 0;
  v_missing  text[] := '{}';
  v_archived text[] := '{}';
begin
  if not public.is_networking_admin() then raise exception 'NOT_AUTHORIZED'; end if;
  if not exists (select 1 from public.events e where e.id = p_event_id) then raise exception 'EVENT_NOT_FOUND'; end if;
  if jsonb_typeof(p_guests) is distinct from 'array' then raise exception 'INVALID_GUESTS'; end if;

  for v_item in select value from jsonb_array_elements(p_guests) loop
    v_email := lower(trim(v_item ->> 'email'));
    v_name  := nullif(trim(v_item ->> 'full_name'), '');
    continue when v_email is null or v_email !~ '^[^@\s]+@[^@\s]+$';

    select g.id, g.archived_at is not null into v_guest, v_gone from public.guests g where g.email = v_email;
    if v_gone then
      v_archived := array_append(v_archived, v_email);
      continue;
    end if;
    if v_guest is null then
      if v_name is null then
        v_missing := array_append(v_missing, v_email);
        continue;
      end if;
      insert into public.guests (email, full_name, company)
      values (v_email, left(v_name, 120), left(nullif(trim(v_item ->> 'company'), ''), 120))
      returning id into v_guest;
      v_created := v_created + 1;
    end if;

    insert into public.event_guests (event_id, guest_id) values (p_event_id, v_guest)
    on conflict do nothing;
    if found then v_added := v_added + 1; end if;
  end loop;

  return jsonb_build_object('added', v_added, 'created', v_created, 'missing', to_jsonb(v_missing),
                            'archived', to_jsonb(v_archived));
end;
$$;

-- Admins: archive a profile. They disappear from every guest list and can't log in; everything is kept.
create or replace function public.archive_guest(p_id uuid)
returns void language plpgsql security definer
set search_path = ''
as $$
begin
  if not public.is_networking_admin() then raise exception 'NOT_AUTHORIZED'; end if;
  if p_id = public.my_guest_id() then raise exception 'CANNOT_ARCHIVE_YOURSELF'; end if;
  update public.guests g set archived_at = now() where g.id = p_id and g.archived_at is null;
  if not found and not exists (select 1 from public.guests g where g.id = p_id) then
    raise exception 'GUEST_NOT_FOUND';
  end if;
end;
$$;

-- Admins: bring an archived profile back, as it was (events, login and all).
create or replace function public.restore_guest(p_id uuid)
returns void language plpgsql security definer
set search_path = ''
as $$
begin
  if not public.is_networking_admin() then raise exception 'NOT_AUTHORIZED'; end if;
  update public.guests g set archived_at = null where g.id = p_id and g.archived_at is not null;
  if not found and not exists (select 1 from public.guests g where g.id = p_id) then
    raise exception 'GUEST_NOT_FOUND';
  end if;
end;
$$;

-- Admins: delete an archived profile for good, with its place on guest lists and its login.
create or replace function public.delete_archived_guest(p_id uuid)
returns void language plpgsql security definer
set search_path = ''
as $$
begin
  if not public.is_networking_admin() then raise exception 'NOT_AUTHORIZED'; end if;
  delete from public.guests g where g.id = p_id and g.archived_at is not null;
  if not found then raise exception 'NOT_ARCHIVED'; end if;  -- only archived profiles can be deleted
end;
$$;

-- Admins: the archived profiles, most recently archived first.
create or replace function public.admin_archived_guests()
returns table (
  id          uuid,
  email       text,
  full_name   text,
  role        text,
  company     text,
  events      int,
  archived_at timestamptz
)
language plpgsql stable security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  if not public.is_networking_admin() then raise exception 'NOT_AUTHORIZED'; end if;
  return query
    select g.id, g.email, g.full_name, g.role, g.company,
           (select count(*)::int from public.event_guests x where x.guest_id = g.id),
           g.archived_at
    from public.guests g
    where g.archived_at is not null
    order by g.archived_at desc;
end;
$$;

-- ─────────────────────────────────────────────────────────────
-- 2. Leads (applications)
-- ─────────────────────────────────────────────────────────────
alter table public.applications add column if not exists archived_at timestamptz;
alter table public.applications drop constraint if exists applications_status_check;
alter table public.applications add constraint applications_status_check
  check (status in ('new', 'accepted', 'archived'));

-- Admins delete only archived applications (Delete for good, in Archives).
drop policy if exists "admins delete applications" on public.applications;
drop policy if exists "admins delete archived applications" on public.applications;
create policy "admins delete archived applications" on public.applications
  for delete to authenticated
  using ((select public.is_networking_admin()) and status = 'archived');

-- From 0006_applications.sql: an archived application can't be accepted (restore it first), and accepting
-- someone whose profile was archived brings the profile back.
-- Puts the person on the guest list (unless they're on it already) with what they told us, and on the event's
-- guest list. Links from older applications become their LinkedIn, Instagram and website. Someone whose profile
-- was archived is brought back. Returns their guest id. They still need a login: Table Editor → guests → set_password.
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
    update public.guests g set archived_at = null where g.id = v_guest and g.archived_at is not null;
  end if;
  if a.event_id is not null then
    insert into public.event_guests (event_id, guest_id) values (a.event_id, v_guest) on conflict do nothing;
  end if;

  update public.applications x set status = 'accepted', reviewed_at = now(), guest_id = v_guest where x.id = p_id;
  return v_guest;
end;
$$;

-- Admins: move a lead that's still waiting to Archives (its call notes stay with it).
create or replace function public.archive_application(p_id uuid)
returns void language plpgsql security definer
set search_path = ''
as $$
begin
  if not public.is_networking_admin() then raise exception 'NOT_AUTHORIZED'; end if;
  update public.applications a set status = 'archived', archived_at = now() where a.id = p_id and a.status = 'new';
  if not found then
    if exists (select 1 from public.applications a where a.id = p_id and a.status = 'accepted') then
      raise exception 'ALREADY_ACCEPTED';
    elsif not exists (select 1 from public.applications a where a.id = p_id) then
      raise exception 'APPLICATION_NOT_FOUND';
    end if;
  end if;
end;
$$;

-- Admins: put an archived lead back with the others, waiting.
create or replace function public.restore_application(p_id uuid)
returns void language plpgsql security definer
set search_path = ''
as $$
begin
  if not public.is_networking_admin() then raise exception 'NOT_AUTHORIZED'; end if;
  update public.applications a set status = 'new', archived_at = null where a.id = p_id and a.status = 'archived';
  if not found and not exists (select 1 from public.applications a where a.id = p_id) then
    raise exception 'APPLICATION_NOT_FOUND';
  end if;
end;
$$;

-- ─────────────────────────────────────────────────────────────
-- 3. Telegram (0007_telegram.sql): an archived lead's message says "Archived"
-- ─────────────────────────────────────────────────────────────
-- p_status: 'new', 'accepted', 'archived' or 'removed' (deleted for good, or replaced by a newer application).
create or replace function public.telegram_application_text(a public.applications, p_status text)
returns text language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_event  text;
  v_site   text;
  v_digits text := regexp_replace(a.phone, '\D', '', 'g');
begin
  select public.telegram_html(e.title) || ', ' || to_char(e.starts_at at time zone 'Europe/Riga', 'Dy FMDD Mon')
  into v_event
  from public.events e where e.id = a.event_id;
  v_event := coalesce(v_event, 'any event');

  -- Removed: nothing about the person stays in the group.
  if p_status = 'removed' then
    return '🗑 Application removed · ' || v_event || E'\n'
      || 'Deleted for good on the Admin page, or replaced by a newer one. Their details have been taken out of this message.';
  end if;

  select s.site_url into v_site from public.telegram_settings s limit 1;
  return array_to_string(array[
    case p_status
      when 'accepted' then '✅ <b>Accepted</b>, on the guest list · '
      when 'archived' then '🗄 <b>Archived</b>, not accepted · '
      else '🆕 <b>New application</b> · '
    end || v_event,
    '',
    '<b>' || public.telegram_html(a.full_name) || '</b>' || coalesce(' · ' || public.telegram_html(a.role), ''),
    '💬 ' || public.telegram_html(a.note),
    '',
    '📞 ' || public.telegram_html(a.phone) || ' · prefers ' || case a.contact_via
      when 'whatsapp' then '<a href="https://wa.me/' || v_digits || '">WhatsApp</a>'
      when 'telegram' then '<a href="https://t.me/+' || v_digits || '">Telegram</a>'
      else 'a call'
    end,
    '✉️ ' || public.telegram_html(a.email),
    '🏢 ' || public.telegram_html(nullif(concat_ws(' · ', a.company, a.city), '')),
    '👋 Heard via ' || public.telegram_html(a.referred_by),
    '🔗 ' || public.telegram_html(a.links),
    '',
    '<a href="' || coalesce(v_site, 'https://networking.obclub.co') || '/manage/">Review on the Admin page</a>'
  ], E'\n');  -- lines with nothing to say (null) are left out
end;
$$;

revoke execute on function public.telegram_application_text(public.applications, text) from public, anon, authenticated;
revoke execute on function public.archive_guest(uuid)           from public, anon;
revoke execute on function public.restore_guest(uuid)           from public, anon;
revoke execute on function public.delete_archived_guest(uuid)   from public, anon;
revoke execute on function public.admin_archived_guests()       from public, anon;
revoke execute on function public.archive_application(uuid)     from public, anon;
revoke execute on function public.restore_application(uuid)     from public, anon;
grant  execute on function public.archive_guest(uuid)           to authenticated;
grant  execute on function public.restore_guest(uuid)           to authenticated;
grant  execute on function public.delete_archived_guest(uuid)   to authenticated;
grant  execute on function public.admin_archived_guests()       to authenticated;
grant  execute on function public.archive_application(uuid)     to authenticated;
grant  execute on function public.restore_application(uuid)     to authenticated;

-- ─────────────────────────────────────────────────────────────
-- 4. Check: the result should say true, then how many profiles and leads are archived.
-- ─────────────────────────────────────────────────────────────
select
  (to_regprocedure('public.archive_guest(uuid)') is not null
    and to_regprocedure('public.archive_application(uuid)') is not null
    and exists (select 1 from information_schema.columns
                where table_schema = 'public' and table_name = 'guests' and column_name = 'archived_at'))
    as "archives ready",
  (select count(*) from public.guests g where g.archived_at is not null) as "archived profiles",
  (select count(*) from public.applications a where a.status = 'archived') as "archived leads";
