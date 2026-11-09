-- LateNite — Phase 4: blogs, bulletins, polls, communities, theme gallery, gifts, badges, discovery, Profile of the Week.

-- ---------------------------------------------------------------------------
-- Blogs (body is Tiptap JSON; HTML is generated + sanitized on the server at render time)
-- ---------------------------------------------------------------------------

alter table public.profile_details add column blog_title text check (blog_title is null or char_length(blog_title) <= 60);
grant update (blog_title) on public.profile_details to authenticated;

create table public.blog_posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles (id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 140),
  slug text not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 80),
  body jsonb not null default '{"type":"doc","content":[]}'::jsonb check (jsonb_typeof(body) = 'object' and pg_column_size(body) < 300000),
  excerpt text check (excerpt is null or char_length(excerpt) <= 300),
  cover_url text check (cover_url is null or (char_length(cover_url) <= 500 and cover_url ~ '^https?://[^\s"''<>\\]+$')),
  status text not null default 'draft' check (status in ('draft', 'published')),
  visibility text not null default 'friends' check (visibility in ('friends', 'public', 'private')),
  post_id uuid references public.posts (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz,
  unique (author_id, slug)
);
create index blog_posts_author on public.blog_posts (author_id, published_at desc nulls last);
create trigger blog_touch before update on public.blog_posts for each row execute function app.touch_updated_at();

alter table public.blog_posts enable row level security;
revoke all on public.blog_posts from anon, authenticated;
create policy blog_select on public.blog_posts for select to anon, authenticated
  using (author_id = (select auth.uid())
         or (status = 'published' and visibility <> 'private' and app.can_view_post((select auth.uid()), author_id, visibility)));
create policy blog_insert on public.blog_posts for insert to authenticated with check (author_id = (select auth.uid()) and app.is_active(author_id));
create policy blog_update on public.blog_posts for update to authenticated using (author_id = (select auth.uid())) with check (author_id = (select auth.uid()));
create policy blog_delete on public.blog_posts for delete to authenticated using (author_id = (select auth.uid()) or app.is_moderator((select auth.uid())));
grant select on public.blog_posts to anon, authenticated;
grant insert (author_id, title, slug, body, excerpt, cover_url, status, visibility) on public.blog_posts to authenticated;
grant update (title, slug, body, excerpt, cover_url, status, visibility) on public.blog_posts to authenticated;
grant delete on public.blog_posts to authenticated;

-- Publishing puts a card in friends' feeds (comments + likes live on that feed post).
create or replace function app.on_blog() returns trigger language plpgsql security definer set search_path = '' as $$
declare v_post uuid; v_user text;
begin
  if new.status = 'published' and new.published_at is null then new.published_at := now(); end if;
  select username::text into v_user from public.profiles where id = new.author_id;
  if new.status = 'published' and new.visibility <> 'private' then
    if new.post_id is null then
      insert into public.posts (author_id, kind, visibility, meta)
      values (new.author_id, 'blog', new.visibility, jsonb_build_object('title', new.title, 'slug', new.slug, 'excerpt', new.excerpt, 'username', v_user, 'blog_post_id', new.id))
      returning id into v_post;
      new.post_id := v_post;
    else
      update public.posts set visibility = new.visibility,
        meta = jsonb_build_object('title', new.title, 'slug', new.slug, 'excerpt', new.excerpt, 'username', v_user, 'blog_post_id', new.id)
      where id = new.post_id;
    end if;
  else
    new.post_id := null; -- the old feed card is removed by the AFTER trigger below
  end if;
  return new;
end; $$;
create or replace function app.after_blog() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    if old.post_id is not null then delete from public.posts where id = old.post_id; end if;
  elsif old.post_id is not null and new.post_id is distinct from old.post_id then
    delete from public.posts where id = old.post_id;
  end if;
  return null;
end; $$;
create trigger blog_publish before insert or update on public.blog_posts for each row execute function app.on_blog();
create trigger blog_cleanup after update or delete on public.blog_posts for each row execute function app.after_blog();

-- ---------------------------------------------------------------------------
-- Bulletins (friends-only, expire after 10 days)
-- ---------------------------------------------------------------------------

