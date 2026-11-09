-- LateNite — Phase 3: messenger (DMs + groups), presence, away messages, typing, read receipts, nudges.

create table public.presence (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  status text not null default 'online' check (status in ('online', 'away', 'busy', 'invisible')),
  status_message text check (status_message is null or char_length(status_message) <= 80),
  away_message text check (away_message is null or char_length(away_message) <= 200),
  now_playing text check (now_playing is null or char_length(now_playing) <= 120),
  show_now_playing boolean not null default true,
  last_seen_at timestamptz not null default now()
);
alter table public.presence enable row level security;
revoke all on public.presence from anon, authenticated;
create policy presence_select on public.presence for select to authenticated using (user_id = (select auth.uid()));
create policy presence_update on public.presence for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
grant select on public.presence to authenticated;
grant update (status, status_message, away_message, now_playing, show_now_playing) on public.presence to authenticated;

insert into public.presence (user_id) select id from public.profiles on conflict do nothing;

create or replace function app.on_profile_presence() returns trigger language plpgsql security definer set search_path = '' as $$
begin insert into public.presence (user_id) values (new.id) on conflict do nothing; return new; end; $$;
create trigger profile_presence after insert on public.profiles for each row execute function app.on_profile_presence();

-- What others see: invisible or idle for 3 minutes = offline. Away message only shows while away.
create or replace function app.effective_status(p public.presence) returns text language sql stable as $$
  select case when p.user_id is null or p.status = 'invisible' or p.last_seen_at < now() - interval '3 minutes' then 'offline' else p.status end;
$$;

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  is_group boolean not null default false,
  dm_key text unique,
  title text check (title is null or char_length(btrim(title)) between 1 and 60),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  last_message_at timestamptz not null default now(),
  check (is_group or dm_key is not null)
);

