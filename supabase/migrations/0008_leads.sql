-- OB Club Networking: leads. Call notes on applications, posted to Telegram.
-- Run in Supabase (SQL Editor → paste → Run), after 0006_applications.sql and 0007_telegram.sql.
-- Running it again is safe.
--
-- On the Admin page, every application has call notes: what you talked about and how it went: Closed,
-- Follow-up needed (with a date if you like) or No. Each note is posted to the Telegram group as a reply to
-- the application's message. Deleting a note, or the whole application, takes it out of the group again.

-- ─────────────────────────────────────────────────────────────
-- 1. Call notes
-- ─────────────────────────────────────────────────────────────
create table if not exists public.application_notes (
  id                  uuid primary key default gen_random_uuid(),
  application_id      uuid not null references public.applications (id) on delete cascade,
  outcome             text not null check (outcome in ('closed', 'follow_up', 'no')),
  body                text not null check (char_length(body) between 1 and 3000),  -- what you talked about
  follow_up_on        date check (follow_up_on is null or outcome = 'follow_up'),
  author_id           uuid references public.guests (id) on delete set null,
  author_name         text,
  telegram_message_id bigint,
  created_at          timestamptz not null default now()
);
create index if not exists application_notes_application_idx
  on public.application_notes (application_id, created_at desc);

-- Admins only. New notes come in through add_lead_note() below.
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

-- Admins: write down a call. p_outcome: 'closed', 'follow_up' or 'no'.
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
  if not exists (select 1 from public.applications a where a.id = p_application_id) then
    raise exception 'APPLICATION_NOT_FOUND';
  end if;
  insert into public.application_notes (application_id, outcome, body, follow_up_on, author_id, author_name)
  values (p_application_id, p_outcome, trim(p_body), case when p_outcome = 'follow_up' then p_follow_up_on end,
          v_me, (select g.full_name from public.guests g where g.id = v_me))
  returning * into v_note;
  -- Read it back: posting it to Telegram (below) added the message id.
  select * into v_note from public.application_notes n where n.id = v_note.id;
  return v_note;
end;
$$;

-- ─────────────────────────────────────────────────────────────
-- 2. Telegram (when 0007_telegram.sql is set up; without it, notes are simply saved)
-- ─────────────────────────────────────────────────────────────
create or replace function public.telegram_note_text(n public.application_notes, p_removed boolean default false)
returns text language plpgsql stable security definer
set search_path = ''
as $$
declare
  a       public.applications;
  v_event text;
begin
  -- Removed: nothing about the call stays in the group.
  if p_removed then
    return '🗑 Call notes removed. They were deleted on the Admin page, on their own or with the application.';
  end if;
  select * into a from public.applications x where x.id = n.application_id;
  select public.telegram_html(e.title) || ', ' || to_char(e.starts_at at time zone 'Europe/Riga', 'Dy FMDD Mon')
  into v_event
  from public.events e where e.id = a.event_id;
  return array_to_string(array[
    '📞 <b>Call notes</b> · ' || public.telegram_html(a.full_name) || ' · ' || coalesce(v_event, 'any event'),
    case n.outcome
      when 'closed'    then '✅ <b>Closed</b>'
      when 'follow_up' then '🔁 <b>Follow-up needed</b>'
                            || coalesce(' · ' || to_char(n.follow_up_on, 'Dy FMDD Mon'), '')
      else                  '❌ <b>No</b>'
    end,
    '',
    public.telegram_html(n.body),
    '',
    '— ' || coalesce(public.telegram_html(n.author_name), 'an admin')
  ], E'\n');
end;
$$;

-- New note → post it under the application's message. Deleted → take it out. Never stops the note itself.
create or replace function public.application_notes_to_telegram()
returns trigger language plpgsql security definer
set search_path = ''
as $$
declare
  v_reply_to bigint;
  v_message  bigint;
begin
  if tg_op = 'INSERT' then
    select a.telegram_message_id into v_reply_to from public.applications a where a.id = new.application_id;
    v_message := public.telegram_post(public.telegram_note_text(new), v_reply_to);
    if v_message is not null then
      update public.application_notes set telegram_message_id = v_message where id = new.id;
    end if;
  else
    perform public.telegram_edit(old.telegram_message_id, public.telegram_note_text(old, true));
  end if;
  return null;
exception when others then
  raise warning 'Telegram: %', sqlerrm;
  return null;
end;
$$;

create or replace trigger application_notes_telegram_new
  after insert on public.application_notes
  for each row execute function public.application_notes_to_telegram();

create or replace trigger application_notes_telegram_removed
  after delete on public.application_notes
  for each row when (old.telegram_message_id is not null)
  execute function public.application_notes_to_telegram();

revoke execute on function public.add_lead_note(uuid, text, text, date)                    from public, anon;
revoke execute on function public.telegram_note_text(public.application_notes, boolean)    from public, anon, authenticated;
revoke execute on function public.application_notes_to_telegram()                           from public, anon, authenticated;
grant  execute on function public.add_lead_note(uuid, text, text, date)                    to authenticated;
