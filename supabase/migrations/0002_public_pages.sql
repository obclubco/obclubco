-- OBC Partnership Program — public About & Coaches pages
-- Run once in Supabase (SQL Editor → paste → Run), after 0001_init.sql.

-- ─────────────────────────────────────────────────────────────
-- 1. Course catalogue for the About page
-- ─────────────────────────────────────────────────────────────
-- Anyone can see a summary of the published courses (no lessons, videos or answers).
create or replace function public.get_course_catalog()
returns table (
  slug        text,
  title       text,
  subtitle    text,
  description text,
  category    text,
  lessons     int,
  minutes     int
)
language sql stable security definer
set search_path = ''
as $$
  select c.slug, c.title, c.subtitle, c.description, c.category,
         count(l.id)::int,
         coalesce(sum(l.duration_minutes), 0)::int
  from public.courses c
  left join public.lessons l on l.course_id = c.id and l.is_published
  where c.is_published
  group by c.id
  order by c.sort_order, c.created_at
$$;

grant execute on function public.get_course_catalog() to anon, authenticated;

-- ─────────────────────────────────────────────────────────────
-- 2. Coaches (public)
-- ─────────────────────────────────────────────────────────────
create table public.coaches (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  role        text,                          -- e.g. "Founder, Palsir · Sales coach"
  photo_url   text,                          -- square image works best
  bio         text,                          -- short introduction
  experience  text,                          -- longer text; line breaks are kept
  highlights  text[] not null default '{}',  -- e.g. {"12 years in B2B sales","Scaled a team to 40 reps"}
  -- Portfolio links: [{"label": "LinkedIn", "url": "https://…"}, {"label": "Case study", "url": "https://…"}]
  portfolio   jsonb not null default '[]'
              check (jsonb_typeof(portfolio) = 'array'),
  sort_order  int not null default 0,
  is_published boolean not null default true,
  created_at  timestamptz not null default now()
);

alter table public.coaches enable row level security;

create policy "anyone reads published coaches" on public.coaches
  for select to anon, authenticated
  using (is_published or public.is_admin());

grant select on public.coaches to anon, authenticated;

-- Example (edit and run to add a coach):
-- insert into public.coaches (name, role, bio, experience, highlights, portfolio, sort_order) values (
--   'Jane Doe',
--   'Founder & Sales Coach',
--   'Built and sold two B2B companies; now helps OBC partners close bigger deals.',
--   E'12 years in enterprise sales.\nFormer VP Sales at Example Co.',
--   array['12 years in B2B sales', '€10M+ in closed deals'],
--   '[{"label": "LinkedIn", "url": "https://www.linkedin.com/"}]',
--   1
-- );
