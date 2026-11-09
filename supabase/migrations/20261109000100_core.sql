-- LateNite — Phase 1: core schema (profiles, friends, blocks, feed, notifications, reports)
-- Every table has RLS on. Helper functions live in the private `app` schema, which the
-- Data API does not expose, so they can be used by policies but never called directly.

create extension if not exists citext with schema extensions;
create extension if not exists pg_trgm with schema extensions;

-- New tables start with no Data API access; each migration grants exactly what it needs.
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on functions from anon, authenticated, public;

create schema if not exists app;
grant usage on schema app to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username extensions.citext not null unique
    check (username::text ~ '^[a-z0-9._]{3,20}$' and username::text !~ '^[._]|[._]$|\.\.'),
  display_name text not null check (char_length(btrim(display_name)) between 1 and 40),
  avatar_url text check (avatar_url is null or char_length(avatar_url) <= 500),
  mood text check (mood is null or char_length(mood) <= 40),
  mood_color text check (mood_color is null or mood_color ~ '^#[0-9a-fA-F]{6}$'),
  is_private boolean not null default false,
  discoverable boolean not null default false,
  suspended_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index profiles_username_trgm on public.profiles using gin ((username::text) extensions.gin_trgm_ops);
create index profiles_display_trgm on public.profiles using gin (display_name extensions.gin_trgm_ops);

-- Content shown on the profile page; readable only when the viewer may see the profile.
create table public.profile_details (
  id uuid primary key references public.profiles (id) on delete cascade,
  headline text check (headline is null or char_length(headline) <= 140),
  bio text check (bio is null or char_length(bio) <= 3000),
  meet text check (meet is null or char_length(meet) <= 2000),
  region text check (region is null or char_length(region) <= 60),
  interests text[] not null default '{}' check (cardinality(interests) <= 15),
  banner_url text check (banner_url is null or char_length(banner_url) <= 500),
  updated_at timestamptz not null default now()
);

-- Owner-only data.
create table public.profile_private (
  id uuid primary key references public.profiles (id) on delete cascade,
  birthdate date not null,
  created_at timestamptz not null default now()
);

create table public.profile_settings (
  id uuid primary key references public.profiles (id) on delete cascade,
  private_browsing boolean not null default false,
  notify_visits boolean not null default true,
  allow_nudges boolean not null default true,
  read_receipts boolean not null default true,
  share_profile_updates boolean not null default true,
  discover_feed boolean not null default false,
  potw_opt_in boolean not null default false,
  updated_at timestamptz not null default now()
);

create table public.friend_requests (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles (id) on delete cascade,
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (sender_id, recipient_id),
  check (sender_id <> recipient_id)
);
create index friend_requests_recipient on public.friend_requests (recipient_id, created_at desc);

-- One row per friendship, stored with user_a < user_b.
create table public.friendships (
  user_a uuid not null references public.profiles (id) on delete cascade,
  user_b uuid not null references public.profiles (id) on delete cascade,
  requested_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (user_a, user_b),
  check (user_a < user_b)
);
create index friendships_b on public.friendships (user_b);

create table public.blocks (
  blocker_id uuid not null references public.profiles (id) on delete cascade,
  blocked_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
create index blocks_blocked on public.blocks (blocked_id);

create table public.posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null default 'status'
    check (kind in ('status', 'photo', 'music', 'profile_update', 'friendship', 'blog')),
  body text check (body is null or char_length(body) <= 2000),
  mood text check (mood is null or char_length(mood) <= 40),
  visibility text not null default 'friends' check (visibility in ('friends', 'top', 'public')),
  media jsonb not null default '[]'::jsonb check (jsonb_typeof(media) = 'array' and jsonb_array_length(media) <= 6),
  meta jsonb not null default '{}'::jsonb check (jsonb_typeof(meta) = 'object'),
  repost_of uuid references public.posts (id) on delete cascade,
  hidden_at timestamptz,
  created_at timestamptz not null default now(),
  edited_at timestamptz,
  check (kind <> 'status' or repost_of is not null or char_length(btrim(coalesce(body, ''))) > 0)
);
create index posts_author_created on public.posts (author_id, created_at desc);
create index posts_public_created on public.posts (created_at desc) where visibility = 'public';
create index posts_repost_of on public.posts (repost_of);

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 1000),
  created_at timestamptz not null default now()
);
create index comments_post_created on public.comments (post_id, created_at);
create index comments_author on public.comments (author_id);

