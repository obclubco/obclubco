-- OB Club Networking: new applications also go to your Telegram group
-- Run in Supabase (SQL Editor → paste → Run), after 0006_applications.sql. Running it again is safe.
--
-- Then connect it, once:
--   1. Telegram → @BotFather → /newbot → choose a name → copy the token it gives you.
--   2. Add the bot to your group (the people who review applications).
--   3. Here in the SQL Editor:   select public.telegram_connect('PASTE-THE-TOKEN-HERE');
--      It finds the group, saves the settings and sends a test message there.
-- Every new application is then posted to the group. Accepting it on the Admin page marks the message
-- "Accepted"; deleting it takes the person's details out of the message. To stop: Table Editor →
-- telegram_settings → delete the row.

create extension if not exists http with schema extensions;

-- ─────────────────────────────────────────────────────────────
-- 1. Settings: one row, never readable from the website
-- ─────────────────────────────────────────────────────────────
create table if not exists public.telegram_settings (
  id            boolean primary key default true check (id),  -- a single row
  bot_token     text not null,
  chat_id       text not null,
  chat_title    text,
  site_url      text not null default 'https://networking.obclub.co',
  last_error    text,                                         -- why the last message didn't go through
  last_error_at timestamptz,
  updated_at    timestamptz not null default now()
);
alter table public.telegram_settings enable row level security;
revoke all on public.telegram_settings from anon, authenticated;

-- The group message of each application, so it can be updated later.
alter table public.applications add column if not exists telegram_message_id bigint;

-- ─────────────────────────────────────────────────────────────
-- 2. Talking to Telegram
-- ─────────────────────────────────────────────────────────────
create or replace function public.telegram_html(p text)
returns text language sql immutable
set search_path = ''
as $$
  select replace(replace(replace(p, '&', '&amp;'), '<', '&lt;'), '>', '&gt;')
$$;

-- One Bot API call. Gives up after p_timeout_ms, so a slow Telegram never holds up the application form.
create or replace function public.telegram_request(p_token text, p_method text, p_body jsonb, p_timeout_ms int default 1200)
returns jsonb language plpgsql security definer
set search_path = ''
as $$
declare
  v_response extensions.http_response;
begin
  perform set_config('http.timeout_msec', p_timeout_ms::text, true);  -- newer versions of the extension
  begin
    perform extensions.http_set_curlopt('CURLOPT_TIMEOUT_MS', p_timeout_ms::text);
  exception when others then
    null;  -- versions without this option use the setting above
  end;
  v_response := extensions.http_post(
    'https://api.telegram.org/bot' || p_token || '/' || p_method, p_body::text, 'application/json'
  );
  return v_response.content::jsonb;
end;
$$;

create or replace function public.telegram_failed(p_reason text)
returns void language plpgsql security definer
set search_path = ''
as $$
begin
  raise warning 'Telegram: %', p_reason;
  update public.telegram_settings set last_error = left(p_reason, 500), last_error_at = now();
end;
$$;