create table public.conversation_members (
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  joined_at timestamptz not null default now(),
  last_read_at timestamptz not null default now(),
  muted boolean not null default false,
  typing_until timestamptz,
  primary key (conversation_id, user_id)
);
create index conversation_members_user on public.conversation_members (user_id);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_id uuid references public.profiles (id) on delete cascade,
  kind text not null default 'text' check (kind in ('text', 'image', 'voice', 'nudge', 'away', 'system')),
  body text check (body is null or char_length(body) <= 4000),
  media_path text check (media_path is null or (char_length(media_path) <= 300 and media_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[A-Za-z0-9._-]+$')),
  created_at timestamptz not null default now(),
  check (kind not in ('text', 'away') or char_length(btrim(coalesce(body, ''))) > 0),
  check (kind not in ('image', 'voice') or media_path is not null)
);
create index messages_conv_created on public.messages (conversation_id, created_at desc);
create index messages_sender on public.messages (sender_id);

create or replace function app.is_member(conv uuid, u uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select u is not null and exists (select 1 from public.conversation_members m where m.conversation_id = conv and m.user_id = u);
$$;

-- Blocked with anyone else in this DM?
create or replace function app.dm_blocked(conv uuid, u uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.conversations c join public.conversation_members m on m.conversation_id = c.id
                 where c.id = conv and not c.is_group and m.user_id <> u and app.is_blocked(u, m.user_id));
$$;

alter table public.conversations enable row level security;
revoke all on public.conversations from anon, authenticated;
alter table public.conversation_members enable row level security;
revoke all on public.conversation_members from anon, authenticated;
alter table public.messages enable row level security;
revoke all on public.messages from anon, authenticated;

create policy conv_select on public.conversations for select to authenticated using (app.is_member(id, (select auth.uid())));
grant select on public.conversations to authenticated;

-- Only your own membership rows (read receipts of others go through conversation_state, which respects settings).
create policy cm_select on public.conversation_members for select to authenticated using (user_id = (select auth.uid()));
create policy cm_update on public.conversation_members for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
grant select on public.conversation_members to authenticated;
grant update (muted) on public.conversation_members to authenticated;

create policy msg_select on public.messages for select to authenticated
  using (app.is_member(conversation_id, (select auth.uid())) and not app.is_blocked((select auth.uid()), sender_id));
create policy msg_insert on public.messages for insert to authenticated
  with check (sender_id = (select auth.uid()) and kind in ('text', 'image', 'voice')
              and app.is_member(conversation_id, (select auth.uid())) and not app.dm_blocked(conversation_id, (select auth.uid()))
              and app.is_active((select auth.uid()))
              and (media_path is null or split_part(media_path, '/', 1) = conversation_id::text and split_part(media_path, '/', 2) = (select auth.uid())::text));
create policy msg_delete on public.messages for delete to authenticated using (sender_id = (select auth.uid()));
grant select on public.messages to authenticated;
grant insert (conversation_id, sender_id, kind, body, media_path) on public.messages to authenticated;
grant delete on public.messages to authenticated;

create or replace function app.before_message() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.kind in ('text', 'image', 'voice') and
     (select count(*) from public.messages where sender_id = new.sender_id and created_at > now() - interval '1 minute') >= 40 then
    raise exception 'AH_RATE_LIMIT' using errcode = 'P0001';
  end if;
  return new;
end; $$;
create trigger message_rate before insert on public.messages for each row execute function app.before_message();

create or replace function app.after_message() returns trigger language plpgsql security definer set search_path = '' as $$
declare r record;
begin
  update public.conversations set last_message_at = new.created_at where id = new.conversation_id;
  update public.conversation_members set last_read_at = new.created_at, typing_until = null
    where conversation_id = new.conversation_id and user_id = new.sender_id;
  -- Away auto-reply (DMs only, at most once per 10 minutes per conversation)
  if new.kind in ('text', 'image', 'voice') and not (select is_group from public.conversations where id = new.conversation_id) then
    for r in select p.user_id, p.away_message from public.conversation_members m join public.presence p on p.user_id = m.user_id
             where m.conversation_id = new.conversation_id and m.user_id <> new.sender_id
               and app.effective_status(p) = 'away' and coalesce(btrim(p.away_message), '') <> '' loop
      if not exists (select 1 from public.messages x where x.conversation_id = new.conversation_id and x.kind = 'away'
                     and x.sender_id = r.user_id and x.created_at > now() - interval '10 minutes') then
        insert into public.messages (conversation_id, sender_id, kind, body) values (new.conversation_id, r.user_id, 'away', r.away_message);
      end if;
    end loop;
  end if;
  return new;
end; $$;
create trigger message_after after insert on public.messages for each row execute function app.after_message();

-- Realtime (hosted Supabase): stream inserts so chats update instantly. Locally, the app polls instead.
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.messages;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- RPCs
-- ---------------------------------------------------------------------------

create or replace function public.heartbeat() returns void language sql security definer set search_path = '' as $$
  insert into public.presence (user_id, last_seen_at) values (auth.uid(), now())
  on conflict (user_id) do update set last_seen_at = now();
$$;

create or replace function public.start_dm(p_other uuid) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_me uuid := auth.uid(); v_key text; v_id uuid;
begin
  if v_me is null then raise exception 'AH_AUTH' using errcode = '42501'; end if;
  if p_other = v_me or not app.is_active(p_other) or app.is_blocked(v_me, p_other) then raise exception 'AH_NOT_ALLOWED' using errcode = '42501'; end if;
  v_key := least(v_me, p_other)::text || ':' || greatest(v_me, p_other)::text;
  select id into v_id from public.conversations where dm_key = v_key;
  if v_id is not null then return v_id; end if;
  if not app.are_friends(v_me, p_other) then raise exception 'AH_NOT_FRIENDS' using errcode = '42501'; end if;
  insert into public.conversations (is_group, dm_key, created_by) values (false, v_key, v_me) returning id into v_id;
  insert into public.conversation_members (conversation_id, user_id) values (v_id, v_me), (v_id, p_other);
  return v_id;
end; $$;

create or replace function public.create_group(p_title text, p_members uuid[]) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_me uuid := auth.uid(); v_id uuid; m uuid;
begin
  if v_me is null then raise exception 'AH_AUTH' using errcode = '42501'; end if;
  p_members := array(select distinct x from unnest(coalesce(p_members, '{}')) x where x <> v_me);
  if cardinality(p_members) < 2 or cardinality(p_members) > 24 then raise exception 'AH_BAD_TARGET' using errcode = '22023'; end if;
  foreach m in array p_members loop
    if not app.are_friends(v_me, m) or not app.is_active(m) then raise exception 'AH_NOT_FRIENDS' using errcode = '42501'; end if;
  end loop;
  insert into public.conversations (is_group, title, created_by) values (true, left(btrim(coalesce(nullif(p_title, ''), 'Group chat')), 60), v_me) returning id into v_id;
  insert into public.conversation_members (conversation_id, user_id) select v_id, x from unnest(array_append(p_members, v_me)) x;
  insert into public.messages (conversation_id, sender_id, kind, body) values (v_id, v_me, 'system', 'started the group');
  return v_id;
end; $$;

create or replace function public.add_to_group(p_conv uuid, p_user uuid) returns void language plpgsql security definer set search_path = '' as $$
declare v_me uuid := auth.uid();
begin
  if not app.is_member(p_conv, v_me) or not (select is_group from public.conversations where id = p_conv)
     or not app.are_friends(v_me, p_user) then raise exception 'AH_NOT_ALLOWED' using errcode = '42501'; end if;
  if (select count(*) from public.conversation_members where conversation_id = p_conv) >= 25 then raise exception 'AH_BAD_TARGET' using errcode = '22023'; end if;
  insert into public.conversation_members (conversation_id, user_id) values (p_conv, p_user) on conflict do nothing;
  insert into public.messages (conversation_id, sender_id, kind, body)
    values (p_conv, v_me, 'system', 'added ' || (select display_name from public.profiles where id = p_user));
end; $$;

create or replace function public.leave_group(p_conv uuid) returns void language plpgsql security definer set search_path = '' as $$
begin
  if not (select is_group from public.conversations where id = p_conv) then raise exception 'AH_NOT_ALLOWED' using errcode = '42501'; end if;
  insert into public.messages (conversation_id, sender_id, kind, body) select p_conv, auth.uid(), 'system', 'left the group' where app.is_member(p_conv, auth.uid());
  delete from public.conversation_members where conversation_id = p_conv and user_id = auth.uid();
  delete from public.conversations c where c.id = p_conv and not exists (select 1 from public.conversation_members m where m.conversation_id = c.id);
end; $$;

create or replace function public.mark_read(p_conv uuid) returns void language sql security definer set search_path = '' as $$
  update public.conversation_members set last_read_at = now() where conversation_id = p_conv and user_id = auth.uid();
$$;

create or replace function public.set_typing(p_conv uuid, p_typing boolean default true) returns void language sql security definer set search_path = '' as $$
  update public.conversation_members set typing_until = case when p_typing then now() + interval '6 seconds' else null end
  where conversation_id = p_conv and user_id = auth.uid();
$$;

create or replace function public.send_nudge(p_conv uuid) returns void language plpgsql security definer set search_path = '' as $$
declare v_me uuid := auth.uid(); v_other uuid;
begin
  if not app.is_member(p_conv, v_me) or (select is_group from public.conversations where id = p_conv) or app.dm_blocked(p_conv, v_me) then
    raise exception 'AH_NOT_ALLOWED' using errcode = '42501';
  end if;
  select user_id into v_other from public.conversation_members where conversation_id = p_conv and user_id <> v_me;
  if not coalesce((select allow_nudges from public.profile_settings where id = v_other), false) then raise exception 'AH_NUDGES_OFF' using errcode = 'P0001'; end if;
  if exists (select 1 from public.messages where conversation_id = p_conv and sender_id = v_me and kind = 'nudge' and created_at > now() - interval '10 seconds') then
    raise exception 'AH_NUDGE_COOLDOWN' using errcode = 'P0001';
  end if;
  if (select count(*) from public.messages where sender_id = v_me and kind = 'nudge' and created_at > now() - interval '1 hour') >= 20 then
    raise exception 'AH_RATE_LIMIT' using errcode = 'P0001';
  end if;
  insert into public.messages (conversation_id, sender_id, kind) values (p_conv, v_me, 'nudge');
  if not exists (select 1 from public.notifications where user_id = v_other and actor_id = v_me and type = 'nudge' and read_at is null) then
    perform app.notify(v_other, v_me, 'nudge', p_conv);
  end if;
end; $$;

-- Buddy list: my friends with what they're up to.
create or replace function public.buddy_list()
returns table (id uuid, username text, display_name text, avatar_url text, mood text, status text, status_message text, away_message text, now_playing text, last_seen_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select p.id, p.username::text, p.display_name, p.avatar_url, p.mood,
         app.effective_status(pr), pr.status_message,
         case when app.effective_status(pr) = 'away' then pr.away_message end,
         case when pr.show_now_playing and app.effective_status(pr) <> 'offline' then pr.now_playing end,
         case when pr.status = 'invisible' then null else pr.last_seen_at end
  from app.my_friend_ids() f(fid)
  join public.profiles p on p.id = f.fid
  left join public.presence pr on pr.user_id = p.id
  where p.suspended_at is null and not app.is_blocked(auth.uid(), p.id)
  order by p.display_name;
$$;

-- Online status for a set of people (friends only; everyone else comes back null).
create or replace function public.presence_of(p_ids uuid[])
returns table (id uuid, status text, status_message text) language sql stable security definer set search_path = '' as $$
  select x, case when x = auth.uid() or app.are_friends(auth.uid(), x) then app.effective_status(pr) end,
            case when x = auth.uid() or app.are_friends(auth.uid(), x) then pr.status_message end
  from unnest(p_ids) x left join public.presence pr on pr.user_id = x;
$$;

create or replace function public.my_conversations()
returns table (id uuid, is_group boolean, title text, last_message_at timestamptz, muted boolean, unread int,
               last_body text, last_kind text, last_sender uuid, members jsonb)
language sql stable security definer set search_path = '' as $$
  select c.id, c.is_group, c.title, c.last_message_at, me.muted,
    (select count(*)::int from public.messages x where x.conversation_id = c.id and x.created_at > me.last_read_at
       and x.sender_id is distinct from auth.uid() and not app.is_blocked(auth.uid(), x.sender_id)),
    lm.body, lm.kind, lm.sender_id,
    (select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'username', p.username, 'display_name', p.display_name, 'avatar_url', p.avatar_url,
                                                  'status', case when app.are_friends(auth.uid(), p.id) then app.effective_status(pr) end)), '[]'::jsonb)
       from public.conversation_members om join public.profiles p on p.id = om.user_id left join public.presence pr on pr.user_id = p.id
       where om.conversation_id = c.id and om.user_id <> auth.uid() and not app.is_blocked(auth.uid(), p.id))
  from public.conversation_members me
  join public.conversations c on c.id = me.conversation_id
  left join lateral (select x.body, x.kind, x.sender_id from public.messages x where x.conversation_id = c.id
                     and not app.is_blocked(auth.uid(), x.sender_id) order by x.created_at desc limit 1) lm on true
  where me.user_id = auth.uid()
  order by c.last_message_at desc
  limit 200;
