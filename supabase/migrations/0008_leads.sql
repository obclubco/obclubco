-- OB Club Networking: leads. Call notes on applications.
-- Run in Supabase (SQL Editor → paste → Run), after 0006_applications.sql. Running it again is safe.
--
-- On the Admin page, every application has call notes: what you talked about and how it went, Closed or
-- Follow-up needed (with a date if you like). Notes can be edited and deleted, and only admins see them.
-- (The first version of this file also posted notes to Telegram; running this version switches that off.)

-- ─────────────────────────────────────────────────────────────
-- 1. Call notes
-- ─────────────────────────────────────────────────────────────
create table if not exists public.application_notes (
  id             uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications (id) on delete cascade,
  outcome        text not null check (outcome in ('closed', 'follow_up', 'no')),  -- 'no' only on older notes
  body           text not null check (char_length(body) between 1 and 3000),       -- what you talked about
  follow_up_on   date check (follow_up_on is null or outcome = 'follow_up'),
  author_id      uuid references public.guests (id) on delete set null,
  author_name    text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz                                                         -- last edited
);
alter table public.application_notes add column if not exists updated_at timestamptz;
create index if not exists application_notes_application_idx
  on public.application_notes (application_id, created_at desc);

-- No more Telegram for call notes (the first version posted them).
drop trigger if exists application_notes_telegram_new on public.application_notes;
drop trigger if exists application_notes_telegram_removed on public.application_notes;
drop function if exists public.application_notes_to_telegram();
drop function if exists public.telegram_note_text(public.application_notes, boolean);
alter table public.application_notes drop column if exists telegram_message_id;

-- Admins only. Notes are written and edited through the functions below.
alter table public.application_notes enable row level security;

drop policy if exists "admins read call notes" on public.application_notes;
create policy "admins read call notes" on public.application_notes
  for select to authenticated
  using ((select public.is_networking_admin()));

drop policy if exists "admins delete call notes" on public.application_notes;
create policy "admins delete call notes" on public.application_notes
  for delete to authenticated
  using ((select public.is_networking_admin()));

revoke all on public.application_notes from anon, authenticated;
grant select, delete on public.application_notes to authenticated;

-- ─────────────────────────────────────────────────────────────
-- 2. Writing and editing notes (admins)
-- ─────────────────────────────────────────────────────────────
-- p_outcome: 'closed' or 'follow_up'. p_follow_up_on only goes with 'follow_up'.
create or replace function public.add_lead_note(
  p_application_id uuid, p_outcome text, p_body text, p_follow_up_on date default null
)
returns public.application_notes language plpgsql security definer
set search_path = ''
as $$
declare
  v_me   uuid := public.my_guest_id();
  v_note public.application_notes;
begin
  if not public.is_networking_admin() then raise exception 'NOT_AUTHORIZED'; end if;
  if p_outcome is null or p_outcome not in ('closed', 'follow_up') then raise exception 'INVALID_OUTCOME'; end if;
  if not exists (select 1 from public.applications a where a.id = p_application_id) then
    raise exception 'APPLICATION_NOT_FOUND';
  end if;
  insert into public.application_notes (application_id, outcome, body, follow_up_on, author_id, author_name)
  values (p_application_id, p_outcome, trim(p_body), case when p_outcome = 'follow_up' then p_follow_up_on end,
          v_me, (select g.full_name from public.guests g where g.id = v_me))
  returning * into v_note;
  return v_note;
end;
$$;

-- Changes a note in place (no new note).
create or replace function public.update_lead_note(
  p_id uuid, p_outcome text, p_body text, p_follow_up_on date default null
)
returns public.application_notes language plpgsql security definer
set search_path = ''
as $$
declare
  v_note public.application_notes;
begin
  if not public.is_networking_admin() then raise exception 'NOT_AUTHORIZED'; end if;
  if p_outcome is null or p_outcome not in ('closed', 'follow_up') then raise exception 'INVALID_OUTCOME'; end if;
  update public.application_notes n
  set outcome = p_outcome,
      body = trim(p_body),
      follow_up_on = case when p_outcome = 'follow_up' then p_follow_up_on end,
      updated_at = now()
  where n.id = p_id
  returning * into v_note;
  if not found then raise exception 'NOTE_NOT_FOUND'; end if;
  return v_note;
end;
$$;

revoke execute on function public.add_lead_note(uuid, text, text, date)    from public, anon;
revoke execute on function public.update_lead_note(uuid, text, text, date) from public, anon;
grant  execute on function public.add_lead_note(uuid, text, text, date)    to authenticated;
grant  execute on function public.update_lead_note(uuid, text, text, date) to authenticated;
