-- OB Club Networking: applications from the public page networking.obclub.co/apply/
-- Run in Supabase (SQL Editor → paste → Run), after 0004_networking.sql. Running it again is safe.
--
-- Anyone with the link can apply, without a login. Applications land in the `applications` table and admins
-- review them on the site's Admin page: Accept puts the person on the guest list (and on the event's list),
-- Delete removes the application. To take applications for an event, turn on `applications_open` on its row
-- in `events`: the page then shows its title, date and description (never its location or who's coming).

-- ─────────────────────────────────────────────────────────────
-- 1. Which events take applications
-- ─────────────────────────────────────────────────────────────
alter table public.events add column if not exists applications_open boolean not null default false;

comment on column public.events.applications_open is
  'On: people can apply for this event at networking.obclub.co/apply/ (the page shows its title, date and description).';

-- ─────────────────────────────────────────────────────────────
-- 2. Applications
-- ─────────────────────────────────────────────────────────────
create table if not exists public.applications (
  id          uuid primary key default gen_random_uuid(),
  event_id    uuid references public.events (id) on delete set null,  -- empty: OB Club events in general
  full_name   text not null check (char_length(full_name) between 1 and 120),
  email       text not null check (email = lower(email) and char_length(email) <= 254 and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  phone       text not null check (char_length(phone) between 6 and 40),
  contact_via text not null default 'whatsapp' check (contact_via in ('whatsapp', 'call', 'telegram')),
  links       text not null check (char_length(links) between 1 and 1000),  -- LinkedIn, Instagram, website…
  company     text check (char_length(company) <= 120),
  role        text check (char_length(role) <= 120),
  city        text check (char_length(city) <= 80),
  note        text check (char_length(note) <= 1000),                      -- why they'd like to come
  referred_by text check (char_length(referred_by) <= 120),                 -- who told them about OB Club
  status      text not null default 'new' check (status in ('new', 'accepted')),
  guest_id    uuid references public.guests (id) on delete set null,       -- their guest row, once accepted
  created_at  timestamptz not null default now(),
  reviewed_at timestamptz
);
create index if not exists applications_created_at_idx on public.applications (created_at desc);

-- Only admins read and delete applications. New ones come in through submit_application() below.
alter table public.applications enable row level security;

drop policy if exists "admins read applications" on public.applications;
create policy "admins read applications" on public.applications
  for select to authenticated
  using ((select public.is_networking_admin()));

drop policy if exists "admins delete applications" on public.applications;
create policy "admins delete applications" on public.applications
  for delete to authenticated
  using ((select public.is_networking_admin()));

revoke all on public.applications from anon, authenticated;
grant select, delete on public.applications to authenticated;

-- ─────────────────────────────────────────────────────────────
-- 3. What the application page reads and sends (no login needed)
-- ─────────────────────────────────────────────────────────────

-- Events taking applications that haven't finished yet, soonest first.
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
  where e.applications_open and coalesce(e.ends_at, e.starts_at + interval '5 hours') > now()
  order by e.starts_at
$$;

-- p: {"event_id", "full_name", "email", "phone", "contact_via", "links", "company", "role", "city", "note",
--     "referred_by", "consent": true, "trap": ""}
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
  if nullif(p ->> 'event_id', '') is not null then
    select e.id into v_event from public.events e
    where e.id::text = lower(p ->> 'event_id') and e.applications_open
      and coalesce(e.ends_at, e.starts_at + interval '5 hours') > now();
    if v_event is null then
      raise exception 'EVENT_CLOSED';
    end if;
  end if;
  -- A brake on floods of automated sign-ups.
  if (select count(*) from public.applications a where a.created_at > now() - interval '10 minutes') >= 60 then
    raise exception 'TRY_LATER';
  end if;

  -- Applying again for the same event replaces the earlier application while it's still waiting.
  delete from public.applications a
  where a.email = v_email and a.event_id is not distinct from v_event and a.status = 'new';

  insert into public.applications
    (event_id, full_name, email, phone, contact_via, links, company, role, city, note, referred_by)
  values (
    v_event,
    trim(p ->> 'full_name'),
    v_email,
    trim(p ->> 'phone'),
    coalesce(nullif(p ->> 'contact_via', ''), 'whatsapp'),
    trim(p ->> 'links'),
    nullif(trim(p ->> 'company'), ''),
    nullif(trim(p ->> 'role'), ''),
    nullif(trim(p ->> 'city'), ''),
    nullif(trim(p ->> 'note'), ''),
    nullif(trim(p ->> 'referred_by'), '')
  );
end;
$$;

-- ─────────────────────────────────────────────────────────────
-- 4. Admins: accept an application
-- ─────────────────────────────────────────────────────────────
-- Puts the person on the guest list (unless they're on it already) with what they told us, including their
-- LinkedIn, Instagram and website links, and on the event's guest list. Returns their guest id.
-- They still need a login: Table Editor → guests → set_password.
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
  end if;
  if a.event_id is not null then
    insert into public.event_guests (event_id, guest_id) values (a.event_id, v_guest) on conflict do nothing;
  end if;

  update public.applications x set status = 'accepted', reviewed_at = now(), guest_id = v_guest where x.id = p_id;
  return v_guest;
end;
$$;

-- Admins: open or close applications for an event (the switch on the Admin page).
create or replace function public.set_applications_open(p_event_id uuid, p_open boolean)
returns void language plpgsql security definer
set search_path = ''
as $$
begin
  if not public.is_networking_admin() then raise exception 'NOT_AUTHORIZED'; end if;
  update public.events e set applications_open = p_open where e.id = p_event_id;
  if not found then raise exception 'EVENT_NOT_FOUND'; end if;
end;
$$;

revoke execute on function public.get_open_events()                       from public;
revoke execute on function public.submit_application(jsonb)               from public;
revoke execute on function public.accept_application(uuid)                from public, anon;
revoke execute on function public.set_applications_open(uuid, boolean)    from public, anon;
grant  execute on function public.get_open_events()                       to anon, authenticated;
grant  execute on function public.submit_application(jsonb)               to anon, authenticated;
grant  execute on function public.accept_application(uuid)                to authenticated;
grant  execute on function public.set_applications_open(uuid, boolean)    to authenticated;
