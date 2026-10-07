-- OB Club Networking (networking.obclub.co): database schema
-- Run in Supabase (SQL Editor → paste → Run). Running it again is safe: what already exists is kept.
--
-- Works in a Supabase project of its own, or in the same project as the Partnership Program
-- (its migrations, 0001 to 0003, are on the partner branch). Nothing here clashes with the partner
-- tables, and the sign-up check in section 5 lets people on either list get an account.

-- ─────────────────────────────────────────────────────────────
-- 1. Guests: who may log in, and everyone's profile
-- ─────────────────────────────────────────────────────────────
-- One row per person. The OBC team adds the row (email + name); guests fill in the rest after
-- logging in. Deleting a row removes that person from the site and from every guest list.
create table if not exists public.guests (
  id            uuid primary key default gen_random_uuid(),
  email         text not null unique check (email = lower(trim(email)) and email like '%_@_%'),
  full_name     text not null check (char_length(full_name) between 1 and 120),
  role          text check (char_length(role) <= 120),           -- e.g. "Founder & CEO"
  company       text check (char_length(company) <= 120),
  city          text check (char_length(city) <= 80),
  photo_url     text check (char_length(photo_url) <= 1000),
  bio           text check (char_length(bio) <= 1000),
  interests     text[] not null default '{}' check (cardinality(interests) <= 12),
  looking_for   text check (char_length(looking_for) <= 500),   -- "What I'm looking for"
  can_help_with text check (char_length(can_help_with) <= 500), -- "How I can help"
  linkedin      text check (char_length(linkedin) <= 300),
  instagram     text check (char_length(instagram) <= 300),
  website       text check (char_length(website) <= 300),
  phone         text check (char_length(phone) <= 40),
  share_contact boolean not null default false, -- show email + phone to guests they've met
  is_visible    boolean not null default true,  -- false = left out of other guests' lists
  is_admin      boolean not null default false, -- OBC team: sees every event and guest, manages guest lists
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Emails are stored lowercase (so "Jane@Example.com" typed in the Table Editor still matches the login).
create or replace function public.guests_before_write()
returns trigger language plpgsql
set search_path = ''
as $$
begin
  new.email := lower(trim(new.email));
  new.full_name := trim(new.full_name);
  new.updated_at := now();
  return new;
end;
$$;

create or replace trigger guests_before_write
  before insert or update on public.guests
  for each row execute function public.guests_before_write();

-- The signed-in person's guest id (null if their email isn't on the guest list).
create or replace function public.my_guest_id()
returns uuid language sql stable security definer
set search_path = ''
as $$
  select g.id from public.guests g where g.email = lower(coalesce(auth.jwt() ->> 'email', ''))
$$;

create or replace function public.is_networking_admin()
returns boolean language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.guests g
    where g.email = lower(coalesce(auth.jwt() ->> 'email', '')) and g.is_admin
  )
$$;

-- ─────────────────────────────────────────────────────────────
-- 2. Events and who was there
-- ─────────────────────────────────────────────────────────────
create table if not exists public.events (
  id              uuid primary key default gen_random_uuid(),
  title           text not null,
  description     text,
  starts_at       timestamptz not null,
  ends_at         timestamptz,
  location        text,                            -- e.g. "The Loft, Keizersgracht 12"
  cover_image_url text,
  is_published    boolean not null default true,   -- false = only admins see it (for preparing)
  created_at      timestamptz not null default now(),
  check (ends_at is null or ends_at >= starts_at)
);
create index if not exists events_starts_at_idx on public.events (starts_at desc);

-- The guest list of each event: a row = this guest was at (or is coming to) this event.
create table if not exists public.event_guests (
  event_id uuid not null references public.events (id) on delete cascade,
  guest_id uuid not null references public.guests (id) on delete cascade,
  added_at timestamptz not null default now(),
  primary key (event_id, guest_id)
);
create index if not exists event_guests_guest_idx on public.event_guests (guest_id);

-- ─────────────────────────────────────────────────────────────
-- 3. Security rules
-- ─────────────────────────────────────────────────────────────
alter table public.guests       enable row level security;
alter table public.events       enable row level security;
alter table public.event_guests enable row level security;

-- Guests read and edit only their own row. Other guests' profiles are served by get_network()
-- below, which leaves out the private fields.
drop policy if exists "guests read own row" on public.guests;
create policy "guests read own row" on public.guests
  for select to authenticated
  using (id = (select public.my_guest_id()) or (select public.is_networking_admin()));

drop policy if exists "guests edit own row" on public.guests;
create policy "guests edit own row" on public.guests
  for update to authenticated
  using (id = (select public.my_guest_id()))
  with check (id = (select public.my_guest_id()));

drop policy if exists "guests read their events" on public.events;
create policy "guests read their events" on public.events
  for select to authenticated
  using (
    (select public.is_networking_admin())
    or (is_published and exists (
      select 1 from public.event_guests eg
      where eg.event_id = events.id and eg.guest_id = (select public.my_guest_id())
    ))
  );

drop policy if exists "guests read own visits" on public.event_guests;
create policy "guests read own visits" on public.event_guests
  for select to authenticated
  using (guest_id = (select public.my_guest_id()) or (select public.is_networking_admin()));

drop policy if exists "admins remove guests from events" on public.event_guests;
create policy "admins remove guests from events" on public.event_guests
  for delete to authenticated
  using ((select public.is_networking_admin()));

