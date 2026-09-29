-- OBC Partners — social posting (Admin → Social)
-- Run once in Supabase (SQL Editor → paste → Run), after 0001 and 0002.
--
-- Videos normally upload straight to Zernio. This public bucket is the fallback the Social page uses
-- when that isn't possible: admins upload the video here and Zernio fetches it from its public link.
-- Only admins can upload or delete; anyone with a file's link can view it (social platforms need that).

insert into storage.buckets (id, name, public)
values ('social-media', 'social-media', true)
on conflict (id) do nothing;

create policy "admins upload social media" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'social-media' and public.is_admin());

create policy "admins update social media" on storage.objects
  for update to authenticated
  using (bucket_id = 'social-media' and public.is_admin());

create policy "admins delete social media" on storage.objects
  for delete to authenticated
  using (bucket_id = 'social-media' and public.is_admin());