create table public.bulletins (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 1000),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '10 days'
);
create index bulletins_author on public.bulletins (author_id, created_at desc);
alter table public.bulletins enable row level security;
revoke all on public.bulletins from anon, authenticated;
create policy bul_select on public.bulletins for select to authenticated
  using (author_id = (select auth.uid())
         or (expires_at > now() and app.are_friends((select auth.uid()), author_id) and app.is_active(author_id)));
create policy bul_insert on public.bulletins for insert to authenticated with check (author_id = (select auth.uid()) and app.is_active(author_id));
create policy bul_delete on public.bulletins for delete to authenticated using (author_id = (select auth.uid()) or app.is_moderator((select auth.uid())));
grant select, delete on public.bulletins to authenticated;
grant insert (author_id, body) on public.bulletins to authenticated;
create or replace function app.bulletin_rate() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if (select count(*) from public.bulletins where author_id = new.author_id and created_at > now() - interval '1 day') >= 10 then
    raise exception 'AH_RATE_LIMIT' using errcode = 'P0001';
  end if;
  return new;
end; $$;
create trigger bulletin_rate before insert on public.bulletins for each row execute function app.bulletin_rate();

-- ---------------------------------------------------------------------------
-- Profile polls
-- ---------------------------------------------------------------------------

create table public.polls (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  question text not null check (char_length(btrim(question)) between 1 and 140),
  options jsonb not null check (jsonb_typeof(options) = 'array' and jsonb_array_length(options) between 2 and 6),
  closed_at timestamptz,
  created_at timestamptz not null default now()
);
create index polls_owner on public.polls (owner_id, created_at desc);
alter table public.polls add constraint polls_options_ok check (
  not jsonb_path_exists(options, '$[*] ? (@.type() != "string")'));

create table public.poll_votes (
  poll_id uuid not null references public.polls (id) on delete cascade,
  voter_id uuid not null references public.profiles (id) on delete cascade,
  option_idx smallint not null check (option_idx between 0 and 5),
  created_at timestamptz not null default now(),
  primary key (poll_id, voter_id)
);
create index poll_votes_voter on public.poll_votes (voter_id);

alter table public.polls enable row level security;
revoke all on public.polls from anon, authenticated;
alter table public.poll_votes enable row level security;
revoke all on public.poll_votes from anon, authenticated;
create policy poll_select on public.polls for select to anon, authenticated using (app.can_view_profile((select auth.uid()), owner_id));
create policy poll_insert on public.polls for insert to authenticated with check (owner_id = (select auth.uid()));
create policy poll_update on public.polls for update to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy poll_delete on public.polls for delete to authenticated using (owner_id = (select auth.uid()));
grant select on public.polls to anon, authenticated;
grant insert (owner_id, question, options) on public.polls to authenticated;
grant update (closed_at) on public.polls to authenticated;
grant delete on public.polls to authenticated;

create policy pv_select on public.poll_votes for select to authenticated using (voter_id = (select auth.uid()));
create policy pv_insert on public.poll_votes for insert to authenticated with check (voter_id = (select auth.uid()));
grant select on public.poll_votes to authenticated;
grant insert (poll_id, voter_id, option_idx) on public.poll_votes to authenticated;

create or replace function app.check_vote() returns trigger language plpgsql security definer set search_path = '' as $$
declare p public.polls;
begin
  select * into p from public.polls where id = new.poll_id;
  if p.id is null or p.closed_at is not null or new.option_idx >= jsonb_array_length(p.options)
     or not app.can_view_profile(new.voter_id, p.owner_id) or app.is_blocked(new.voter_id, p.owner_id) then
    raise exception 'AH_NOT_ALLOWED' using errcode = '42501';
  end if;
  return new;
end; $$;
create trigger vote_check before insert on public.poll_votes for each row execute function app.check_vote();

