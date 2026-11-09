-- LateNite — Phase 2: themes & layout, profile music, Top Friends, guestbook, profile visitors, theme history.

-- ---------------------------------------------------------------------------
-- Validation helpers (run inside CHECK constraints)
-- ---------------------------------------------------------------------------

create or replace function app.is_hex(v jsonb) returns boolean language sql immutable as $$
  select v is null or (jsonb_typeof(v) = 'string' and (v #>> '{}') ~ '^#[0-9a-fA-F]{6}$');
$$;

-- A theme is a small set of tokens. Nothing in it is ever executed or injected as raw CSS.
create or replace function app.valid_theme(t jsonb) returns boolean language sql immutable as $$
  select jsonb_typeof(t) = 'object'
    and not exists (select 1 from jsonb_object_keys(t) k
                    where k not in ('preset', 'page', 'card', 'text', 'muted', 'line', 'accent', 'on_accent', 'banner_a', 'banner_b',
                                    'pattern', 'font', 'bg_image', 'radius', 'shadow'))
    and app.is_hex(t -> 'page') and app.is_hex(t -> 'card') and app.is_hex(t -> 'text') and app.is_hex(t -> 'muted')
    and app.is_hex(t -> 'line') and app.is_hex(t -> 'accent') and app.is_hex(t -> 'on_accent')
    and app.is_hex(t -> 'banner_a') and app.is_hex(t -> 'banner_b')
    and coalesce(t ->> 'pattern', 'dots') in ('none', 'dots', 'grid', 'stripes', 'checker', 'scanlines', 'stars', 'hearts')
    and coalesce(t ->> 'font', 'bold') in ('bold', 'serif', 'pixel', 'mono', 'round')
    and coalesce(t ->> 'preset', 'midnight') ~ '^[a-z0-9_-]{1,30}$'
    and coalesce(t ->> 'radius', 'none') in ('none', 'soft', 'round')
    and coalesce(t ->> 'shadow', 'hard') in ('none', 'hard', 'glow')
    and (t -> 'bg_image' is null or jsonb_typeof(t -> 'bg_image') = 'null'
         or ((t ->> 'bg_image') ~ '^https?://[^\s"''()<>\\]+$' and char_length(t ->> 'bg_image') <= 500));
$$;

create or replace function app.valid_layout(l jsonb) returns boolean language sql immutable as $$
  select jsonb_typeof(l) = 'array' and jsonb_array_length(l) <= 12
    and not exists (select 1 from jsonb_array_elements(l) e
                    where jsonb_typeof(e) <> 'string' or (e #>> '{}') not in ('top', 'about', 'guestbook', 'posts', 'friends', 'blog', 'gifts', 'poll'))
    and (select count(*) = count(distinct e) from jsonb_array_elements_text(l) e);
$$;

create or replace function app.valid_music(m jsonb) returns boolean language sql immutable as $$
  select m is null or jsonb_typeof(m) = 'null' or (
    jsonb_typeof(m) = 'object'
    and not exists (select 1 from jsonb_object_keys(m) k where k not in ('provider', 'url', 'title', 'artist', 'art'))
    and (m ->> 'provider') in ('spotify', 'youtube', 'apple', 'soundcloud')
    and char_length(m ->> 'url') <= 500
    and (m ->> 'url') ~ '^https://(open\.spotify\.com|(www\.|m\.|music\.)?youtube\.com|youtu\.be|music\.apple\.com|(m\.)?soundcloud\.com)/[^\s"''<>\\]*$'
    and coalesce(char_length(m ->> 'title'), 0) <= 100 and coalesce(char_length(m ->> 'artist'), 0) <= 100
    and (m -> 'art' is null or jsonb_typeof(m -> 'art') = 'null' or ((m ->> 'art') ~ '^https://[^\s"''()<>\\]+$' and char_length(m ->> 'art') <= 500)));
$$;

-- ---------------------------------------------------------------------------
-- Profile page columns
-- ---------------------------------------------------------------------------

alter table public.profile_details
  add column theme jsonb not null default '{"preset":"midnight"}'::jsonb check (app.valid_theme(theme)),
  add column layout jsonb not null default '["top","about","guestbook","posts"]'::jsonb check (app.valid_layout(layout)),
  add column top_count smallint not null default 8 check (top_count in (4, 8, 12, 16)),
  add column top_hidden boolean not null default false,
  add column music jsonb check (app.valid_music(music)),
  add column guestbook_policy text not null default 'friends' check (guestbook_policy in ('friends', 'everyone', 'off')),
  add column view_count bigint not null default 0;

grant update (theme, layout, top_count, top_hidden, music, guestbook_policy) on public.profile_details to authenticated;

-- Past looks, for Memories.
create table public.theme_history (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  theme jsonb not null,
  music jsonb,
  changed_at timestamptz not null default now()
);
create index theme_history_owner on public.theme_history (owner_id, changed_at desc);
alter table public.theme_history enable row level security;
revoke all on public.theme_history from anon, authenticated;
create policy th_select on public.theme_history for select to authenticated using (owner_id = (select auth.uid()));
create policy th_delete on public.theme_history for delete to authenticated using (owner_id = (select auth.uid()));
grant select, delete on public.theme_history to authenticated;

create or replace function app.on_details_change() returns trigger language plpgsql security definer set search_path = '' as $$
declare v_share boolean; v_recent boolean;
begin
  if new.theme is distinct from old.theme or new.music is distinct from old.music then
    -- keep at most one history row per 10 minutes so live-editing doesn't flood Memories
    if not exists (select 1 from public.theme_history h where h.owner_id = new.id and h.changed_at > now() - interval '10 minutes') then
      insert into public.theme_history (owner_id, theme, music) values (new.id, old.theme, old.music);
    end if;
  end if;
  select share_profile_updates into v_share from public.profile_settings where id = new.id;
  if coalesce(v_share, false) then
    if new.music is distinct from old.music and new.music is not null and jsonb_typeof(new.music) = 'object' then
      delete from public.posts where author_id = new.id and kind = 'profile_update' and meta ->> 'what' = 'music' and created_at > now() - interval '6 hours';
      insert into public.posts (author_id, kind, visibility, meta)
      values (new.id, 'profile_update', 'friends', jsonb_build_object('what', 'music', 'text', 'changed their profile song') || new.music);
    elsif new.theme is distinct from old.theme then
      select exists (select 1 from public.posts where author_id = new.id and kind = 'profile_update' and meta ->> 'what' = 'theme'
                     and created_at > now() - interval '6 hours') into v_recent;
      if not v_recent then
        insert into public.posts (author_id, kind, visibility, meta)
        values (new.id, 'profile_update', 'friends', jsonb_build_object('what', 'theme', 'text', 'gave their page a new look'));
      end if;
    end if;
  end if;
  return new;
end; $$;
create trigger details_change after update on public.profile_details for each row execute function app.on_details_change();

-- ---------------------------------------------------------------------------
-- Top Friends
-- ---------------------------------------------------------------------------

create table public.top_friends (
  owner_id uuid not null references public.profiles (id) on delete cascade,
  friend_id uuid not null references public.profiles (id) on delete cascade,
  rank smallint not null check (rank between 1 and 16),
  created_at timestamptz not null default now(),
  primary key (owner_id, friend_id),
  unique (owner_id, rank)
);
create index top_friends_friend on public.top_friends (friend_id);
alter table public.top_friends enable row level security;
revoke all on public.top_friends from anon, authenticated;
create policy tf_select on public.top_friends for select to authenticated using (owner_id = (select auth.uid()));
grant select on public.top_friends to authenticated;

create or replace function app.is_top_friend(owner uuid, viewer uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select viewer is not null and exists (select 1 from public.top_friends t where t.owner_id = owner and t.friend_id = viewer)
     and app.are_friends(owner, viewer);
$$;

-- Replace my Top Friends with this ordered list (friends only, max 16).
create or replace function public.set_top_friends(p_ids uuid[]) returns void
language plpgsql security definer set search_path = '' as $$
declare v_me uuid := auth.uid(); v_id uuid; i int := 0; v_old uuid[];
begin
  if v_me is null then raise exception 'AH_AUTH' using errcode = '42501'; end if;
  p_ids := coalesce(p_ids, '{}');
  if cardinality(p_ids) > 16 then raise exception 'AH_BAD_TARGET' using errcode = '22023'; end if;
  if (select count(distinct x) from unnest(p_ids) x) <> cardinality(p_ids) then raise exception 'AH_BAD_TARGET' using errcode = '22023'; end if;
  foreach v_id in array p_ids loop
    if not app.are_friends(v_me, v_id) then raise exception 'AH_NOT_FRIENDS' using errcode = '42501'; end if;
  end loop;
  select coalesce(array_agg(friend_id), '{}') into v_old from public.top_friends where owner_id = v_me;
  delete from public.top_friends where owner_id = v_me;
  foreach v_id in array p_ids loop
    i := i + 1;
    insert into public.top_friends (owner_id, friend_id, rank) values (v_me, v_id, i);
    if not (v_id = any (v_old)) then
      perform app.notify(v_id, v_me, 'top_friend', null,
        jsonb_build_object('count', (select top_count from public.profile_details where id = v_me)));
    end if;
  end loop;
end; $$;

-- Top Friends as a visitor sees them. When the owner hides the order, ranks are not returned and the list is A–Z.
create or replace function public.get_top_friends(p_owner uuid)
returns table (rank int, id uuid, username text, display_name text, avatar_url text, mood text)
language sql stable security definer set search_path = '' as $$
  with d as (select top_count, top_hidden from public.profile_details where id = p_owner)
  select case when (select top_hidden from d) and auth.uid() is distinct from p_owner then null else t.rank::int end,
         p.id, p.username::text, p.display_name, p.avatar_url, p.mood
  from public.top_friends t join public.profiles p on p.id = t.friend_id
  where t.owner_id = p_owner
    and app.can_view_profile(auth.uid(), p_owner)
    and p.suspended_at is null and not app.is_blocked(auth.uid(), p.id)
    and t.rank <= (select top_count from d)
  order by case when (select top_hidden from d) and auth.uid() is distinct from p_owner then null else t.rank end nulls last, p.username;
$$;

-- Friendship ends -> drop from each other's Top Friends.
create or replace function app.on_unfriend() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  delete from public.top_friends where (owner_id = old.user_a and friend_id = old.user_b) or (owner_id = old.user_b and friend_id = old.user_a);
  return old;
end; $$;
create trigger friendship_removed after delete on public.friendships for each row execute function app.on_unfriend();

-- ---------------------------------------------------------------------------
-- Guestbook
-- ---------------------------------------------------------------------------

create table public.guestbook_entries (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  parent_id uuid references public.guestbook_entries (id) on delete cascade,
  body text check (body is null or char_length(body) <= 1000),
  sticker text check (sticker is null or sticker in ('glitter', 'star', 'heart', 'fire', 'skull', 'sparkle', 'rainbow', 'music', 'crown', 'ghost')),
  image_url text check (image_url is null or (char_length(image_url) <= 500 and image_url ~ '^https?://[^\s"''<>\\]+$')),
  hidden_at timestamptz,
  created_at timestamptz not null default now(),
  check (char_length(btrim(coalesce(body, ''))) > 0 or sticker is not null or image_url is not null)
);
create index guestbook_profile_created on public.guestbook_entries (profile_id, created_at desc);
create index guestbook_author on public.guestbook_entries (author_id);
create index guestbook_parent on public.guestbook_entries (parent_id);

create table public.guestbook_reactions (
  entry_id uuid not null references public.guestbook_entries (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (entry_id, user_id)
);
create index guestbook_reactions_user on public.guestbook_reactions (user_id);

create or replace function app.can_sign_guestbook(viewer uuid, owner uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select viewer is not null and app.is_active(viewer) and app.can_view_profile(viewer, owner) and not app.is_blocked(viewer, owner)
    and (viewer = owner or case (select guestbook_policy from public.profile_details where id = owner)
                            when 'everyone' then true when 'friends' then app.are_friends(viewer, owner) else false end);
$$;

create or replace function app.on_guestbook() returns trigger language plpgsql security definer set search_path = '' as $$
declare v_parent_author uuid; v_parent_profile uuid;
begin
  if tg_op = 'INSERT' then
    if (select count(*) from public.guestbook_entries where author_id = new.author_id and created_at > now() - interval '1 hour') >= 30 then
      raise exception 'AH_RATE_LIMIT' using errcode = 'P0001';
    end if;
    if new.parent_id is not null then
      select author_id, profile_id into v_parent_author, v_parent_profile from public.guestbook_entries where id = new.parent_id;
      if v_parent_profile is distinct from new.profile_id then raise exception 'AH_BAD_TARGET' using errcode = '22023'; end if;
    end if;
  end if;
  return new;
end; $$;
create trigger guestbook_check before insert on public.guestbook_entries for each row execute function app.on_guestbook();

create or replace function app.after_guestbook() returns trigger language plpgsql security definer set search_path = '' as $$
declare v_parent_author uuid; v_username text;
begin
  select username::text into v_username from public.profiles where id = new.profile_id;
  if new.parent_id is null then
    perform app.notify(new.profile_id, new.author_id, 'guestbook', new.id);
  else
    select author_id into v_parent_author from public.guestbook_entries where id = new.parent_id;
    perform app.notify(v_parent_author, new.author_id, 'guestbook_reply', new.id, jsonb_build_object('profile', v_username));
    if v_parent_author <> new.profile_id then
      perform app.notify(new.profile_id, new.author_id, 'guestbook_reply', new.id, jsonb_build_object('profile', v_username));
    end if;
  end if;
  return new;
end; $$;
create trigger guestbook_notify after insert on public.guestbook_entries for each row execute function app.after_guestbook();

alter table public.guestbook_entries enable row level security;
revoke all on public.guestbook_entries from anon, authenticated;
alter table public.guestbook_reactions enable row level security;
revoke all on public.guestbook_reactions from anon, authenticated;

create policy gb_select on public.guestbook_entries for select to anon, authenticated
  using (app.can_view_profile((select auth.uid()), profile_id)
         and not app.is_blocked((select auth.uid()), author_id)
         and app.is_active(author_id)
         and (hidden_at is null or (select auth.uid()) in (profile_id, author_id) or app.is_moderator((select auth.uid()))));
create policy gb_insert on public.guestbook_entries for insert to authenticated
  with check (author_id = (select auth.uid()) and hidden_at is null and app.can_sign_guestbook((select auth.uid()), profile_id));
create policy gb_update on public.guestbook_entries for update to authenticated
  using (profile_id = (select auth.uid()) or app.is_moderator((select auth.uid())))
  with check (profile_id = (select auth.uid()) or app.is_moderator((select auth.uid())));
create policy gb_delete on public.guestbook_entries for delete to authenticated
  using ((select auth.uid()) in (profile_id, author_id) or app.is_moderator((select auth.uid())));
grant select on public.guestbook_entries to anon, authenticated;
grant insert (profile_id, author_id, parent_id, body, sticker, image_url) on public.guestbook_entries to authenticated;
grant update (hidden_at) on public.guestbook_entries to authenticated;
grant delete on public.guestbook_entries to authenticated;

create policy gbr_select on public.guestbook_reactions for select to anon, authenticated
  using (exists (select 1 from public.guestbook_entries e where e.id = entry_id));
create policy gbr_insert on public.guestbook_reactions for insert to authenticated
  with check (user_id = (select auth.uid()) and exists (select 1 from public.guestbook_entries e where e.id = entry_id));
create policy gbr_delete on public.guestbook_reactions for delete to authenticated using (user_id = (select auth.uid()));
grant select on public.guestbook_reactions to anon, authenticated;
grant insert (entry_id, user_id) on public.guestbook_reactions to authenticated;
grant delete on public.guestbook_reactions to authenticated;

-- ---------------------------------------------------------------------------
-- Profile visitors (reciprocal privacy)
-- ---------------------------------------------------------------------------

create table public.profile_visits (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  visitor_id uuid not null references public.profiles (id) on delete cascade,
  visited_on date not null default current_date,
  visited_at timestamptz not null default now(),
  primary key (profile_id, visitor_id, visited_on)
);
create index profile_visits_recent on public.profile_visits (profile_id, visited_at desc);
create index profile_visits_visitor on public.profile_visits (visitor_id);
alter table public.profile_visits enable row level security;
revoke all on public.profile_visits from anon, authenticated;
-- No direct access at all: recording and reading go through the functions below.

create or replace function app.browsing_privately(u uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select private_browsing from public.profile_settings where id = u), false);
$$;

create or replace function public.record_visit(p_profile uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v_me uuid := auth.uid(); v_new boolean;
begin
  if v_me is null or v_me = p_profile or app.browsing_privately(v_me) or not app.can_view_profile(v_me, p_profile)
     or app.is_moderator(v_me) or not app.is_active(v_me) then
    return;
  end if;
  insert into public.profile_visits (profile_id, visitor_id) values (p_profile, v_me)
  on conflict (profile_id, visitor_id, visited_on) do update set visited_at = now()
  returning (xmax = 0) into v_new;
  if v_new then
    update public.profile_details set view_count = view_count + 1 where id = p_profile;
    if coalesce((select notify_visits from public.profile_settings where id = p_profile), false)
       and not app.browsing_privately(p_profile) then
      perform app.notify(p_profile, v_me, 'visit', null);
    end if;
  end if;
end; $$;

-- My recent visitors. Empty while I browse privately: same rule for everyone.
create or replace function public.my_visitors(p_limit int default 12)
returns table (id uuid, username text, display_name text, avatar_url text, visited_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select p.id, p.username::text, p.display_name, p.avatar_url, max(v.visited_at)
  from public.profile_visits v join public.profiles p on p.id = v.visitor_id
  where v.profile_id = auth.uid() and not app.browsing_privately(auth.uid())
    and p.suspended_at is null and not app.is_blocked(auth.uid(), p.id)
  group by p.id
  order by max(v.visited_at) desc
  limit least(coalesce(p_limit, 12), 50);
$$;

create or replace function public.visit_stats(p_profile uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select case when not app.can_view_profile(auth.uid(), p_profile) then null else jsonb_build_object(
    'total', (select view_count from public.profile_details where id = p_profile),
    'week', case when auth.uid() = p_profile then
              (select count(*) from public.profile_visits where profile_id = p_profile and visited_at > now() - interval '7 days') end) end;
$$;

-- Visit notifications: at most one per visitor per day (handled by the daily key above).

revoke execute on all functions in schema public from public, anon;
grant execute on function public.username_available(text), public.friends_of(uuid, int), public.get_top_friends(uuid), public.visit_stats(uuid) to anon, authenticated;
grant execute on function public.set_top_friends(uuid[]), public.record_visit(uuid), public.my_visitors(int) to authenticated;
revoke all on all functions in schema app from public;
grant execute on all functions in schema app to anon, authenticated, service_role;