create table public.reactions (
  post_id uuid not null references public.posts (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null default 'like' check (kind in ('like')),
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);
create index reactions_user on public.reactions (user_id);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  actor_id uuid references public.profiles (id) on delete cascade,
  type text not null,
  entity_id uuid,
  data jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_created on public.notifications (user_id, created_at desc);
create index notifications_actor on public.notifications (actor_id);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid references public.profiles (id) on delete set null,
  target_type text not null check (target_type in ('profile', 'post', 'comment', 'guestbook', 'message', 'blog', 'bulletin', 'community')),
  target_id uuid not null,
  target_owner uuid references public.profiles (id) on delete set null,
  reason text not null check (reason in ('spam', 'harassment', 'hate', 'sexual', 'violence', 'self_harm', 'impersonation', 'underage', 'other')),
  details text check (details is null or char_length(details) <= 1000),
  status text not null default 'open' check (status in ('open', 'actioned', 'dismissed')),
  resolved_by uuid references public.profiles (id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);
create index reports_status_created on public.reports (status, created_at desc);
create index reports_reporter on public.reports (reporter_id);

create table public.moderators (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Private helper functions (used by policies)
-- ---------------------------------------------------------------------------

create or replace function app.are_friends(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select a is not null and b is not null and exists (
    select 1 from public.friendships f where f.user_a = least(a, b) and f.user_b = greatest(a, b));
$$;

create or replace function app.is_blocked(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select a is not null and b is not null and exists (
    select 1 from public.blocks k
    where (k.blocker_id = a and k.blocked_id = b) or (k.blocker_id = b and k.blocked_id = a));
$$;

create or replace function app.is_moderator(u uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select u is not null and exists (select 1 from public.moderators m where m.user_id = u);
$$;

create or replace function app.is_active(u uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles p where p.id = u and p.suspended_at is null);
$$;

-- May `viewer` see the full content of `owner`'s page?
create or replace function app.can_view_profile(viewer uuid, owner uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select case
    when viewer is not null and viewer = owner then true
    when app.is_moderator(viewer) then true
    when not app.is_active(owner) then false
    when app.is_blocked(viewer, owner) then false
    when (select p.is_private from public.profiles p where p.id = owner) then app.are_friends(viewer, owner)
    else true
  end;
$$;

-- Top friends are added in phase 2; this stays false until then.
create or replace function app.is_top_friend(owner uuid, viewer uuid) returns boolean
language sql stable security definer set search_path = '' as $$ select false; $$;

create or replace function app.can_view_post(viewer uuid, author uuid, vis text) returns boolean
language sql stable security definer set search_path = '' as $$
  select case
    when viewer is not null and viewer = author then true
    when app.is_moderator(viewer) then true
    when not app.is_active(author) then false
    when app.is_blocked(viewer, author) then false
    when vis = 'public' then not coalesce((select p.is_private from public.profiles p where p.id = author), true)
                             or app.are_friends(viewer, author)
    when vis = 'friends' then app.are_friends(viewer, author)
    when vis = 'top' then app.is_top_friend(author, viewer)
    else false
  end;
$$;

revoke all on all functions in schema app from public;
grant execute on all functions in schema app to anon, authenticated, service_role;

create or replace function app.touch_updated_at() returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at := now(); return new; end; $$;

create trigger profiles_touch before update on public.profiles for each row execute function app.touch_updated_at();
create trigger profile_details_touch before update on public.profile_details for each row execute function app.touch_updated_at();
create trigger profile_settings_touch before update on public.profile_settings for each row execute function app.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Signup: create the profile from sign-up metadata, enforce 18+ and username rules
-- ---------------------------------------------------------------------------

create or replace function app.reserved_usernames() returns text[] language sql immutable as $$
  select array['admin','administrator','afterhours','latenite','latenitesocial','support','help','moderator','mod','staff','system',
               'root','api','www','mail','settings','login','logout','signup','about','privacy','terms',
               'security','official','team','null','undefined','everyone','me','you'];
$$;

create or replace function app.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_username text := lower(btrim(coalesce(new.raw_user_meta_data ->> 'username', '')));
  v_display text := btrim(coalesce(new.raw_user_meta_data ->> 'display_name', ''));
  v_birth date;
begin
  begin
    v_birth := (new.raw_user_meta_data ->> 'birthdate')::date;
  exception when others then
    raise exception 'AH_INVALID_BIRTHDATE' using errcode = '22023';
  end;
  if v_birth is null or v_birth > (current_date - interval '18 years')::date or v_birth < date '1900-01-01' then
    raise exception 'AH_UNDERAGE' using errcode = '22023';
  end if;
  if v_username = any (app.reserved_usernames()) then
    raise exception 'AH_USERNAME_RESERVED' using errcode = '22023';
  end if;
  if v_display = '' then v_display := v_username; end if;

  insert into public.profiles (id, username, display_name) values (new.id, v_username, left(v_display, 40));
  insert into public.profile_details (id) values (new.id);
  insert into public.profile_private (id, birthdate) values (new.id, v_birth);
  insert into public.profile_settings (id) values (new.id);
  return new;
end; $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function app.handle_new_user();

-- ---------------------------------------------------------------------------
-- Notifications helper + triggers
-- ---------------------------------------------------------------------------

create or replace function app.notify(p_user uuid, p_actor uuid, p_type text, p_entity uuid, p_data jsonb default '{}'::jsonb)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_user is null or p_user = p_actor then return; end if;
  if app.is_blocked(p_user, p_actor) then return; end if;
  insert into public.notifications (user_id, actor_id, type, entity_id, data) values (p_user, p_actor, p_type, p_entity, p_data);
end; $$;

create or replace function app.on_friend_request() returns trigger language plpgsql security definer set search_path = '' as $$
begin perform app.notify(new.recipient_id, new.sender_id, 'friend_request', new.id); return new; end; $$;
create trigger friend_request_notify after insert on public.friend_requests for each row execute function app.on_friend_request();

create or replace function app.on_friendship() returns trigger language plpgsql security definer set search_path = '' as $$
declare v_other uuid;
begin
  if new.requested_by is not null then
    v_other := case when new.requested_by = new.user_a then new.user_b else new.user_a end;
    perform app.notify(new.requested_by, v_other, 'friend_accepted', null);
    -- feed item from the person who accepted, visible to their friends
    insert into public.posts (author_id, kind, visibility, meta)
    values (v_other, 'friendship', 'friends', jsonb_build_object('friend_id', new.requested_by));
  end if;
  return new;
end; $$;
create trigger friendship_created after insert on public.friendships for each row execute function app.on_friendship();

create or replace function app.on_comment() returns trigger language plpgsql security definer set search_path = '' as $$
declare v_author uuid;
begin
  select author_id into v_author from public.posts where id = new.post_id;
  perform app.notify(v_author, new.author_id, 'comment', new.post_id, jsonb_build_object('comment_id', new.id));
  return new;
end; $$;
create trigger comment_notify after insert on public.comments for each row execute function app.on_comment();

create or replace function app.on_reaction() returns trigger language plpgsql security definer set search_path = '' as $$
declare v_author uuid;
begin
  select author_id into v_author from public.posts where id = new.post_id;
  -- one "liked your post" notification per liker per post
  if not exists (select 1 from public.notifications n where n.user_id = v_author and n.actor_id = new.user_id
                 and n.type = 'like' and n.entity_id = new.post_id) then
    perform app.notify(v_author, new.user_id, 'like', new.post_id);
  end if;
  return new;
end; $$;
create trigger reaction_notify after insert on public.reactions for each row execute function app.on_reaction();

-- Blocking someone ends the friendship and any pending requests.
create or replace function app.on_block() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  delete from public.friendships where user_a = least(new.blocker_id, new.blocked_id) and user_b = greatest(new.blocker_id, new.blocked_id);
  delete from public.friend_requests where (sender_id = new.blocker_id and recipient_id = new.blocked_id)
                                       or (sender_id = new.blocked_id and recipient_id = new.blocker_id);
  return new;
end; $$;
create trigger block_cleanup after insert on public.blocks for each row execute function app.on_block();

-- Comments/likes are only allowed on posts the user can see, and never across a block.
create or replace function app.check_interaction() returns trigger language plpgsql security definer set search_path = '' as $$
declare v_author uuid; v_vis text; v_actor uuid;
begin
  v_actor := coalesce((to_jsonb(new) ->> 'author_id'), (to_jsonb(new) ->> 'user_id'))::uuid;
  select author_id, visibility into v_author, v_vis from public.posts where id = new.post_id and hidden_at is null;
  if v_author is null or not app.can_view_post(v_actor, v_author, v_vis) then
    raise exception 'AH_NOT_ALLOWED' using errcode = '42501';
  end if;
  return new;
end; $$;
create trigger comments_check before insert on public.comments for each row execute function app.check_interaction();
create trigger reactions_check before insert on public.reactions for each row execute function app.check_interaction();

-- Simple rate limit for posting.
create or replace function app.check_post_rate() returns trigger language plpgsql security definer set search_path = '' as $$
declare v_author uuid; v_vis text;
begin
  if new.repost_of is not null then
    select author_id, visibility into v_author, v_vis from public.posts where id = new.repost_of and hidden_at is null;
    if v_author is null or not app.can_view_post(new.author_id, v_author, v_vis) then
      raise exception 'AH_NOT_ALLOWED' using errcode = '42501';
    end if;
  end if;
  if new.kind in ('status', 'photo', 'music') and
     (select count(*) from public.posts where author_id = new.author_id and created_at > now() - interval '1 hour') >= 60 then
    raise exception 'AH_RATE_LIMIT' using errcode = 'P0001';
  end if;
  return new;
end; $$;
create trigger posts_rate before insert on public.posts for each row execute function app.check_post_rate();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
revoke all on public.profiles from anon, authenticated;
alter table public.profile_details enable row level security;
revoke all on public.profile_details from anon, authenticated;
alter table public.profile_private enable row level security;
revoke all on public.profile_private from anon, authenticated;
alter table public.profile_settings enable row level security;
revoke all on public.profile_settings from anon, authenticated;
alter table public.friend_requests enable row level security;
revoke all on public.friend_requests from anon, authenticated;
alter table public.friendships enable row level security;
revoke all on public.friendships from anon, authenticated;
alter table public.blocks enable row level security;
revoke all on public.blocks from anon, authenticated;
alter table public.posts enable row level security;
revoke all on public.posts from anon, authenticated;
alter table public.comments enable row level security;
revoke all on public.comments from anon, authenticated;
alter table public.reactions enable row level security;
revoke all on public.reactions from anon, authenticated;
alter table public.notifications enable row level security;
revoke all on public.notifications from anon, authenticated;
alter table public.reports enable row level security;
revoke all on public.reports from anon, authenticated;
alter table public.moderators enable row level security;
revoke all on public.moderators from anon, authenticated;

revoke all on all tables in schema public from anon, authenticated;

-- profiles: the card (name, avatar, mood) is visible to everyone except across a block.
create policy profiles_select on public.profiles for select to anon, authenticated
  using ((suspended_at is null or id = (select auth.uid()) or app.is_moderator((select auth.uid())))
         and not app.is_blocked((select auth.uid()), id));
create policy profiles_update on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));
grant select on public.profiles to anon, authenticated;
grant update (display_name, avatar_url, mood, mood_color, is_private, discoverable) on public.profiles to authenticated;

create policy details_select on public.profile_details for select to anon, authenticated
  using (app.can_view_profile((select auth.uid()), id));
create policy details_update on public.profile_details for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));
grant select on public.profile_details to anon, authenticated;
grant update (headline, bio, meet, region, interests, banner_url) on public.profile_details to authenticated;

create policy private_select on public.profile_private for select to authenticated using (id = (select auth.uid()));
grant select on public.profile_private to authenticated;

create policy settings_select on public.profile_settings for select to authenticated using (id = (select auth.uid()));
create policy settings_update on public.profile_settings for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));
grant select on public.profile_settings to authenticated;
grant update (private_browsing, notify_visits, allow_nudges, read_receipts, share_profile_updates, discover_feed, potw_opt_in)
  on public.profile_settings to authenticated;