-- Results only after you vote (or for the owner, or once closed): no peeking.
create or replace function public.poll_results(p_poll uuid) returns jsonb language sql stable security definer set search_path = '' as $$
  select case when p.id is null or not app.can_view_profile(auth.uid(), p.owner_id) then null
              when auth.uid() = p.owner_id or p.closed_at is not null
                   or exists (select 1 from public.poll_votes v where v.poll_id = p.id and v.voter_id = auth.uid())
              then jsonb_build_object('counts', (select coalesce(jsonb_agg(c order by i), '[]'::jsonb) from (
                     select i, (select count(*) from public.poll_votes v where v.poll_id = p.id and v.option_idx = i) c
                     from generate_series(0, jsonb_array_length(p.options) - 1) i) t),
                   'mine', (select option_idx from public.poll_votes v where v.poll_id = p.id and v.voter_id = auth.uid()))
              else jsonb_build_object('counts', null, 'mine', null) end
  from (select 1) one left join public.polls p on p.id = p_poll;
$$;

-- ---------------------------------------------------------------------------
-- Communities
-- ---------------------------------------------------------------------------

create table public.communities (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) between 3 and 30),
  name text not null check (char_length(btrim(name)) between 3 and 50),
  description text check (description is null or char_length(description) <= 500),
  accent text not null default '#9B7BFF' check (accent ~ '^#[0-9a-fA-F]{6}$'),
  is_public boolean not null default true,
  created_by uuid references public.profiles (id) on delete set null,
  member_count int not null default 0,
  created_at timestamptz not null default now()
);
create index communities_name_trgm on public.communities using gin (name extensions.gin_trgm_ops);