-- Read-only from the API, except profile fields (never the email or admin flag) and admins
-- taking someone off a guest list. Adding to guest lists goes through add_event_guests().
revoke all on public.guests, public.events, public.event_guests from anon, authenticated;
grant select on public.guests, public.events, public.event_guests to authenticated;
grant update (full_name, role, company, city, photo_url, bio, interests, looking_for, can_help_with,
              linkedin, instagram, website, phone, share_contact, is_visible)
  on public.guests to authenticated;
grant delete on public.event_guests to authenticated;

-- ─────────────────────────────────────────────────────────────
-- 4. What the site reads
-- ─────────────────────────────────────────────────────────────

-- Events the signed-in guest is on the list for, newest first, with their guest counts.
-- Admins get every event; `attending` says whether they're on its list themselves.
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
         (select count(*)::int
            from public.event_guests x join public.guests g on g.id = x.guest_id
           where x.event_id = e.id and (g.is_visible or g.id = me.id or me.admin))
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
-- Admins see everyone, in full.
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
  where me.id is not null and g.id <> me.id and (g.is_visible or me.admin)
  group by g.id, me.admin
  order by g.full_name
$$;

-- Admins: every guest with their number of events and whether they have a login yet.
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
    order by g.full_name;
end;
$$;

-- Admins: put people on an event's guest list by email. Someone who isn't on the guest list yet is
-- added to it when a name is given. p_guests: [{"email": "…", "full_name": "…", "company": "…"}, …]
-- Returns {"added": n, "created": n, "missing": [emails that need a name]}.
create or replace function public.add_event_guests(p_event_id uuid, p_guests jsonb)
returns jsonb language plpgsql security definer
set search_path = ''
as $$
declare
  v_item    jsonb;
  v_email   text;
  v_name    text;
  v_guest   uuid;
  v_added   int := 0;
  v_created int := 0;
  v_missing text[] := '{}';
begin
  if not public.is_networking_admin() then raise exception 'NOT_AUTHORIZED'; end if;
  if not exists (select 1 from public.events e where e.id = p_event_id) then raise exception 'EVENT_NOT_FOUND'; end if;
  if jsonb_typeof(p_guests) is distinct from 'array' then raise exception 'INVALID_GUESTS'; end if;

  for v_item in select value from jsonb_array_elements(p_guests) loop
    v_email := lower(trim(v_item ->> 'email'));
    v_name  := nullif(trim(v_item ->> 'full_name'), '');
    continue when v_email is null or v_email !~ '^[^@\s]+@[^@\s]+$';

    select g.id into v_guest from public.guests g where g.email = v_email;
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

  return jsonb_build_object('added', v_added, 'created', v_created, 'missing', to_jsonb(v_missing));
end;
$$;

revoke execute on function public.my_guest_id()                from public, anon;
revoke execute on function public.is_networking_admin()        from public, anon;
revoke execute on function public.get_my_events()              from public, anon;
revoke execute on function public.get_network()                from public, anon;
revoke execute on function public.admin_guest_overview()       from public, anon;
revoke execute on function public.add_event_guests(uuid, jsonb) from public, anon;
grant  execute on function public.my_guest_id()                to authenticated;
grant  execute on function public.is_networking_admin()        to authenticated;
grant  execute on function public.get_my_events()              to authenticated;
grant  execute on function public.get_network()                to authenticated;
grant  execute on function public.admin_guest_overview()       to authenticated;
grant  execute on function public.add_event_guests(uuid, jsonb) to authenticated;

-- ─────────────────────────────────────────────────────────────
-- 5. Only people on a list can get an account
-- ─────────────────────────────────────────────────────────────
-- Accounts are created by the OBC team (Authentication → Users → Add user). This refuses any email
-- that isn't on the guest list. It replaces the Partnership Program's check of the same name, so
-- in a shared project emails on its allowed_emails list keep working too.
create or replace function public.enforce_allowlist()
returns trigger language plpgsql security definer
set search_path = ''
as $$
declare
  v_email   text := lower(new.email);
  v_allowed boolean;
begin
  select exists (select 1 from public.guests g where g.email = v_email) into v_allowed;
  if not v_allowed and to_regclass('public.allowed_emails') is not null then
    execute 'select exists (select 1 from public.allowed_emails a where a.email = $1)'
      into v_allowed using v_email;
  end if;
  if not v_allowed then
    raise exception 'EMAIL_NOT_AUTHORIZED';
  end if;
  return new;
end;
$$;

-- Shared project: the partner migration already created this trigger (it now runs the check above).
do $$
begin
  if not exists (
    select 1 from pg_trigger
    where tgname = 'enforce_allowlist_before_signup' and tgrelid = 'auth.users'::regclass
  ) then
    create trigger enforce_allowlist_before_signup
      before insert on auth.users
      for each row execute function public.enforce_allowlist();
  end if;
end;
$$;

-- ─────────────────────────────────────────────────────────────
-- 6. Profile photos
-- ─────────────────────────────────────────────────────────────
-- Guests upload their own photo from the Profile page. Photos are public links (like any profile
-- picture); each guest can only add or remove files in their own folder.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('guest-photos', 'guest-photos', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

drop policy if exists "guests read own photos" on storage.objects;
create policy "guests read own photos" on storage.objects
  for select to authenticated
  using (bucket_id = 'guest-photos' and (storage.foldername(name))[1] = (select public.my_guest_id())::text);

drop policy if exists "guests upload own photos" on storage.objects;
create policy "guests upload own photos" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'guest-photos' and (storage.foldername(name))[1] = (select public.my_guest_id())::text);

drop policy if exists "guests delete own photos" on storage.objects;
create policy "guests delete own photos" on storage.objects
  for delete to authenticated
  using (bucket_id = 'guest-photos' and (storage.foldername(name))[1] = (select public.my_guest_id())::text);