-- friend requests: only the two people involved; all changes go through RPCs.
create policy fr_select on public.friend_requests for select to authenticated
  using (sender_id = (select auth.uid()) or recipient_id = (select auth.uid()));
grant select on public.friend_requests to authenticated;

-- friendships: members see their own; others see them when both pages are viewable.
create policy fs_select on public.friendships for select to anon, authenticated
  using ((select auth.uid()) in (user_a, user_b)
         or (app.can_view_profile((select auth.uid()), user_a) and app.can_view_profile((select auth.uid()), user_b)));
grant select on public.friendships to anon, authenticated;

create policy blocks_select on public.blocks for select to authenticated using (blocker_id = (select auth.uid()));
create policy blocks_insert on public.blocks for insert to authenticated with check (blocker_id = (select auth.uid()));
create policy blocks_delete on public.blocks for delete to authenticated using (blocker_id = (select auth.uid()));
grant select, insert, delete on public.blocks to authenticated;

create policy posts_select on public.posts for select to anon, authenticated
  using ((hidden_at is null or author_id = (select auth.uid()) or app.is_moderator((select auth.uid())))
         and app.can_view_post((select auth.uid()), author_id, visibility));
create policy posts_insert on public.posts for insert to authenticated
  with check (author_id = (select auth.uid()) and kind in ('status', 'photo', 'music') and app.is_active(author_id));