create table public.community_members (
  community_id uuid not null references public.communities (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null default 'member' check (role in ('member', 'mod', 'owner')),
  joined_at timestamptz not null default now(),
  primary key (community_id, user_id)
);
create index community_members_user on public.community_members (user_id);

create table public.community_posts (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index community_posts_comm on public.community_posts (community_id, created_at desc);
create index community_posts_author on public.community_posts (author_id);

create or replace function app.community_role(c uuid, u uuid) returns text language sql stable security definer set search_path = '' as $$
  select role from public.community_members where community_id = c and user_id = u;
$$;
create or replace function app.can_see_community(c uuid, u uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select is_public from public.communities where id = c), false) or app.community_role(c, u) is not null or app.is_moderator(u);
$$;

alter table public.communities enable row level security;
revoke all on public.communities from anon, authenticated;
alter table public.community_members enable row level security;
revoke all on public.community_members from anon, authenticated;
alter table public.community_posts enable row level security;
revoke all on public.community_posts from anon, authenticated;
create policy comm_select on public.communities for select to anon, authenticated using (app.can_see_community(id, (select auth.uid())));
create policy comm_update on public.communities for update to authenticated
  using (app.community_role(id, (select auth.uid())) in ('owner', 'mod')) with check (app.community_role(id, (select auth.uid())) in ('owner', 'mod'));
grant select on public.communities to anon, authenticated;
grant update (name, description, accent, is_public) on public.communities to authenticated;

create policy cmem_select on public.community_members for select to anon, authenticated
  using (app.can_see_community(community_id, (select auth.uid())) and not app.is_blocked((select auth.uid()), user_id));
create policy cmem_delete on public.community_members for delete to authenticated
  using ((user_id = (select auth.uid()) and role <> 'owner') or app.community_role(community_id, (select auth.uid())) in ('owner', 'mod'));
grant select on public.community_members to anon, authenticated;
grant delete on public.community_members to authenticated;

create policy cpost_select on public.community_posts for select to anon, authenticated
  using (app.can_see_community(community_id, (select auth.uid())) and not app.is_blocked((select auth.uid()), author_id) and app.is_active(author_id));
create policy cpost_insert on public.community_posts for insert to authenticated
  with check (author_id = (select auth.uid()) and app.community_role(community_id, (select auth.uid())) is not null and app.is_active(author_id));
create policy cpost_delete on public.community_posts for delete to authenticated
  using (author_id = (select auth.uid()) or app.community_role(community_id, (select auth.uid())) in ('owner', 'mod') or app.is_moderator((select auth.uid())));
grant select on public.community_posts to anon, authenticated;
grant insert (community_id, author_id, body) on public.community_posts to authenticated;
grant delete on public.community_posts to authenticated;

create or replace function app.on_member_change() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update public.communities set member_count = (select count(*) from public.community_members where community_id = coalesce(new.community_id, old.community_id))
  where id = coalesce(new.community_id, old.community_id);
  return null;
end; $$;
create trigger community_member_count after insert or delete on public.community_members for each row execute function app.on_member_change();

create or replace function public.create_community(p_slug text, p_name text, p_description text, p_public boolean default true) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if auth.uid() is null or not app.is_active(auth.uid()) then raise exception 'AH_AUTH' using errcode = '42501'; end if;
  if (select count(*) from public.communities where created_by = auth.uid() and created_at > now() - interval '1 day') >= 3 then
    raise exception 'AH_RATE_LIMIT' using errcode = 'P0001';
  end if;
  insert into public.communities (slug, name, description, is_public, created_by)
  values (lower(btrim(p_slug)), btrim(p_name), nullif(btrim(coalesce(p_description, '')), ''), coalesce(p_public, true), auth.uid()) returning id into v_id;
  insert into public.community_members (community_id, user_id, role) values (v_id, auth.uid(), 'owner');
  return v_id;
end; $$;

create or replace function public.join_community(p_id uuid) returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or not (select is_public from public.communities where id = p_id) then raise exception 'AH_NOT_ALLOWED' using errcode = '42501'; end if;
  insert into public.community_members (community_id, user_id) values (p_id, auth.uid()) on conflict do nothing;
end; $$;

-- Mods add friends to private communities.
create or replace function public.add_community_member(p_id uuid, p_user uuid) returns void language plpgsql security definer set search_path = '' as $$
begin
  if app.community_role(p_id, auth.uid()) not in ('owner', 'mod') or not app.are_friends(auth.uid(), p_user) then
    raise exception 'AH_NOT_ALLOWED' using errcode = '42501';
  end if;
  insert into public.community_members (community_id, user_id) values (p_id, p_user) on conflict do nothing;
  perform app.notify(p_user, auth.uid(), 'community_invite', p_id, jsonb_build_object('slug', (select slug from public.communities where id = p_id)));
end; $$;

create or replace function public.set_community_role(p_id uuid, p_user uuid, p_role text) returns void language plpgsql security definer set search_path = '' as $$
begin
  if app.community_role(p_id, auth.uid()) <> 'owner' or p_role not in ('member', 'mod') or p_user = auth.uid() then
    raise exception 'AH_NOT_ALLOWED' using errcode = '42501';
  end if;
  update public.community_members set role = p_role where community_id = p_id and user_id = p_user;
end; $$;

-- ---------------------------------------------------------------------------
-- Theme gallery
-- ---------------------------------------------------------------------------

create table public.profile_themes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 40),
  tokens jsonb not null check (app.valid_theme(tokens)),
  uses_count int not null default 0,
  created_at timestamptz not null default now()
);
create index profile_themes_popular on public.profile_themes (uses_count desc, created_at desc);
create index profile_themes_owner on public.profile_themes (owner_id);
alter table public.profile_themes enable row level security;
revoke all on public.profile_themes from anon, authenticated;
create policy pt_select on public.profile_themes for select to anon, authenticated using (app.is_active(owner_id));
create policy pt_delete on public.profile_themes for delete to authenticated using (owner_id = (select auth.uid()) or app.is_moderator((select auth.uid())));
grant select on public.profile_themes to anon, authenticated;
grant delete on public.profile_themes to authenticated;

create or replace function public.publish_theme(p_name text, p_tokens jsonb) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if auth.uid() is null or not app.is_active(auth.uid()) then raise exception 'AH_AUTH' using errcode = '42501'; end if;
  if (select count(*) from public.profile_themes where owner_id = auth.uid()) >= 30 then raise exception 'AH_RATE_LIMIT' using errcode = 'P0001'; end if;
  insert into public.profile_themes (owner_id, name, tokens) values (auth.uid(), btrim(p_name), p_tokens) returning id into v_id;
  return v_id;
end; $$;

create or replace function public.use_theme(p_id uuid) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v jsonb;
begin
  if auth.uid() is null then raise exception 'AH_AUTH' using errcode = '42501'; end if;
  update public.profile_themes set uses_count = uses_count + 1 where id = p_id and owner_id <> auth.uid() returning tokens into v;
  if v is null then select tokens into v from public.profile_themes where id = p_id; end if;
  if v is null then raise exception 'AH_NOT_FOUND' using errcode = 'P0002'; end if;
  update public.profile_details set theme = v where id = auth.uid();
  return v;
