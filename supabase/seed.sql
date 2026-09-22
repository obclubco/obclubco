-- Example content for the OBC Partnership Program.
-- Run AFTER migrations/0001_init.sql. Replace the emails, videos and questions with your own.

-- 1. Authorise people (lowercase emails). is_admin = true unlocks the /admin page and draft previews.
insert into public.allowed_emails (email, full_name, is_admin) values
  ('admin@example.com',   'OBC Admin',       true),
  ('partner@example.com', 'Example Partner', false)
on conflict (email) do nothing;

-- 2. A course with two lessons and a quiz after each.
with course as (
  insert into public.courses (slug, title, subtitle, description, category, sort_order, pass_percentage, is_published)
  values (
    'sales-foundations',
    'Sales Foundations',
    'From first conversation to signed deal.',
    'The core sales playbook used across the OB Club network: how to open, qualify, handle objections and close.',
    'sales', 1, 70, true
  )
  returning id
),
l1 as (
  insert into public.lessons (course_id, title, description, video_url, duration_minutes, sort_order)
  select id, 'The discovery call', 'How to run a discovery call that uncovers real pain and budget.',
         'https://www.youtube.com/watch?v=dQw4w9WgXcQ', 12, 1
  from course returning id
),
l2 as (
  insert into public.lessons (course_id, title, description, video_url, duration_minutes, sort_order)
  select id, 'Handling objections', 'A simple framework for turning objections into next steps.',
         'https://vimeo.com/76979871', 15, 2
  from course returning id
)
insert into public.questions (lesson_id, prompt, options, correct_option, explanation, sort_order)
select id, 'What is the main goal of a discovery call?',
       '["Pitch every feature", "Understand the prospect''s problem and priorities", "Send a proposal immediately"]'::jsonb,
       2, 'Discovery is about listening: understand the problem before offering a solution.', 1 from l1
union all
select id, 'Roughly how much of a discovery call should the prospect be talking?',
       '["10%", "30%", "70% or more"]'::jsonb,
       3, 'Top performers let the prospect do most of the talking.', 2 from l1
union all
select id, 'What should you do first when you hear an objection?',
       '["Argue the point", "Acknowledge it and ask a clarifying question", "Offer a discount"]'::jsonb,
       2, 'Acknowledging and clarifying shows you understand — and reveals the real concern.', 1 from l2;

-- 3. More courses to fill the other tracks (add lessons the same way).
insert into public.courses (slug, title, subtitle, category, sort_order, is_published) values
  ('build-your-offer',  'Build Your Offer',  'Package, price and position what you sell.', 'business',          2, true),
  ('personal-brand-101','Personal Brand 101','Become known for the thing you do best.',    'personal_branding', 3, true)
on conflict (slug) do nothing;