create policy posts_update on public.posts for update to authenticated
  using (author_id = (select auth.uid())) with check (author_id = (select auth.uid()));
create policy posts_delete on public.posts for delete to authenticated
  using (author_id = (select auth.uid()) or app.is_moderator((select auth.uid())));
grant select on public.posts to anon, authenticated;
grant insert (author_id, kind, body, mood, visibility, media, meta, repost_of) on public.posts to authenticated;
grant update (body, mood, visibility, edited_at) on public.posts to authenticated;
grant delete on public.posts to authenticated;

create policy comments_select on public.comments for select to anon, authenticated
  using (exists (select 1 from public.posts p where p.id = post_id) and not app.is_blocked((select auth.uid()), author_id));
create policy comments_insert on public.comments for insert to authenticated
  with check (author_id = (select auth.uid()) and app.is_active(author_id));
create policy comments_delete on public.comments for delete to authenticated
  using (author_id = (select auth.uid())
         or exists (select 1 from public.posts p where p.id = post_id and p.author_id = (select auth.uid()))
         or app.is_moderator((select auth.uid())));
grant select on public.comments to anon, authenticated;
grant insert (post_id, author_id, body) on public.comments to authenticated;
grant delete on public.comments to authenticated;

create policy reactions_select on public.reactions for select to anon, authenticated
  using (exists (select 1 from public.posts p where p.id = post_id));