end; $$;

-- ---------------------------------------------------------------------------
-- Gifts
-- ---------------------------------------------------------------------------

create table public.gifts (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles (id) on delete cascade,
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  gift_key text not null check (gift_key in ('cassette', 'disco', 'rose', 'pizza', 'trophy', 'mixtape', 'lava', 'teddy', 'skate', 'star')),
  message text check (message is null or char_length(message) <= 140),
  is_public boolean not null default true,
  created_at timestamptz not null default now(),
  check (sender_id <> recipient_id)
);
create index gifts_recipient on public.gifts (recipient_id, created_at desc);
create index gifts_sender on public.gifts (sender_id);
alter table public.gifts enable row level security;
revoke all on public.gifts from anon, authenticated;
create policy gift_select on public.gifts for select to anon, authenticated
  using ((select auth.uid()) in (sender_id, recipient_id)
         or (is_public and app.can_view_profile((select auth.uid()), recipient_id) and not app.is_blocked((select auth.uid()), sender_id) and app.is_active(sender_id)));
create policy gift_insert on public.gifts for insert to authenticated
  with check (sender_id = (select auth.uid()) and app.are_friends(sender_id, recipient_id) and app.is_active(sender_id));
create policy gift_delete on public.gifts for delete to authenticated using ((select auth.uid()) in (sender_id, recipient_id));
grant select on public.gifts to anon, authenticated;
grant insert (sender_id, recipient_id, gift_key, message, is_public) on public.gifts to authenticated;
grant delete on public.gifts to authenticated;
create or replace function app.on_gift() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if (select count(*) from public.gifts where sender_id = new.sender_id and created_at > now() - interval '1 day') >= 10 then
    raise exception 'AH_RATE_LIMIT' using errcode = 'P0001';
  end if;
  perform app.notify(new.recipient_id, new.sender_id, 'gift', new.id);
  return new;
end; $$;
create trigger gift_check before insert on public.gifts for each row execute function app.on_gift();

-- ---------------------------------------------------------------------------
-- Badges (cosmetic, earned automatically)
-- ---------------------------------------------------------------------------

create table public.badges (
  key text primary key,
  name text not null,
  description text not null,
  color text not null
);
insert into public.badges (key, name, description, color) values
  ('early_bird', 'Early Bird', 'One of the first 1,000 people on LateNite', '#5CFF8A'),
  ('guestbook_regular', 'Guestbook Regular', 'Signed 10 different guestbooks', '#38E1FF'),
  ('theme_maker', 'Theme Maker', 'Shared a theme in the gallery', '#FFC23D'),
  ('blogger', 'Blogger', 'Published a blog post', '#9B7BFF'),
  ('social_butterfly', 'Social Butterfly', 'Has 25 friends', '#FF4FA3'),
  ('founder', 'Founder', 'Started a community', '#FF8A5C'),
  ('top_8_material', 'Top 8 Material', 'In 5 people’s Top Friends', '#FFB3D9'),
  ('profile_of_the_week', 'Profile of the Week', 'Featured on Discover', '#FFE08A');

create table public.user_badges (
  user_id uuid not null references public.profiles (id) on delete cascade,
  badge_key text not null references public.badges (key) on delete cascade,
  awarded_at timestamptz not null default now(),
  primary key (user_id, badge_key)
);
alter table public.badges enable row level security;
revoke all on public.badges from anon, authenticated;
alter table public.user_badges enable row level security;
revoke all on public.user_badges from anon, authenticated;
create policy badges_select on public.badges for select to anon, authenticated using (true);
create policy ub_select on public.user_badges for select to anon, authenticated using (not app.is_blocked((select auth.uid()), user_id));
grant select on public.badges, public.user_badges to anon, authenticated;

create or replace function app.award(u uuid, k text) returns void language plpgsql security definer set search_path = '' as $$
begin
  insert into public.user_badges (user_id, badge_key) values (u, k) on conflict do nothing;
  if found then
    insert into public.notifications (user_id, type, data) values (u, 'badge', jsonb_build_object('name', (select name from public.badges where key = k)));
  end if;
