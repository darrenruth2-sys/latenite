-- v10.1: music-only profile songs, Last.fm "Now listening", Sentinel (automatic AI screening), and audit fixes.

-- ---------------------------------------------------------------------------
-- 1) Profile songs: real released songs only.
--    - Spotify tracks and Apple Music songs (their catalogs only hold released music).
--    - YouTube only for official music the server has checked (official artist "Topic"/VEVO channels, Music
--      category, embeddable, 10 minutes max). Those can only be saved through the server (set_profile_song).
--    No SoundCloud or arbitrary YouTube links, where anyone can upload anything.
-- ---------------------------------------------------------------------------
create or replace function app.music_url_ok(provider text, u text) returns boolean language sql immutable set search_path = '' as $$
  select char_length(u) <= 500 and (
    (provider = 'spotify' and u ~ '^https://open\.spotify\.com/track/[A-Za-z0-9]{10,40}$')
    or (provider = 'apple' and u ~ '^https://music\.apple\.com/[a-z]{2}/(song/[A-Za-z0-9._~%-]+/[0-9]+|album/[A-Za-z0-9._~%-]+/[0-9]+\?i=[0-9]+)$')
    or (provider = 'youtube' and u ~ '^https://www\.youtube\.com/watch\?v=[A-Za-z0-9_-]{11}$'));
$$;

-- Songs saved before this change weren't checked, so they're cleared (owners get a note to pick again).
with cleared as (
  update public.profile_details d set music = null
  where d.music is not null and jsonb_typeof(d.music) = 'object'
    and ((d.music ->> 'provider') not in ('spotify', 'apple') or not coalesce(app.music_url_ok(d.music ->> 'provider', d.music ->> 'url'), false))
  returning d.id)
insert into public.notifications (user_id, type, data)
select c.id, 'system', jsonb_build_object('text', 'Profile songs now come from a music-only search. Pick your song again on your page.',
                                          'href', '/u/' || p.username)
from cleared c join public.profiles p on p.id = c.id;

create or replace function app.valid_music(m jsonb) returns boolean language sql immutable set search_path = '' as $$
  select m is null or jsonb_typeof(m) = 'null' or (
    jsonb_typeof(m) = 'object'
    and not exists (select 1 from jsonb_object_keys(m) k where k not in ('provider', 'url', 'title', 'artist', 'art', 'autoplay'))
    and (m ->> 'provider') in ('spotify', 'apple', 'youtube')
    and coalesce(app.music_url_ok(m ->> 'provider', m ->> 'url'), false)
    and coalesce(char_length(m ->> 'title'), 0) <= 100 and coalesce(char_length(m ->> 'artist'), 0) <= 100
    and (m -> 'art' is null or jsonb_typeof(m -> 'art') = 'null' or app.is_music_art(m ->> 'art'))
    and (m -> 'autoplay' is null or jsonb_typeof(m -> 'autoplay') = 'boolean'));
$$;

-- A YouTube song can only be set by the server after it checks the video (title/autoplay edits are fine).
create or replace function app.guard_song() returns trigger language plpgsql set search_path = '' as $$
begin
  if new.music is not null and jsonb_typeof(new.music) = 'object' and new.music ->> 'provider' = 'youtube'
     and coalesce(current_setting('app.song_ok', true), '') <> '1'
     and (tg_op = 'INSERT' or old.music is null or jsonb_typeof(old.music) <> 'object' or (old.music ->> 'url') is distinct from (new.music ->> 'url')) then
    raise exception 'AH_SONG_NOT_VERIFIED' using errcode = '42501';
  end if;
  return new;
end; $$;
create trigger guard_song before insert or update of music on public.profile_details for each row execute function app.guard_song();

create or replace function public.set_profile_song(p_user uuid, p_music jsonb) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not app.is_active(p_user) then raise exception 'AH_SUSPENDED' using errcode = '42501'; end if;
  perform set_config('app.song_ok', '1', true);
  update public.profile_details set music = p_music where id = p_user;
  perform set_config('app.song_ok', '', true);
