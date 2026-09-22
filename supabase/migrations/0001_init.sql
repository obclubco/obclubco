-- OBC Partnership Program — database schema
-- Run this once in Supabase (SQL Editor → paste → Run), or with `supabase db push`.

-- ─────────────────────────────────────────────────────────────
-- 1. Access control: the email allowlist
-- ─────────────────────────────────────────────────────────────
-- Admins add a row here to authorise a partner. Deleting the row revokes access.
create table public.allowed_emails (
  email      text primary key check (email = lower(trim(email))),
  full_name  text,
  is_admin   boolean not null default false,
  note       text,
  created_at timestamptz not null default now()
);
alter table public.allowed_emails enable row level security;

create or replace function public.current_email()
returns text language sql stable
set search_path = ''
as $$ select lower(coalesce(auth.jwt() ->> 'email', '')) $$;

create or replace function public.is_member()
returns boolean language sql stable security definer
set search_path = ''
as $$
  select exists (select 1 from public.allowed_emails a where a.email = public.current_email())
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer
set search_path = ''
as $$
  select exists (select 1 from public.allowed_emails a where a.email = public.current_email() and a.is_admin)
$$;

-- Members can read their own allowlist row (used for name/admin flag in the UI); admins read all.
create policy "read own allowlist row" on public.allowed_emails
  for select to authenticated
  using (email = public.current_email() or public.is_admin());

-- Block account creation for any email that is not on the allowlist.
create or replace function public.enforce_allowlist()
returns trigger language plpgsql security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.allowed_emails a where a.email = lower(new.email)) then
    raise exception 'EMAIL_NOT_AUTHORIZED';
  end if;
  return new;
end;
$$;

create trigger enforce_allowlist_before_signup
  before insert on auth.users
  for each row execute function public.enforce_allowlist();

-- Profiles: one row per signed-up partner, so admins can see progress by email.
create table public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  email      text not null,
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
create policy "read own profile" on public.profiles
  for select to authenticated using (id = auth.uid() or public.is_admin());

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email) values (new.id, lower(new.email))
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─────────────────────────────────────────────────────────────
-- 2. Content: courses → lessons → questions
-- ─────────────────────────────────────────────────────────────
create table public.courses (
  id              uuid primary key default gen_random_uuid(),
  slug            text not null unique check (slug ~ '^[a-z0-9-]+$'),
  title           text not null,
  subtitle        text,
  description     text,
  category        text not null default 'business'
                  check (category in ('sales', 'business', 'personal_branding', 'other')),
  cover_image_url text,
  sort_order      int  not null default 0,
  pass_percentage int  not null default 70 check (pass_percentage between 0 and 100),
  is_published    boolean not null default false,
  created_at      timestamptz not null default now()
);

create table public.lessons (
  id               uuid primary key default gen_random_uuid(),
  course_id        uuid not null references public.courses (id) on delete cascade,
  title            text not null,
  description      text,
  -- YouTube / Vimeo / Loom link, a direct .mp4 URL,
  -- or "storage:<path>" for a file in the private `lesson-videos` bucket.
  video_url        text not null,
  duration_minutes int,
  sort_order       int not null default 0,
  is_published     boolean not null default true,
  created_at       timestamptz not null default now()
);
create index lessons_course_idx on public.lessons (course_id, sort_order);

create table public.questions (
  id             uuid primary key default gen_random_uuid(),
  lesson_id      uuid not null references public.lessons (id) on delete cascade,
  prompt         text not null,
  -- JSON array of answer strings, e.g. ["Option A", "Option B", "Option C"]
  options        jsonb not null check (jsonb_typeof(options) = 'array' and jsonb_array_length(options) >= 2),
  -- 1-based: 1 = first option in the list
  correct_option smallint not null check (correct_option >= 1),
  explanation    text,
  sort_order     int not null default 0,
  created_at     timestamptz not null default now(),
  check (correct_option <= jsonb_array_length(options))
);
create index questions_lesson_idx on public.questions (lesson_id, sort_order);

alter table public.courses   enable row level security;
alter table public.lessons   enable row level security;
alter table public.questions enable row level security;

create policy "members read published courses" on public.courses
  for select to authenticated
  using ((is_published and public.is_member()) or public.is_admin());

create policy "members read published lessons" on public.lessons
  for select to authenticated
  using (
    public.is_admin()
    or (
      is_published and public.is_member()
      and exists (select 1 from public.courses c where c.id = course_id and c.is_published)
    )
  );

create policy "members read questions" on public.questions
  for select to authenticated
  using (exists (select 1 from public.lessons l where l.id = lesson_id));  -- lessons RLS applies

-- Partners must never see the answer key: hide those columns from the API.
revoke select on public.questions from anon, authenticated;
grant select (id, lesson_id, prompt, options, sort_order) on public.questions to authenticated;

-- ─────────────────────────────────────────────────────────────
-- 3. Progress
-- ─────────────────────────────────────────────────────────────
create table public.lesson_progress (
  user_id            uuid not null references auth.users (id) on delete cascade,
  lesson_id          uuid not null references public.lessons (id) on delete cascade,
  video_completed_at timestamptz,
  quiz_passed_at     timestamptz,
  best_score         int,          -- best percentage 0-100
  attempts           int not null default 0,
  updated_at         timestamptz not null default now(),
  primary key (user_id, lesson_id)
);