end; $$;

create or replace function app.badge_triggers() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  case tg_table_name
    when 'profiles' then
      if (select count(*) from public.profiles) <= 1000 then perform app.award(new.id, 'early_bird'); end if;
    when 'guestbook_entries' then
      if new.parent_id is null and new.author_id <> new.profile_id
         and (select count(distinct profile_id) from public.guestbook_entries where author_id = new.author_id and profile_id <> new.author_id) >= 10 then
        perform app.award(new.author_id, 'guestbook_regular'); end if;
    when 'profile_themes' then perform app.award(new.owner_id, 'theme_maker');
    when 'blog_posts' then if new.status = 'published' then perform app.award(new.author_id, 'blogger'); end if;
    when 'friendships' then
      if (select count(*) from public.friendships where new.user_a in (user_a, user_b)) >= 25 then perform app.award(new.user_a, 'social_butterfly'); end if;
      if (select count(*) from public.friendships where new.user_b in (user_a, user_b)) >= 25 then perform app.award(new.user_b, 'social_butterfly'); end if;
    when 'communities' then if new.created_by is not null then perform app.award(new.created_by, 'founder'); end if;
    when 'top_friends' then
      if (select count(*) from public.top_friends where friend_id = new.friend_id) >= 5 then perform app.award(new.friend_id, 'top_8_material'); end if;
  end case;
  return null;
end; $$;
create trigger badge_profiles after insert on public.profiles for each row execute function app.badge_triggers();
create trigger badge_gb after insert on public.guestbook_entries for each row execute function app.badge_triggers();
create trigger badge_theme after insert on public.profile_themes for each row execute function app.badge_triggers();
create trigger badge_blog after insert or update of status on public.blog_posts for each row execute function app.badge_triggers();
create trigger badge_friends after insert on public.friendships for each row execute function app.badge_triggers();
create trigger badge_comm after insert on public.communities for each row execute function app.badge_triggers();
create trigger badge_top after insert on public.top_friends for each row execute function app.badge_triggers();
insert into public.user_badges (user_id, badge_key) select id, 'early_bird' from public.profiles order by created_at limit 1000 on conflict do nothing;

-- ---------------------------------------------------------------------------
-- Profile of the Week (opt-in, picked by moderators)
-- ---------------------------------------------------------------------------

create table public.featured_profiles (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  week_of date not null,
  note text check (note is null or char_length(note) <= 200),
  primary key (week_of, profile_id)
);
alter table public.featured_profiles enable row level security;
revoke all on public.featured_profiles from anon, authenticated;
create policy fp_select on public.featured_profiles for select to anon, authenticated
  using (app.is_active(profile_id) and not app.is_blocked((select auth.uid()), profile_id));
grant select on public.featured_profiles to anon, authenticated;

create or replace function public.feature_profile(p_profile uuid, p_note text) returns void language plpgsql security definer set search_path = '' as $$
begin
  if not app.is_moderator(auth.uid()) then raise exception 'AH_NOT_ALLOWED' using errcode = '42501'; end if;
  if not coalesce((select potw_opt_in from public.profile_settings where id = p_profile), false)
     or (select is_private from public.profiles where id = p_profile) then
    raise exception 'AH_NOT_ALLOWED' using errcode = '42501';
  end if;
  insert into public.featured_profiles (profile_id, week_of, note) values (p_profile, date_trunc('week', now())::date, p_note)
  on conflict (week_of, profile_id) do update set note = excluded.note;
  perform app.award(p_profile, 'profile_of_the_week');
end; $$;

-- ---------------------------------------------------------------------------
-- Discovery (no ranking algorithm: filters + mutual friends + shared interests)
-- ---------------------------------------------------------------------------