create policy reactions_insert on public.reactions for insert to authenticated with check (user_id = (select auth.uid()));
create policy reactions_delete on public.reactions for delete to authenticated using (user_id = (select auth.uid()));
grant select on public.reactions to anon, authenticated;
grant insert (post_id, user_id, kind) on public.reactions to authenticated;
grant delete on public.reactions to authenticated;

create policy notif_select on public.notifications for select to authenticated using (user_id = (select auth.uid()));
create policy notif_update on public.notifications for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy notif_delete on public.notifications for delete to authenticated using (user_id = (select auth.uid()));
grant select, delete on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;

create policy reports_insert on public.reports for insert to authenticated with check (reporter_id = (select auth.uid()));
create policy reports_select on public.reports for select to authenticated
  using (reporter_id = (select auth.uid()) or app.is_moderator((select auth.uid())));
grant select on public.reports to authenticated;
grant insert (reporter_id, target_type, target_id, target_owner, reason, details) on public.reports to authenticated;

create policy moderators_select on public.moderators for select to authenticated using (user_id = (select auth.uid()));
grant select on public.moderators to authenticated;

-- ---------------------------------------------------------------------------
-- RPCs (public schema = callable through the Data API)
-- ---------------------------------------------------------------------------

create or replace function public.username_available(p_username text) returns boolean
language sql stable security definer set search_path = '' as $$
  select lower(btrim(p_username)) ~ '^[a-z0-9._]{3,20}$'
     and lower(btrim(p_username)) !~ '^[._]|[._]$|\.\.'
     and not (lower(btrim(p_username)) = any (app.reserved_usernames()))
     and not exists (select 1 from public.profiles where username = lower(btrim(p_username))::extensions.citext);
