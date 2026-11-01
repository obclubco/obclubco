-- OB Club Networking: photos and videos of each event.
-- Run in Supabase (SQL Editor → paste → Run), after 0004_networking.sql. Running it again is safe.
--
-- Admins add photos and videos on an event's page; everyone on that event's guest list (and admins) sees them
-- there. The files are in a private Storage bucket, `event-media`, in one folder per event: only people who can see
-- the event can open them (through links that expire), and only admins can add or delete them. Photos are resized
-- in the browser before they're uploaded; videos up to 50 MB each (the most the Supabase free plan allows).

-- ─────────────────────────────────────────────────────────────
-- 1. Where the files go: a private bucket
-- ─────────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('event-media', 'event-media', false, 52428800,
        array['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/quicktime', 'video/webm'])
on conflict (id) do nothing;

-- ─────────────────────────────────────────────────────────────
-- 2. Which files belong to which event
-- ─────────────────────────────────────────────────────────────
create table if not exists public.event_media (
  id          uuid primary key default gen_random_uuid(),
  event_id    uuid not null references public.events (id) on delete cascade,
  kind        text not null check (kind in ('photo', 'video')),
  path        text not null unique,                  -- the file in event-media: <event id>/<name>
  thumb_path  text,                                  -- a small preview image (photos, and most videos)
  width       int check (width > 0),
  height      int check (height > 0),
  bytes       bigint check (bytes >= 0),
  seconds     numeric check (seconds >= 0),          -- videos: how long
  added_by    uuid references public.guests (id) on delete set null,
  created_at  timestamptz not null default now(),
  check (path like event_id::text || '/%'),
  check (thumb_path is null or thumb_path like event_id::text || '/%')
);
create index if not exists event_media_event_idx on public.event_media (event_id, created_at);

-- Who sees an event's photos and videos: admins, and the guests on its list (once it's published).
create or replace function public.can_see_event(p_event_id uuid)
returns boolean language sql stable security definer
set search_path = ''
as $$
  select public.is_networking_admin() or exists (
    select 1 from public.events e join public.event_guests x on x.event_id = e.id
    where e.id = p_event_id and e.is_published and x.guest_id = public.my_guest_id()
  )
$$;

alter table public.event_media enable row level security;

drop policy if exists "guests see their events' media" on public.event_media;
create policy "guests see their events' media" on public.event_media
  for select to authenticated
  using (public.can_see_event(event_id));

-- Read-only from the API: admins add and remove through the functions below.
revoke all on public.event_media from anon, authenticated;
grant select on public.event_media to authenticated;

-- The files themselves: seen by the same people, added and deleted by admins.
drop policy if exists "event media: see" on storage.objects;
create policy "event media: see" on storage.objects
  for select to authenticated
  using (bucket_id = 'event-media' and exists (
    select 1 from public.events e
    where e.id::text = (storage.foldername(name))[1] and public.can_see_event(e.id)
  ));

drop policy if exists "event media: admins add" on storage.objects;
create policy "event media: admins add" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'event-media' and (select public.is_networking_admin()));

drop policy if exists "event media: admins delete" on storage.objects;
create policy "event media: admins delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'event-media' and (select public.is_networking_admin()));

-- ─────────────────────────────────────────────────────────────
-- 3. Admins: adding and removing (the site uploads the files first, then records them here)
-- ─────────────────────────────────────────────────────────────
create or replace function public.add_event_media(
  p_event_id uuid, p_kind text, p_path text, p_thumb_path text default null,
  p_width int default null, p_height int default null, p_bytes bigint default null, p_seconds numeric default null
)
returns public.event_media language plpgsql security definer
set search_path = ''
as $$
declare
  v_media public.event_media;
begin
  if not public.is_networking_admin() then raise exception 'NOT_AUTHORIZED'; end if;
  if not exists (select 1 from public.events e where e.id = p_event_id) then raise exception 'EVENT_NOT_FOUND'; end if;
  if not exists (select 1 from storage.objects o where o.bucket_id = 'event-media' and o.name = p_path) then
    raise exception 'FILE_NOT_FOUND';  -- upload it to event-media first
  end if;
  insert into public.event_media (event_id, kind, path, thumb_path, width, height, bytes, seconds, added_by)
  values (p_event_id, p_kind, p_path, p_thumb_path, p_width, p_height, p_bytes, p_seconds, public.my_guest_id())
  returning * into v_media;
  return v_media;
end;
$$;

-- Removes a photo or video and returns its files, which the site then deletes from Storage.
create or replace function public.delete_event_media(p_id uuid)
returns text[] language plpgsql security definer
set search_path = ''
as $$
declare
  v_files text[];
begin
  if not public.is_networking_admin() then raise exception 'NOT_AUTHORIZED'; end if;
  delete from public.event_media m where m.id = p_id returning array_remove(array[m.path, m.thumb_path], null) into v_files;
  if not found then raise exception 'MEDIA_NOT_FOUND'; end if;
  return v_files;
end;
$$;

revoke execute on function public.can_see_event(uuid) from public, anon;
revoke execute on function public.add_event_media(uuid, text, text, text, int, int, bigint, numeric) from public, anon;
revoke execute on function public.delete_event_media(uuid) from public, anon;
grant  execute on function public.can_see_event(uuid) to authenticated;
grant  execute on function public.add_event_media(uuid, text, text, text, int, int, bigint, numeric) to authenticated;
grant  execute on function public.delete_event_media(uuid) to authenticated;

-- ─────────────────────────────────────────────────────────────
-- 4. Check: the result should say true and how many photos and videos there are.
-- ─────────────────────────────────────────────────────────────
select
  (exists (select 1 from storage.buckets b where b.id = 'event-media' and not b.public)
    and to_regprocedure('public.add_event_media(uuid, text, text, text, int, int, bigint, numeric)') is not null)
    as "photos and videos ready",
  (select count(*) from public.event_media) as "photos and videos";