end; $$;
revoke execute on function public.set_profile_song(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.set_profile_song(uuid, jsonb) to service_role;

-- "Report this song"
alter table public.reports drop constraint if exists reports_reason_check;
alter table public.reports add constraint reports_reason_check check (reason in
  ('spam', 'harassment', 'hate', 'sexual', 'violence', 'self_harm', 'impersonation', 'underage', 'other',
   'intimate_image', 'child_safety', 'copyright', 'music'));

-- ---------------------------------------------------------------------------
-- 2) Last.fm "Now listening". Kept out of the public profile table: only the owner sees their Last.fm name,
--    and visitors only get it (through the server) when sharing is on and they're allowed to see the profile.
-- ---------------------------------------------------------------------------
create table app.listening (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  lastfm_user text not null check (lastfm_user ~ '^[A-Za-z][A-Za-z0-9_-]{1,14}$'),
  share boolean not null default true,
  updated_at timestamptz not null default now()
);
revoke all on app.listening from public, anon, authenticated;

create or replace function public.my_listening() returns table (lastfm_user text, share boolean)
language sql stable security definer set search_path = '' as $$
  select l.lastfm_user, l.share from app.listening l where l.user_id = auth.uid();
$$;

create or replace function public.set_listening(p_lastfm text, p_share boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare v_me uuid := auth.uid(); v_name text := btrim(coalesce(p_lastfm, ''));
begin
  if v_me is null then raise exception 'AH_NOT_ALLOWED' using errcode = '42501'; end if;
  if not app.is_active(v_me) then raise exception 'AH_SUSPENDED' using errcode = '42501'; end if;
  if v_name = '' then delete from app.listening where user_id = v_me; return; end if;
  if v_name !~ '^[A-Za-z][A-Za-z0-9_-]{1,14}$' then raise exception 'AH_BAD_LASTFM' using errcode = '22023'; end if;
  insert into app.listening (user_id, lastfm_user, share) values (v_me, v_name, coalesce(p_share, true))
  on conflict (user_id) do update set lastfm_user = excluded.lastfm_user, share = excluded.share, updated_at = now();
end; $$;

create or replace function public.listening_target(p_profile uuid) returns text
language sql stable security definer set search_path = '' as $$
  select l.lastfm_user from app.listening l
  where l.user_id = p_profile and l.share and app.can_view_profile(auth.uid(), p_profile);
$$;
revoke execute on function public.my_listening(), public.set_listening(text, boolean) from public, anon;
grant execute on function public.my_listening(), public.set_listening(text, boolean) to authenticated;
revoke execute on function public.listening_target(uuid) from public, anon;
grant execute on function public.listening_target(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 3) Sentinel: every new or edited post, comment, guestbook entry, blog, bulletin, community post, profile
--    and chat photo is queued; the server checks it with an AI moderation model and anything clearly against
--    the rules is hidden (never destroyed) until a moderator confirms or restores it.
-- ---------------------------------------------------------------------------
create table app.sentinel_queue (
  id bigserial primary key,
  target_type text not null,
  target_id uuid not null,
  owner_id uuid,
  created_at timestamptz not null default now(),
  claimed_at timestamptz,
  done_at timestamptz,
  result jsonb
);
create unique index sentinel_pending on app.sentinel_queue (target_type, target_id) where done_at is null;
create index sentinel_todo on app.sentinel_queue (id) where done_at is null;
revoke all on app.sentinel_queue from public, anon, authenticated;

-- Content hidden by Sentinel or a takedown, kept so it can be restored or handed to law enforcement.
create table app.quarantine (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  source text not null check (source in ('sentinel', 'takedown')),
  target_type text not null,
  target_id uuid not null,
  owner_id uuid,
  reason text,
  data jsonb,
  restored_at timestamptz,
  restored_by uuid
);
create index quarantine_target on app.quarantine (target_type, target_id) where restored_at is null;
revoke all on app.quarantine from public, anon, authenticated;

create or replace function app.sentinel_enqueue() returns trigger language plpgsql security definer set search_path = '' as $$
declare j jsonb := to_jsonb(new);
begin
  if current_setting('sentinel.busy', true) = '1' then return new; end if;
  insert into app.sentinel_queue (target_type, target_id, owner_id)
  values (tg_argv[0], (j ->> 'id')::uuid, (j ->> tg_argv[1])::uuid)
  on conflict (target_type, target_id) where done_at is null do nothing;
  return new;
end; $$;

create trigger sentinel_posts after insert or update of body, media on public.posts
  for each row execute function app.sentinel_enqueue('post', 'author_id');
create trigger sentinel_comments after insert or update of body on public.comments
  for each row execute function app.sentinel_enqueue('comment', 'author_id');
create trigger sentinel_guestbook after insert or update of body, image_url on public.guestbook_entries
  for each row execute function app.sentinel_enqueue('guestbook', 'author_id');
create trigger sentinel_blog after insert or update of title, body, cover_url on public.blog_posts
  for each row execute function app.sentinel_enqueue('blog', 'author_id');
create trigger sentinel_bulletins after insert or update of body on public.bulletins
  for each row execute function app.sentinel_enqueue('bulletin', 'author_id');
create trigger sentinel_community after insert or update of body on public.community_posts
  for each row execute function app.sentinel_enqueue('community', 'author_id');
-- Private chats: only photos are checked, and only for child safety (see sentinel_result).
create trigger sentinel_messages after insert on public.messages
  for each row when (new.media_path is not null) execute function app.sentinel_enqueue('message', 'sender_id');
create trigger sentinel_profiles after update of display_name, mood, avatar_url on public.profiles
  for each row execute function app.sentinel_enqueue('profile', 'id');
create trigger sentinel_details after insert or update of headline, bio, meet, banner_url, theme, music on public.profile_details
  for each row execute function app.sentinel_enqueue('profile', 'id');

-- Text and pictures of one item, for checking and for evidence.
create or replace function app.content_of(p_type text, p_id uuid) returns jsonb language sql stable security definer set search_path = '' as $$
  select case p_type
    when 'post' then (select jsonb_build_object('text', coalesce(x.body, ''),
        'images', coalesce((select jsonb_agg(e ->> 'url') from jsonb_array_elements(x.media) e where e ->> 'url' is not null), '[]'::jsonb))
      from public.posts x where x.id = p_id)
    when 'comment' then (select jsonb_build_object('text', x.body, 'images', '[]'::jsonb) from public.comments x where x.id = p_id)
    when 'guestbook' then (select jsonb_build_object('text', coalesce(x.body, ''), 'images',
        case when x.image_url is null then '[]'::jsonb else jsonb_build_array(x.image_url) end) from public.guestbook_entries x where x.id = p_id)
    when 'blog' then (select jsonb_build_object('text', x.title || E'\n' || coalesce(x.excerpt, '') || E'\n' ||
        coalesce((select string_agg(t #>> '{}', ' ') from jsonb_path_query(x.body, 'strict $.**.text') t), ''),
        'images', case when x.cover_url is null then '[]'::jsonb else jsonb_build_array(x.cover_url) end) from public.blog_posts x where x.id = p_id)
    when 'bulletin' then (select jsonb_build_object('text', x.body, 'images', '[]'::jsonb) from public.bulletins x where x.id = p_id)
    when 'community' then (select jsonb_build_object('text', x.body, 'images', '[]'::jsonb) from public.community_posts x where x.id = p_id)
    when 'message' then (select jsonb_build_object('text', '', 'images', '[]'::jsonb,
        'private_images', case when x.media_path is null then '[]'::jsonb else jsonb_build_array(x.media_path) end) from public.messages x where x.id = p_id)
    when 'profile' then (select jsonb_build_object(
        'text', concat_ws(E'\n', p.display_name, p.mood, d.headline, d.bio, d.meet, d.music ->> 'title', d.music ->> 'artist'),
        'images', (select coalesce(jsonb_agg(u), '[]'::jsonb) from unnest(array[p.avatar_url, d.banner_url, d.theme ->> 'bg_image']) u where u is not null))
      from public.profiles p left join public.profile_details d on d.id = p.id where p.id = p_id)
  end;
$$;
revoke execute on function app.content_of(text, uuid) from public, anon, authenticated;

-- Hide an item without destroying it. Returns the quarantine id (null if there was nothing to hide).
create or replace function app.quarantine_item(p_type text, p_id uuid, p_source text, p_reason text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_row jsonb; v_owner uuid; v_q uuid;
begin
  perform set_config('sentinel.busy', '1', true);
  case p_type
    when 'post' then
      update public.posts set hidden_at = coalesce(hidden_at, now()) where id = p_id returning author_id into v_owner;
      v_row := '{}'::jsonb;
    when 'guestbook' then
      update public.guestbook_entries set hidden_at = coalesce(hidden_at, now()) where id = p_id returning author_id into v_owner;
      v_row := '{}'::jsonb;
    when 'blog' then
      select jsonb_build_object('status', status), author_id into v_row, v_owner from public.blog_posts where id = p_id;
      update public.blog_posts set status = 'draft' where id = p_id;
    when 'comment' then delete from public.comments c where c.id = p_id returning to_jsonb(c), c.author_id into v_row, v_owner;
    when 'bulletin' then delete from public.bulletins b where b.id = p_id returning to_jsonb(b), b.author_id into v_row, v_owner;
    when 'community' then delete from public.community_posts cp where cp.id = p_id returning to_jsonb(cp), cp.author_id into v_row, v_owner;
    when 'message' then delete from public.messages m where m.id = p_id returning to_jsonb(m), m.sender_id into v_row, v_owner;
    when 'profile' then
      select jsonb_build_object('display_name', p.display_name, 'mood', p.mood, 'avatar_url', p.avatar_url,
                                'headline', d.headline, 'bio', d.bio, 'meet', d.meet, 'banner_url', d.banner_url, 'bg_image', d.theme -> 'bg_image', 'music', d.music),
             p.id into v_row, v_owner
      from public.profiles p left join public.profile_details d on d.id = p.id where p.id = p_id;
      update public.profiles set display_name = username::text, mood = null, avatar_url = null where id = p_id;
      update public.profile_details set headline = null, bio = null, meet = null, banner_url = null, music = null, theme = theme - 'bg_image' where id = p_id;
    else return null;
  end case;
  if v_row is null then perform set_config('sentinel.busy', '', true); return null; end if;
  insert into app.quarantine (source, target_type, target_id, owner_id, reason, data)
  values (p_source, p_type, p_id, v_owner, p_reason, v_row) returning id into v_q;
  perform set_config('sentinel.busy', '', true);
  return v_q;
end; $$;

-- Put back whatever Sentinel or a takedown hid (used when a moderator dismisses the report).
create or replace function app.restore_item(p_type text, p_id uuid, p_by uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
declare q app.quarantine; v_tbl text;
begin
  select * into q from app.quarantine where target_type = p_type and target_id = p_id and restored_at is null order by created_at desc limit 1;
  if q.id is null then return false; end if;
  perform set_config('sentinel.busy', '1', true);
  perform set_config('app.song_ok', '1', true);
  begin
    case p_type
      when 'post' then update public.posts set hidden_at = null where id = p_id;
      when 'guestbook' then update public.guestbook_entries set hidden_at = null where id = p_id;
      when 'blog' then update public.blog_posts set status = coalesce(q.data ->> 'status', status) where id = p_id;
      when 'profile' then
        update public.profiles set display_name = coalesce(q.data ->> 'display_name', display_name), mood = q.data ->> 'mood',
          avatar_url = q.data ->> 'avatar_url' where id = p_id;
        update public.profile_details set headline = q.data ->> 'headline', bio = q.data ->> 'bio', meet = q.data ->> 'meet',
          banner_url = q.data ->> 'banner_url',
          music = case when jsonb_typeof(q.data -> 'music') = 'object' then q.data -> 'music' end,
          theme = case when q.data -> 'bg_image' is null or jsonb_typeof(q.data -> 'bg_image') = 'null' then theme
                       else theme || jsonb_build_object('bg_image', q.data -> 'bg_image') end
        where id = p_id;
      else
        v_tbl := case p_type when 'comment' then 'comments' when 'bulletin' then 'bulletins' when 'community' then 'community_posts' when 'message' then 'messages' end;
        if v_tbl is null then return false; end if;
        execute format('insert into public.%I select * from jsonb_populate_record(null::public.%I, $1) on conflict (id) do nothing', v_tbl, v_tbl) using q.data;
    end case;
  exception when others then
    perform set_config('sentinel.busy', '', true);
    perform set_config('app.song_ok', '', true);
    return false;  -- e.g. the post it belonged to is gone; it stays in quarantine
  end;
  update app.quarantine set restored_at = now(), restored_by = p_by where id = q.id;
  perform set_config('sentinel.busy', '', true);
  perform set_config('app.song_ok', '', true);
  return true;
end; $$;
revoke execute on function app.quarantine_item(text, uuid, text, text), app.restore_item(text, uuid, uuid) from public, anon, authenticated;

-- Server only: take a batch of queued items to check.
create or replace function public.sentinel_claim(p_limit int default 20)
returns table (qid bigint, target_type text, target_id uuid, owner_id uuid, content jsonb)
language plpgsql security definer set search_path = '' as $$
begin
  delete from app.sentinel_queue q where q.done_at < now() - interval '30 days';
  return query
  with picked as (
    select q.id from app.sentinel_queue q
    where q.done_at is null and (q.claimed_at is null or q.claimed_at < now() - interval '5 minutes')
    order by q.id limit least(greatest(coalesce(p_limit, 20), 1), 50) for update skip locked),
  c as (update app.sentinel_queue q set claimed_at = now() from picked where q.id = picked.id
        returning q.id, q.target_type, q.target_id, q.owner_id)
  select c.id, c.target_type, c.target_id, c.owner_id, app.content_of(c.target_type, c.target_id) from c order by c.id;
end; $$;

-- Server only: record the AI result and act on it. Returns what was done.
create or replace function public.sentinel_result(p_qid bigint, p_flagged boolean, p_categories text[], p_detail jsonb default null)
returns text language plpgsql security definer set search_path = '' as $$
declare q app.sentinel_queue; v_reason text; v_action text := 'ok'; v_content jsonb;
        v_minors boolean := 'sexual/minors' = any(coalesce(p_categories, '{}'));
        v_only_self_harm boolean := coalesce(array_length(p_categories, 1), 0) > 0
          and not exists (select 1 from unnest(p_categories) c where c not like 'self-harm%');
begin
  select * into q from app.sentinel_queue where id = p_qid;
  if q.id is null or q.done_at is not null then return 'skip'; end if;
  v_content := app.content_of(q.target_type, q.target_id);
  if v_content is null then
    update app.sentinel_queue set done_at = now(), result = jsonb_build_object('action', 'gone') where id = p_qid;
    return 'gone';
  end if;

  if coalesce(p_flagged, false) and coalesce(array_length(p_categories, 1), 0) > 0
     and (q.target_type <> 'message' or v_minors) then        -- private chat photos: child safety only
    v_reason := case
      when v_minors then 'child_safety'
      when exists (select 1 from unnest(p_categories) c where c like 'sexual%') then 'sexual'
      when exists (select 1 from unnest(p_categories) c where c like 'hate%') then 'hate'
      when exists (select 1 from unnest(p_categories) c where c like 'harassment%') then 'harassment'
      when exists (select 1 from unnest(p_categories) c where c like 'violence%' or c = 'illicit/violent') then 'violence'
      when v_only_self_harm then 'self_harm'
      else 'other' end;

    if v_minors then
      insert into app.legal_holds (target_type, target_id, owner_id, owner_username, content, media_paths, note)
      values (q.target_type, q.target_id, q.owner_id, (select username::text from public.profiles where id = q.owner_id),
              v_content ->> 'text',
              array(select jsonb_array_elements_text(coalesce(v_content -> 'images', '[]'::jsonb) || coalesce(v_content -> 'private_images', '[]'::jsonb))),
              'Sentinel flagged: ' || array_to_string(p_categories, ', '));
    end if;

    if v_only_self_harm then
      v_action := 'reported';      -- don't silence someone who may be struggling; a person reviews it
    else
      perform app.quarantine_item(q.target_type, q.target_id, 'sentinel', v_reason);
      v_action := 'hidden';
      if not v_minors and q.owner_id is not null then
        insert into public.notifications (user_id, type, data) values (q.owner_id, 'moderation',
          jsonb_build_object('text', 'Something you posted was hidden automatically while a moderator takes a look.'));
      end if;
    end if;

    if not exists (select 1 from public.reports r where r.target_type = q.target_type and r.target_id = q.target_id and r.status = 'open' and r.reporter_id is null) then
      insert into public.reports (reporter_id, target_type, target_id, target_owner, reason, details)
      values (null, q.target_type, q.target_id, q.owner_id, v_reason,
              left('Sentinel (automatic): ' || case when v_action = 'hidden' then 'hidden until reviewed' else 'not hidden' end
                   || ' · ' || array_to_string(p_categories, ', '), 1000));
    end if;
  end if;

  update app.sentinel_queue set done_at = now(),
    result = jsonb_build_object('action', v_action, 'flagged', coalesce(p_flagged, false), 'categories', to_jsonb(coalesce(p_categories, '{}')), 'detail', p_detail)
  where id = p_qid;
  return v_action;
end; $$;

create or replace function public.sentinel_stats() returns jsonb language sql stable security definer set search_path = '' as $$
  select case when app.is_moderator(auth.uid()) then jsonb_build_object(
    'pending', (select count(*) from app.sentinel_queue where done_at is null),
    'checked_today', (select count(*) from app.sentinel_queue where done_at > now() - interval '1 day'),
    'hidden_today', (select count(*) from app.sentinel_queue where done_at > now() - interval '1 day' and result ->> 'action' = 'hidden'))
  end;
$$;
revoke execute on function public.sentinel_claim(int), public.sentinel_result(bigint, boolean, text[], jsonb) from public, anon, authenticated;
grant execute on function public.sentinel_claim(int), public.sentinel_result(bigint, boolean, text[], jsonb) to service_role;
revoke execute on function public.sentinel_stats() from public, anon;
grant execute on function public.sentinel_stats() to authenticated;

-- ---------------------------------------------------------------------------
-- 4) Audit fixes
-- ---------------------------------------------------------------------------
-- 4a) The 48-hour clock is the TAKE IT DOWN Act's, for intimate images. Child-safety material has no grace
--     period: it's reported to NCMEC as soon as possible.
update app.takedown_requests set due_at = null where kind = 'child_safety';
create or replace function public.submit_takedown(p_kind text, p_urls text, p_description text, p_name text, p_email text, p_contact text,
                                                  p_is_subject boolean, p_sworn boolean, p_signature text, p_source text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if (select count(*) from app.takedown_requests where source_hash = p_source and created_at > now() - interval '1 hour') >= 10 then
    raise exception 'AH_RATE_LIMIT' using errcode = 'P0001';
  end if;
  if btrim(coalesce(p_email, '')) !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'AH_BAD_EMAIL' using errcode = '22023'; end if;
  insert into app.takedown_requests (kind, urls, description, requester_name, requester_email, requester_contact, is_subject, sworn, signature, source_hash, due_at)
  values (p_kind, btrim(p_urls), btrim(p_description), btrim(p_name), lower(btrim(p_email)), nullif(btrim(coalesce(p_contact, '')), ''),
          coalesce(p_is_subject, false), coalesce(p_sworn, false), nullif(btrim(coalesce(p_signature, '')), ''), p_source,
          case when p_kind = 'intimate_image' then now() + interval '48 hours' end)
  returning id into v_id;
  return v_id;
end; $$;
revoke execute on function public.submit_takedown(text, text, text, text, text, text, boolean, boolean, text, text) from public, anon, authenticated;
grant execute on function public.submit_takedown(text, text, text, text, text, text, boolean, boolean, text, text) to service_role;

-- 4b) Takedowns actually remove the content: a moderator points at it, it's hidden (and kept as evidence),
--     and the request is closed only if that worked. The server then moves any picture file out of public storage.
create or replace function public.mod_takedown_remove(p_id uuid, p_target_type text, p_target_id uuid, p_note text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare t app.takedown_requests; v_content jsonb; v_q uuid; v_owner uuid;
begin
  if not app.is_moderator(auth.uid()) then raise exception 'AH_NOT_ALLOWED' using errcode = '42501'; end if;
  select * into t from app.takedown_requests where id = p_id;
  if t.id is null then raise exception 'AH_NOT_FOUND' using errcode = 'P0002'; end if;
  v_content := app.content_of(p_target_type, p_target_id);
  if v_content is null then raise exception 'AH_NOT_FOUND' using errcode = 'P0002'; end if;
  v_q := app.quarantine_item(p_target_type, p_target_id, 'takedown', t.kind);
  if v_q is null then raise exception 'AH_NOT_FOUND' using errcode = 'P0002'; end if;
  select owner_id into v_owner from app.quarantine where id = v_q;
  insert into app.legal_holds (target_type, target_id, owner_id, owner_username, content, media_paths, moderator_id, note)
  values (p_target_type, p_target_id, v_owner, (select username::text from public.profiles where id = v_owner), v_content ->> 'text',
          array(select jsonb_array_elements_text(coalesce(v_content -> 'images', '[]'::jsonb) || coalesce(v_content -> 'private_images', '[]'::jsonb))),
          auth.uid(), 'Takedown ' || t.id::text || coalesce(': ' || p_note, ''));
  update app.takedown_requests set status = case when t.kind = 'child_safety' then 'reported' else 'removed' end,
    resolved_by = auth.uid(), resolved_at = now(),
    note = concat_ws(E'\n', note, 'Removed ' || p_target_type || ' ' || p_target_id::text || coalesce(': ' || p_note, '')) where id = p_id;
  insert into public.moderation_log (moderator_id, action, target_type, target_id, target_owner, note)
  values (auth.uid(), 'takedown_remove', p_target_type, p_target_id, v_owner, 'takedown ' || t.id::text);
  return jsonb_build_object('quarantine', v_q, 'owner', v_owner, 'images', coalesce(v_content -> 'images', '[]'::jsonb));
end; $$;
revoke execute on function public.mod_takedown_remove(uuid, text, uuid, text) from public, anon;
grant execute on function public.mod_takedown_remove(uuid, text, uuid, text) to authenticated;

-- Moderators find what a pasted link points to.
create or replace function public.mod_find_content(p_kind text, p_key text, p_key2 text default null)
returns table (target_type text, target_id uuid, label text) language plpgsql stable security definer set search_path = '' as $$
begin
  if not app.is_moderator(auth.uid()) then raise exception 'AH_NOT_ALLOWED' using errcode = '42501'; end if;
  if p_kind = 'post' then
    return query select 'post'::text, x.id, left(coalesce(x.body, x.kind), 80) from public.posts x where x.id::text = p_key;
  elsif p_kind = 'profile' then
    return query select 'profile'::text, p.id, '@' || p.username::text from public.profiles p where lower(p.username::text) = lower(p_key);
  elsif p_kind = 'blog' then
    return query select 'blog'::text, b.id, b.title from public.blog_posts b join public.profiles p on p.id = b.author_id
      where lower(p.username::text) = lower(p_key) and b.slug = p_key2;
  elsif p_kind = 'image' then
    return query
      select 'post'::text, x.id, 'Post picture' from public.posts x where x.media @> jsonb_build_array(jsonb_build_object('url', p_key))
      union all select 'guestbook', g.id, 'Guestbook picture' from public.guestbook_entries g where g.image_url = p_key
      union all select 'profile', p.id, '@' || p.username::text || ' profile picture' from public.profiles p where p.avatar_url = p_key
      union all select 'profile', d.id, 'Profile banner/background' from public.profile_details d where d.banner_url = p_key or d.theme ->> 'bg_image' = p_key
      union all select 'blog', b.id, 'Blog cover' from public.blog_posts b where b.cover_url = p_key;
  end if;
end; $$;
revoke execute on function public.mod_find_content(text, text, text) from public, anon;
grant execute on function public.mod_find_content(text, text, text) to authenticated;

-- 4c) Fuller evidence on "Preserve": every kind of content, all of its pictures. Dismissing a report restores
--     anything Sentinel hid.
create or replace function public.mod_resolve(p_report uuid, p_action text, p_note text default null) returns void
language plpgsql security definer set search_path = '' as $$
declare r public.reports; v_me uuid := auth.uid(); v_content jsonb;
begin
  if not app.is_moderator(v_me) then raise exception 'AH_NOT_ALLOWED' using errcode = '42501'; end if;
  if p_action not in ('dismiss', 'remove', 'suspend', 'preserve') then raise exception 'AH_BAD_TARGET' using errcode = '22023'; end if;
  select * into r from public.reports where id = p_report;
  if r.id is null then raise exception 'AH_NOT_FOUND' using errcode = 'P0002'; end if;
  if r.reason = 'child_safety' and p_action in ('remove', 'suspend') then
    raise exception 'AH_USE_PRESERVE' using errcode = '22023', hint = 'Child-safety reports must be preserved, not deleted.';
  end if;

  if p_action = 'preserve' then
    v_content := coalesce(app.content_of(r.target_type, r.target_id),
      (select q.data from app.quarantine q where q.target_type = r.target_type and q.target_id = r.target_id order by q.created_at desc limit 1));
    insert into app.legal_holds (report_id, target_type, target_id, owner_id, owner_username, content, media_paths, moderator_id, note)
    values (r.id, r.target_type, r.target_id, r.target_owner, (select username::text from public.profiles where id = r.target_owner),
            coalesce(v_content ->> 'text', v_content::text),
            array(select jsonb_array_elements_text(coalesce(v_content -> 'images', '[]'::jsonb) || coalesce(v_content -> 'private_images', '[]'::jsonb))),
            v_me, p_note);
    if not exists (select 1 from app.quarantine q where q.target_type = r.target_type and q.target_id = r.target_id and q.restored_at is null) then
      perform app.quarantine_item(r.target_type, r.target_id, 'takedown', r.reason);
    end if;
    if r.target_owner is not null and not app.is_moderator(r.target_owner) then
      update public.profiles set suspended_at = coalesce(suspended_at, now()) where id = r.target_owner;
    end if;
  elsif p_action = 'dismiss' then
    perform app.restore_item(r.target_type, r.target_id, v_me);
  else
    case r.target_type
      when 'post' then update public.posts set hidden_at = now() where id = r.target_id;
      when 'comment' then delete from public.comments where id = r.target_id;
      when 'guestbook' then update public.guestbook_entries set hidden_at = now() where id = r.target_id;
      when 'message' then delete from public.messages where id = r.target_id;
      when 'blog' then update public.blog_posts set status = 'draft' where id = r.target_id;
      when 'bulletin' then delete from public.bulletins where id = r.target_id;
      when 'community' then delete from public.community_posts where id = r.target_id;
      when 'profile' then
        if r.reason = 'music' then update public.profile_details set music = null where id = r.target_id; end if;
      else null;
    end case;
    if r.target_owner is not null then
      insert into public.notifications (user_id, type, data) values (r.target_owner, 'moderation',
        jsonb_build_object('text', case when p_action = 'suspend' then 'Your account was suspended for breaking the community rules.'
                                        when r.reason = 'music' then 'A moderator removed your profile song for breaking the community rules.'
                                        else 'A moderator removed something you posted for breaking the community rules.' end));
    end if;
    if p_action = 'suspend' and r.target_owner is not null and not app.is_moderator(r.target_owner) then
      update public.profiles set suspended_at = now() where id = r.target_owner;
    end if;
  end if;

  update public.reports set status = case when p_action = 'dismiss' then 'dismissed' else 'actioned' end, resolved_by = v_me, resolved_at = now()
  where target_id = r.target_id and status = 'open';
  insert into public.moderation_log (moderator_id, action, target_type, target_id, target_owner, report_id, note)
  values (v_me, p_action, r.target_type, r.target_id, r.target_owner, r.id, p_note);
end; $$;