$$;

create or replace function public.send_friend_request(p_target uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare v_me uuid := auth.uid(); v_req uuid;
begin
  if v_me is null then raise exception 'AH_AUTH' using errcode = '42501'; end if;
  if p_target is null or p_target = v_me then raise exception 'AH_BAD_TARGET' using errcode = '22023'; end if;
  if not app.is_active(p_target) or not app.is_active(v_me) or app.is_blocked(v_me, p_target) then
    raise exception 'AH_NOT_ALLOWED' using errcode = '42501';
  end if;
  if app.are_friends(v_me, p_target) then return 'already_friends'; end if;
  -- they already asked me: accept instead
  select id into v_req from public.friend_requests where sender_id = p_target and recipient_id = v_me;
  if v_req is not null then
    delete from public.friend_requests where id = v_req;
    insert into public.friendships (user_a, user_b, requested_by) values (least(v_me, p_target), greatest(v_me, p_target), p_target)
      on conflict do nothing;
    return 'accepted';
  end if;
  if exists (select 1 from public.friend_requests where sender_id = v_me and recipient_id = p_target) then return 'pending'; end if;
  if (select count(*) from public.friend_requests where sender_id = v_me and created_at > now() - interval '1 day') >= 50 then
    raise exception 'AH_RATE_LIMIT' using errcode = 'P0001';
  end if;
  insert into public.friend_requests (sender_id, recipient_id) values (v_me, p_target);
  return 'sent';
end; $$;

create or replace function public.respond_friend_request(p_request uuid, p_accept boolean) returns text
language plpgsql security definer set search_path = '' as $$
declare v_me uuid := auth.uid(); r public.friend_requests;
begin
  select * into r from public.friend_requests where id = p_request and recipient_id = v_me;
  if r.id is null then raise exception 'AH_NOT_FOUND' using errcode = 'P0002'; end if;
  delete from public.friend_requests where id = r.id;
  if p_accept then
    if app.is_blocked(v_me, r.sender_id) or not app.is_active(r.sender_id) then return 'gone'; end if;
    insert into public.friendships (user_a, user_b, requested_by)
      values (least(v_me, r.sender_id), greatest(v_me, r.sender_id), r.sender_id) on conflict do nothing;
    delete from public.notifications where user_id = v_me and type = 'friend_request' and entity_id = r.id;
    return 'accepted';
  end if;
  delete from public.notifications where user_id = v_me and type = 'friend_request' and entity_id = r.id;
  return 'declined';
end; $$;

create or replace function public.cancel_friend_request(p_target uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  delete from public.friend_requests where sender_id = auth.uid() and recipient_id = p_target returning id into v_id;
  if v_id is not null then delete from public.notifications where type = 'friend_request' and entity_id = v_id; end if;
end; $$;

create or replace function public.unfriend(p_other uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.friendships where user_a = least(auth.uid(), p_other) and user_b = greatest(auth.uid(), p_other);
end; $$;

-- Friend IDs of the current user.
create or replace function app.my_friend_ids() returns setof uuid
language sql stable security definer set search_path = '' as $$
  select case when f.user_a = auth.uid() then f.user_b else f.user_a end
  from public.friendships f where auth.uid() in (f.user_a, f.user_b);
$$;
grant execute on function app.my_friend_ids() to authenticated;

-- Chronological friends feed (you + your friends, newest first). RLS still applies to every row.
create or replace function public.friend_feed(p_before timestamptz default null, p_limit int default 20)
returns setof public.posts language sql stable security invoker set search_path = '' as $$
  select p.* from public.posts p
  where (p.author_id = auth.uid() or p.author_id in (select app.my_friend_ids()))
    and p.created_at < coalesce(p_before, 'infinity'::timestamptz)
  order by p.created_at desc
  limit least(greatest(coalesce(p_limit, 20), 1), 50);
$$;

-- Friend list of any user (respecting visibility), with display info.
create or replace function public.friends_of(p_user uuid, p_limit int default 200)
returns table (id uuid, username text, display_name text, avatar_url text, mood text, since timestamptz)
language sql stable security invoker set search_path = '' as $$
  select p.id, p.username::text, p.display_name, p.avatar_url, p.mood, f.created_at
  from public.friendships f
  join public.profiles p on p.id = case when f.user_a = p_user then f.user_b else f.user_a end
  where p_user in (f.user_a, f.user_b)
  order by f.created_at desc
  limit least(coalesce(p_limit, 200), 500);
$$;

create or replace function public.mutual_friend_count(p_other uuid) returns int
language sql stable security definer set search_path = '' as $$
  select count(*)::int from (
    select case when f.user_a = p_other then f.user_b else f.user_a end as fid
    from public.friendships f where p_other in (f.user_a, f.user_b)
  ) t where t.fid in (select app.my_friend_ids()) and auth.uid() is not null;
$$;

revoke execute on all functions in schema public from public, anon;
grant execute on function public.username_available(text) to anon, authenticated;
grant execute on function public.send_friend_request(uuid), public.respond_friend_request(uuid, boolean),
  public.cancel_friend_request(uuid), public.unfriend(uuid), public.friend_feed(timestamptz, int),
  public.mutual_friend_count(uuid) to authenticated;
grant execute on function public.friends_of(uuid, int) to anon, authenticated;

-- People I've blocked (their profile rows are hidden from me by RLS, so this returns just enough to unblock).
create or replace function public.my_blocked_users() returns table (id uuid, username text, display_name text)
language sql stable security definer set search_path = '' as $$
  select p.id, p.username::text, p.display_name from public.blocks b join public.profiles p on p.id = b.blocked_id
  where b.blocker_id = auth.uid() order by b.created_at desc;
$$;
revoke execute on function public.my_blocked_users() from public, anon;
grant execute on function public.my_blocked_users() to authenticated;