-- Posts a message to the group, as a reply to p_reply_to when given. Returns its id, or null (not connected,
-- or Telegram didn't take it).
drop function if exists public.telegram_post(text);  -- the first version, without replies
create or replace function public.telegram_post(p_text text, p_reply_to bigint default null)
returns bigint language plpgsql security definer
set search_path = ''
as $$
declare
  s       public.telegram_settings;
  v_reply jsonb;
begin
  select * into s from public.telegram_settings limit 1;
  if s.bot_token is null then
    return null;
  end if;
  for attempt in 1..2 loop
    v_reply := public.telegram_request(s.bot_token, 'sendMessage', jsonb_build_object(
      'chat_id', s.chat_id, 'text', p_text, 'parse_mode', 'HTML',
      'link_preview_options', jsonb_build_object('is_disabled', true))
      -- If the message replied to is gone, Telegram still posts this one, just not as a reply.
      || case when p_reply_to is null then '{}'::jsonb else jsonb_build_object('reply_parameters',
           jsonb_build_object('message_id', p_reply_to, 'allow_sending_without_reply', true)) end);
    if coalesce((v_reply ->> 'ok')::boolean, false) then
      update public.telegram_settings set last_error = null, last_error_at = null where last_error is not null;
      return (v_reply -> 'result' ->> 'message_id')::bigint;
    end if;
    -- The group became a supergroup, which has a new id: remember it and try once more.
    exit when v_reply -> 'parameters' ->> 'migrate_to_chat_id' is null;
    s.chat_id := v_reply -> 'parameters' ->> 'migrate_to_chat_id';
    update public.telegram_settings set chat_id = s.chat_id, updated_at = now();
  end loop;
  perform public.telegram_failed(coalesce(v_reply ->> 'description', 'no answer'));
  return null;
exception when others then
  perform public.telegram_failed(sqlerrm);
  return null;
end;
$$;

-- Rewrites a message posted earlier.
create or replace function public.telegram_edit(p_message_id bigint, p_text text)
returns void language plpgsql security definer
set search_path = ''
as $$
declare
  s       public.telegram_settings;
  v_reply jsonb;
begin
  select * into s from public.telegram_settings limit 1;
  if s.bot_token is null or p_message_id is null then
    return;
  end if;
  v_reply := public.telegram_request(s.bot_token, 'editMessageText', jsonb_build_object(
    'chat_id', s.chat_id, 'message_id', p_message_id, 'text', p_text, 'parse_mode', 'HTML',
    'link_preview_options', jsonb_build_object('is_disabled', true)));
  if not coalesce((v_reply ->> 'ok')::boolean, false)
     and coalesce(v_reply ->> 'description', '') not like '%message is not modified%' then
    perform public.telegram_failed(coalesce(v_reply ->> 'description', 'no answer'));
  end if;
exception when others then
  perform public.telegram_failed(sqlerrm);
end;
$$;

-- ─────────────────────────────────────────────────────────────
-- 3. The messages
-- ─────────────────────────────────────────────────────────────
-- p_status: 'new', 'accepted' or 'removed' (deleted on the Admin page, or replaced by a newer application).
create or replace function public.telegram_application_text(a public.applications, p_status text)
returns text language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_event  text;
  v_site   text;
  v_digits text := regexp_replace(a.phone, '\D', '', 'g');
begin
  select public.telegram_html(e.title) || ', ' || to_char(e.starts_at at time zone 'Europe/Riga', 'Dy FMDD Mon')
  into v_event
  from public.events e where e.id = a.event_id;
  v_event := coalesce(v_event, 'any event');

  -- Removed: nothing about the person stays in the group.
  if p_status = 'removed' then
    return '🗑 Application removed · ' || v_event || E'\n'
      || 'Deleted on the Admin page, or replaced by a newer one. Their details have been taken out of this message.';
  end if;

  select s.site_url into v_site from public.telegram_settings s limit 1;
  return array_to_string(array[
    case when p_status = 'accepted' then '✅ <b>Accepted</b>, on the guest list · ' else '🆕 <b>New application</b> · ' end
      || v_event,
    '',
    '<b>' || public.telegram_html(a.full_name) || '</b>' || coalesce(' · ' || public.telegram_html(a.role), ''),
    '💬 ' || public.telegram_html(a.note),
    '',
    '📞 ' || public.telegram_html(a.phone) || ' · prefers ' || case a.contact_via
      when 'whatsapp' then '<a href="https://wa.me/' || v_digits || '">WhatsApp</a>'
      when 'telegram' then '<a href="https://t.me/+' || v_digits || '">Telegram</a>'
      else 'a call'
    end,
    '✉️ ' || public.telegram_html(a.email),
    '🏢 ' || public.telegram_html(nullif(concat_ws(' · ', a.company, a.city), '')),
    '👋 Heard via ' || public.telegram_html(a.referred_by),
    '🔗 ' || public.telegram_html(a.links),
    '',
    '<a href="' || coalesce(v_site, 'https://networking.obclub.co') || '/manage/">Review on the Admin page</a>'
  ], E'\n');  -- lines with nothing to say (null) are left out
end;
$$;

-- New application → post it. Accepted → mark it. Deleted (or replaced) → take the details out.
-- Never stops the application itself from being saved, accepted or deleted.
create or replace function public.applications_to_telegram()
returns trigger language plpgsql security definer
set search_path = ''
as $$
declare
  v_message bigint;
begin
  if tg_op = 'INSERT' then
    v_message := public.telegram_post(public.telegram_application_text(new, 'new'));
    if v_message is not null then
      update public.applications set telegram_message_id = v_message where id = new.id;
    end if;
  elsif tg_op = 'UPDATE' then
    perform public.telegram_edit(new.telegram_message_id, public.telegram_application_text(new, new.status));
  else
    perform public.telegram_edit(old.telegram_message_id, public.telegram_application_text(old, 'removed'));
  end if;
  return null;
exception when others then
  raise warning 'Telegram: %', sqlerrm;
  return null;
end;
$$;

create or replace trigger applications_telegram_new
  after insert on public.applications
  for each row execute function public.applications_to_telegram();

create or replace trigger applications_telegram_status
  after update of status on public.applications
  for each row when (old.status is distinct from new.status and new.telegram_message_id is not null)
  execute function public.applications_to_telegram();

create or replace trigger applications_telegram_removed
  after delete on public.applications
  for each row when (old.telegram_message_id is not null)
  execute function public.applications_to_telegram();

-- ─────────────────────────────────────────────────────────────
-- 4. Connecting (run in the SQL Editor)
-- ─────────────────────────────────────────────────────────────
-- select public.telegram_connect('<token from @BotFather>');            finds the group the bot was added to
-- select public.telegram_connect('<token>', '<group id>');              when the bot is in several groups
create or replace function public.telegram_connect(p_token text, p_chat text default null)
returns text language plpgsql security definer
set search_path = ''
as $$
declare
  v_token text := trim(p_token);
  v_reply jsonb;
  v_bot   text;
  v_chats jsonb;
  v_chat  jsonb;
  v_error text;
  v_seen  int;
begin
  v_reply := public.telegram_request(v_token, 'getMe', '{}', 8000);
  if not coalesce((v_reply ->> 'ok')::boolean, false) then
    return 'Telegram didn''t accept that token. Copy it again from @BotFather: it looks like 123456789:AAHw3f…';
  end if;
  v_bot := '@' || (v_reply -> 'result' ->> 'username');

  if nullif(trim(p_chat), '') is not null then
    v_chat := jsonb_build_object('id', trim(p_chat));
  else
    -- Groups and channels the bot was added to or got a command in (Telegram keeps these for 24 hours).
    v_reply := public.telegram_request(v_token, 'getUpdates', '{}', 8000);
    if not coalesce((v_reply ->> 'ok')::boolean, false) then
      return 'Telegram: ' || coalesce(v_reply ->> 'description', 'no answer') || '. Try again in a minute.';
    end if;
    v_seen := jsonb_array_length(v_reply -> 'result');
    select coalesce(jsonb_agg(chat order by chat ->> 'title'), '[]') into v_chats
    from (
      select distinct on (c.chat ->> 'id') c.chat, c.status
      from jsonb_array_elements(v_reply -> 'result') u,
           lateral (select coalesce(u -> 'my_chat_member' -> 'chat', u -> 'message' -> 'chat',
                                    u -> 'edited_message' -> 'chat', u -> 'channel_post' -> 'chat') as chat,
                           u -> 'my_chat_member' -> 'new_chat_member' ->> 'status' as status) c
      where c.chat ->> 'type' in ('group', 'supergroup', 'channel')
      order by c.chat ->> 'id', (u ->> 'update_id')::bigint desc
    ) latest
    where coalesce(status, 'member') not in ('left', 'kicked');  -- not where it was removed again
    if jsonb_array_length(v_chats) = 0 then
      return v_bot || ' can''t see your group yet. In Telegram, open the group → Add members → search ' || v_bot
        || ' → Add (in a channel: add it as an administrator). Then send ' || replace(v_bot, '@', '/start@')
        || ' in the group and run this again. (Telegram has ' || case when v_seen = 0 then 'no recent activity'
        else v_seen || ' recent update(s), none from a group' end || ' for the bot.)';
    end if;
    if jsonb_array_length(v_chats) > 1 then
      return v_bot || ' is in several groups. Run this again with your token and the group to use: '
        || (select string_agg(format('"%s" → select public.telegram_connect(''<token>'', ''%s'');', g ->> 'title', g ->> 'id'), '   ')
            from jsonb_array_elements(v_chats) g);
    end if;
    v_chat := v_chats -> 0;
  end if;

  insert into public.telegram_settings (id, bot_token, chat_id, chat_title, last_error, last_error_at, updated_at)
  values (true, v_token, v_chat ->> 'id', v_chat ->> 'title', null, null, now())
  on conflict (id) do update
    set bot_token = excluded.bot_token, chat_id = excluded.chat_id, chat_title = excluded.chat_title,
        last_error = null, last_error_at = null, updated_at = now();

  if public.telegram_post('✅ Connected: new applications from the OB Club application page will appear here.') is null then
    select s.last_error into v_error from public.telegram_settings s;
    return 'Saved, but the test message didn''t go through (' || coalesce(v_error, 'no answer')
      || '). Check that ' || v_bot || ' is still in the group and allowed to send messages, then run this again.';
  end if;
  return 'Connected to ' || coalesce('"' || (v_chat ->> 'title') || '"', 'the group') || ' as ' || v_bot
    || '. A test message was sent there; new applications will appear in it.';
end;
$$;

-- Nothing here is callable from the website: only the triggers above and the SQL Editor use it.
revoke execute on function public.telegram_html(text)                               from public, anon, authenticated;
revoke execute on function public.telegram_request(text, text, jsonb, int)          from public, anon, authenticated;
revoke execute on function public.telegram_failed(text)                             from public, anon, authenticated;
revoke execute on function public.telegram_post(text, bigint)                       from public, anon, authenticated;
revoke execute on function public.telegram_edit(bigint, text)                       from public, anon, authenticated;
revoke execute on function public.telegram_application_text(public.applications, text) from public, anon, authenticated;
revoke execute on function public.applications_to_telegram()                        from public, anon, authenticated;
revoke execute on function public.telegram_connect(text, text)                      from public, anon, authenticated;
