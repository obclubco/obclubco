-- OB Club Networking: admins change guests' profile photos.
-- Run in Supabase (SQL Editor → paste → Run), after 0004_networking.sql. Running it again is safe.
--
-- Guests add their own photo on the Profile page. With this, admins can also add, change or remove anyone's photo:
-- on the Admin page (tap a guest's photo in the Guests table) or on the guest's profile page. Photos stay where
-- guests' own photos go: the `guest-photos` bucket, in the guest's folder. The guest can still change it afterwards.

-- ─────────────────────────────────────────────────────────────
-- 1. The files: admins may add, see and delete photos in any guest's folder
-- ─────────────────────────────────────────────────────────────
drop policy if exists "admins read guest photos" on storage.objects;
create policy "admins read guest photos" on storage.objects
  for select to authenticated
  using (bucket_id = 'guest-photos' and (select public.is_networking_admin()));

drop policy if exists "admins upload guest photos" on storage.objects;
create policy "admins upload guest photos" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'guest-photos' and (select public.is_networking_admin()));

drop policy if exists "admins delete guest photos" on storage.objects;
create policy "admins delete guest photos" on storage.objects
  for delete to authenticated
  using (bucket_id = 'guest-photos' and (select public.is_networking_admin()));

-- ─────────────────────────────────────────────────────────────
-- 2. The profile: put a photo on a guest's profile, or none (p_photo_url null)
-- ─────────────────────────────────────────────────────────────
-- The photo has to be uploaded to that guest's folder in guest-photos first. Returns the photo it replaced, which
-- the site then deletes from Storage. Only the photo changes; the rest of the profile stays the guest's own.
create or replace function public.admin_set_guest_photo(p_guest_id uuid, p_photo_url text)
returns text language plpgsql security definer
set search_path = ''
as $$
declare
  v_path text;
  v_old  text;
begin
  if not public.is_networking_admin() then raise exception 'NOT_AUTHORIZED'; end if;
  if p_photo_url is not null then
    v_path := substring(p_photo_url from '/storage/v1/object/public/guest-photos/([^?#]+)');
    if v_path is null or split_part(v_path, '/', 1) <> p_guest_id::text
       or not exists (select 1 from storage.objects o where o.bucket_id = 'guest-photos' and o.name = v_path) then
      raise exception 'PHOTO_NOT_FOUND';  -- upload it to guest-photos, in the guest's folder, first
    end if;
  end if;
  select g.photo_url into v_old from public.guests g where g.id = p_guest_id for update;
  if not found then raise exception 'GUEST_NOT_FOUND'; end if;
  update public.guests g set photo_url = p_photo_url where g.id = p_guest_id;
  return v_old;
end;
$$;

revoke execute on function public.admin_set_guest_photo(uuid, text) from public, anon;
grant  execute on function public.admin_set_guest_photo(uuid, text) to authenticated;

-- ─────────────────────────────────────────────────────────────
-- 3. Check: the result should say true.
-- ─────────────────────────────────────────────────────────────
select
  (to_regprocedure('public.admin_set_guest_photo(uuid, text)') is not null
    and (select count(*) from pg_policies p
         where p.schemaname = 'storage' and p.tablename = 'objects'
           and p.policyname in ('admins read guest photos', 'admins upload guest photos', 'admins delete guest photos')) = 3)
    as "admins can change photos";