create or replace function public.discover_people(p_q text default null, p_interest text default null, p_region text default null, p_limit int default 30)
returns table (id uuid, username text, display_name text, avatar_url text, mood text, region text, interests text[], mutual int, shared int, discoverable boolean)
language sql stable security definer set search_path = '' as $$
  with mine as (select coalesce((select interests from public.profile_details where id = auth.uid()), '{}') i),
  q as (select nullif(lower(btrim(coalesce(p_q, ''))), '') q, nullif(lower(btrim(coalesce(p_interest, ''))), '') i, nullif(btrim(coalesce(p_region, '')), '') r)
  select p.id, p.username::text, p.display_name, p.avatar_url, p.mood,
         case when p.discoverable and not p.is_private then d.region end,
         case when p.discoverable and not p.is_private then d.interests else '{}' end,
         (select count(*)::int from public.friendships f
           where p.id in (f.user_a, f.user_b) and (case when f.user_a = p.id then f.user_b else f.user_a end) in (select app.my_friend_ids())),
         (select count(*)::int from unnest(d.interests) x where exists (select 1 from mine where x = any (mine.i))),
         p.discoverable
  from public.profiles p join public.profile_details d on d.id = p.id, q
  where p.suspended_at is null and p.id is distinct from auth.uid() and not app.is_blocked(auth.uid(), p.id)
    and (
      -- exact-ish username/name search finds anyone (cards are public anyway)
      (q.q is not null and q.i is null and q.r is null and (p.username::text like q.q || '%' or p.display_name ilike '%' || q.q || '%'))
      -- everything else only shows people who opted in to discovery
      or (p.discoverable and not p.is_private
          and (q.q is null or p.username::text like '%' || q.q || '%' or p.display_name ilike '%' || q.q || '%')
          and (q.i is null or q.i = any (d.interests))
          and (q.r is null or d.region ilike '%' || q.r || '%')))
  order by 8 desc, 9 desc, p.created_at desc
  limit least(coalesce(p_limit, 30), 60);
$$;

-- Discover tab: public posts from discoverable people, newest first. Off unless you turn it on.
create or replace function public.discover_feed(p_before timestamptz default null, p_limit int default 20)
returns setof public.posts language sql stable security invoker set search_path = '' as $$
  select po.* from public.posts po join public.profiles pr on pr.id = po.author_id
  where coalesce((select discover_feed from public.profile_settings where id = auth.uid()), false)
    and po.visibility = 'public' and pr.discoverable and not pr.is_private and po.author_id <> auth.uid()
    and po.kind in ('status', 'photo', 'music', 'blog') and po.repost_of is null
    and po.created_at < coalesce(p_before, 'infinity'::timestamptz)
  order by po.created_at desc
  limit least(greatest(coalesce(p_limit, 20), 1), 50);
$$;

-- Friendship anniversaries (whole months, today) + the newest friends this week.
create or replace function public.friend_milestones()
returns table (id uuid, username text, display_name text, avatar_url text, since timestamptz, months int, kind text)
language sql stable security definer set search_path = '' as $$
  select p.id, p.username::text, p.display_name, p.avatar_url, f.created_at,
         ((extract(year from age(now(), f.created_at)) * 12) + extract(month from age(now(), f.created_at)))::int,
         case when f.created_at > now() - interval '7 days' then 'new' else 'anniversary' end
  from public.friendships f
  join public.profiles p on p.id = case when f.user_a = auth.uid() then f.user_b else f.user_a end
  where auth.uid() in (f.user_a, f.user_b) and p.suspended_at is null
    and (f.created_at > now() - interval '7 days'
         or (extract(day from f.created_at) = extract(day from now()) and f.created_at < now() - interval '25 days'))
  order by f.created_at desc limit 10;
$$;

revoke execute on all functions in schema public from public, anon;
grant execute on function public.username_available(text), public.friends_of(uuid, int), public.get_top_friends(uuid), public.visit_stats(uuid),
  public.poll_results(uuid) to anon, authenticated;
grant execute on function public.create_community(text, text, text, boolean), public.join_community(uuid), public.add_community_member(uuid, uuid),
  public.set_community_role(uuid, uuid, text), public.publish_theme(text, jsonb), public.use_theme(uuid), public.feature_profile(uuid, text),
  public.discover_people(text, text, text, int), public.discover_feed(timestamptz, int), public.friend_milestones() to authenticated;
revoke all on all functions in schema app from public;
grant execute on all functions in schema app to anon, authenticated, service_role;

-- New pages get the Phase 4 sections too (owners can hide or reorder them in the editor).
alter table public.profile_details alter column layout set default '["top","about","poll","guestbook","blog","gifts","posts"]'::jsonb;
