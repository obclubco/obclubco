-- Example content for OB Club Networking. Run AFTER migrations/0004_networking.sql.
-- Replace the emails with real ones first: put your own email on the first row so you're an admin.

-- 1. The guest list (is_admin = true: sees every event and guest, and manages guest lists).
insert into public.guests (email, full_name, role, company, city, bio, interests, looking_for, can_help_with, is_admin) values
  ('admin@example.com', 'OBC Team', 'Hosts', 'OB Club', null,
   'We run the OB Club events. Say hi at the next one.', '{}', null, null, true),
  ('ava@example.com', 'Ava Jansen', 'Founder & CEO', 'Northwind Studio', 'Amsterdam',
   'Brand studio for restaurants and hotels. Ten years in hospitality before that.',
   '{Branding,Hospitality,Design}', 'Hotel groups planning a new concept', 'Naming, brand strategy, launch plans', false),
  ('liam@example.com', 'Liam Brooks', 'Partner', 'Harbour Ventures', 'London',
   'Early-stage investor in B2B software. Former founder (exit in 2021).',
   '{Venture capital,SaaS,Fundraising}', 'Founders raising a first round', 'Pitch decks, investor intros', false),
  ('sofia@example.com', 'Sofia Marin', 'Head of Growth', 'Loop Health', 'Barcelona',
   'Scaled two consumer apps past a million users.', '{Growth,Marketing,Health}', 'A technical co-founder for a side project',
   'Paid acquisition, retention', false),
  ('noah@example.com', 'Noah Weber', 'Managing Director', 'Weber Real Estate', 'Berlin',
   'Third-generation family business in commercial real estate.', '{Real estate,Family business}',
   'Operators looking for office space', 'Commercial leases, property investment', false)
on conflict (email) do nothing;

-- 2. Events, and 3. who was at each one.
with dinner as (
  insert into public.events (title, description, starts_at, ends_at, location)
  values ('Founders Dinner', 'An evening for founders and investors: one long table, no pitches.',
          '2026-05-14 19:00+02', '2026-05-14 23:00+02', 'Private dining room, city centre')
  returning id
), mixer as (
  insert into public.events (title, description, starts_at, ends_at, location)
  values ('Summer Rooftop Mixer', 'Drinks and short intros on the roof. Bring a friend who builds things.',
          '2026-07-09 18:00+02', '2026-07-09 22:00+02', 'Rooftop terrace')
  returning id
), deal_night as (
  insert into public.events (title, description, starts_at, ends_at, location)
  values ('Autumn Deal-Flow Night', 'Five founders, five minutes each, then open networking.',
          '2026-10-22 19:00+02', '2026-10-22 22:30+02', 'The Loft')
  returning id
)
insert into public.event_guests (event_id, guest_id)
select d.id, g.id from dinner d join public.guests g
  on g.email in ('admin@example.com', 'ava@example.com', 'liam@example.com', 'noah@example.com')
union all
select m.id, g.id from mixer m join public.guests g
  on g.email in ('admin@example.com', 'ava@example.com', 'sofia@example.com')
union all
select n.id, g.id from deal_night n join public.guests g
  on g.email in ('admin@example.com', 'liam@example.com', 'sofia@example.com', 'noah@example.com')
on conflict do nothing;