$$;

-- Who's typing + read receipts (only when both sides have receipts on).
create or replace function public.conversation_state(p_conv uuid)
returns table (user_id uuid, typing boolean, last_read_at timestamptz) language sql stable security definer set search_path = '' as $$
  select m.user_id, coalesce(m.typing_until > now(), false),
         case when coalesce((select read_receipts from public.profile_settings where id = auth.uid()), false)
               and coalesce((select read_receipts from public.profile_settings where id = m.user_id), false) then m.last_read_at end
  from public.conversation_members m
  where m.conversation_id = p_conv and m.user_id <> auth.uid() and app.is_member(p_conv, auth.uid())
    and not app.is_blocked(auth.uid(), m.user_id);
$$;

create or replace function public.unread_conversation_count() returns int language sql stable security definer set search_path = '' as $$
  select count(*)::int from public.conversation_members me
  where me.user_id = auth.uid() and not me.muted
    and exists (select 1 from public.messages x where x.conversation_id = me.conversation_id and x.created_at > me.last_read_at
                and x.sender_id is distinct from auth.uid() and not app.is_blocked(auth.uid(), x.sender_id));
$$;

revoke execute on all functions in schema public from public, anon;
grant execute on function public.username_available(text), public.friends_of(uuid, int), public.get_top_friends(uuid), public.visit_stats(uuid) to anon, authenticated;
grant execute on function public.heartbeat(), public.start_dm(uuid), public.create_group(text, uuid[]), public.add_to_group(uuid, uuid), public.leave_group(uuid),
  public.mark_read(uuid), public.set_typing(uuid, boolean), public.send_nudge(uuid), public.buddy_list(), public.presence_of(uuid[]),
  public.my_conversations(), public.conversation_state(uuid), public.unread_conversation_count() to authenticated;
revoke all on all functions in schema app from public;
grant execute on all functions in schema app to anon, authenticated, service_role;