create table public.quiz_attempts (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  lesson_id  uuid not null references public.lessons (id) on delete cascade,
  answers    jsonb not null,
  correct    int not null,
  total      int not null,
  percentage int not null,
  passed     boolean not null,
  created_at timestamptz not null default now()
);
create index quiz_attempts_user_idx on public.quiz_attempts (user_id, lesson_id);

alter table public.lesson_progress enable row level security;
alter table public.quiz_attempts   enable row level security;

-- Read-only from the API; all writes go through the functions below.
create policy "read own progress" on public.lesson_progress
  for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy "read own attempts" on public.quiz_attempts
  for select to authenticated using (user_id = auth.uid() or public.is_admin());

-- Mark a lesson's video as watched.
create or replace function public.mark_video_complete(p_lesson_id uuid)
returns void language plpgsql security definer
set search_path = ''
as $$
begin
  if not public.is_member() then raise exception 'NOT_AUTHORIZED'; end if;
  if not exists (
    select 1 from public.lessons l join public.courses c on c.id = l.course_id
    where l.id = p_lesson_id and ((l.is_published and c.is_published) or public.is_admin())
  ) then raise exception 'LESSON_NOT_FOUND'; end if;

  insert into public.lesson_progress (user_id, lesson_id, video_completed_at)
  values (auth.uid(), p_lesson_id, now())
  on conflict (user_id, lesson_id) do update
    set video_completed_at = coalesce(public.lesson_progress.video_completed_at, now()),
        updated_at = now();
end;
$$;

-- Grade a quiz server-side. p_answers: {"<question_id>": <1-based option>, ...}
-- Returns the score plus per-question feedback (correct option + explanation).
create or replace function public.submit_quiz(p_lesson_id uuid, p_answers jsonb)
returns jsonb language plpgsql security definer
set search_path = ''
as $$
declare
  v_total   int;
  v_correct int;
  v_pct     int;
  v_pass    int;
  v_passed  boolean;
  v_results jsonb;
begin
  if not public.is_member() then raise exception 'NOT_AUTHORIZED'; end if;

  select c.pass_percentage into v_pass
  from public.lessons l join public.courses c on c.id = l.course_id
  where l.id = p_lesson_id and ((l.is_published and c.is_published) or public.is_admin());
  if v_pass is null then raise exception 'LESSON_NOT_FOUND'; end if;

  select
    count(*),
    count(*) filter (where (p_answers ->> q.id::text)::int = q.correct_option),
    coalesce(jsonb_agg(jsonb_build_object(
      'question_id',    q.id,
      'selected',       (p_answers ->> q.id::text)::int,
      'correct_option', q.correct_option,
      'is_correct',     (p_answers ->> q.id::text)::int is not distinct from q.correct_option::int,
      'explanation',    q.explanation
    ) order by q.sort_order), '[]'::jsonb)
  into v_total, v_correct, v_results
  from public.questions q
  where q.lesson_id = p_lesson_id;

  v_pct    := case when v_total = 0 then 100 else round(v_correct * 100.0 / v_total) end;
  v_passed := v_pct >= v_pass;

  insert into public.quiz_attempts (user_id, lesson_id, answers, correct, total, percentage, passed)
  values (auth.uid(), p_lesson_id, p_answers, v_correct, v_total, v_pct, v_passed);

  insert into public.lesson_progress (user_id, lesson_id, video_completed_at, quiz_passed_at, best_score, attempts)
  values (auth.uid(), p_lesson_id, now(), case when v_passed then now() end, v_pct, 1)
  on conflict (user_id, lesson_id) do update set
    video_completed_at = coalesce(public.lesson_progress.video_completed_at, now()),
    quiz_passed_at     = coalesce(public.lesson_progress.quiz_passed_at, excluded.quiz_passed_at),
    best_score         = greatest(coalesce(public.lesson_progress.best_score, 0), excluded.best_score),
    attempts           = public.lesson_progress.attempts + 1,
    updated_at         = now();

  return jsonb_build_object(
    'correct', v_correct, 'total', v_total, 'percentage', v_pct,
    'pass_percentage', v_pass, 'passed', v_passed, 'results', v_results
  );
end;
$$;

revoke execute on function public.mark_video_complete(uuid) from public, anon;
revoke execute on function public.submit_quiz(uuid, jsonb)   from public, anon;
grant  execute on function public.mark_video_complete(uuid) to authenticated;
grant  execute on function public.submit_quiz(uuid, jsonb)   to authenticated;

-- ─────────────────────────────────────────────────────────────
-- 4. Private video storage (optional — use "storage:<path>" as video_url)
-- ─────────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('lesson-videos', 'lesson-videos', false)
on conflict (id) do nothing;

create policy "members read lesson videos" on storage.objects
  for select to authenticated
  using (bucket_id = 'lesson-videos' and public.is_member());
