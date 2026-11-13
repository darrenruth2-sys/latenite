-- Pictures may only come from SignedOn's own storage (and song artwork only from the music services' image servers).
-- Uploads already work this way; this closes the door on anyone pasting an outside image URL straight into the
-- database (porn, shock images, or third-party "tracking pixels" that would log visitors' IP addresses).

-- A SignedOn upload: our Supabase project's public media bucket (or the local test stack), optionally in one user's folder.
create or replace function app.is_storage_url(u text, owner uuid default null) returns boolean language sql immutable set search_path = '' as $$
  select u is null or (
    char_length(u) <= 500
    and u ~ '^(https://[a-z0-9]+\.supabase\.co|http://(localhost|127\.0\.0\.1):54321)/storage/v1/object/public/media/[0-9a-f-]{36}/[A-Za-z0-9._/-]+$'
    and u !~ '\.\.'
    and (owner is null or split_part(split_part(u, '/storage/v1/object/public/media/', 2), '/', 1) = owner::text));
$$;

-- Song artwork from the official image servers of the four supported services.
create or replace function app.is_music_art(u text) returns boolean language sql immutable set search_path = '' as $$
  select u is null or (char_length(u) <= 500
    and u ~ '^https://([a-z0-9-]+\.)*(scdn\.co|spotifycdn\.com|ytimg\.com|mzstatic\.com|sndcdn\.com)/[^\s"''()<>\\]+$');
$$;

create or replace function app.valid_post_media(m jsonb, owner uuid) returns boolean language sql immutable set search_path = '' as $$
  select not exists (select 1 from jsonb_array_elements(m) e
                     where jsonb_typeof(e) <> 'object' or not app.is_storage_url(e ->> 'url', owner) or (e ->> 'url') is null);
$$;

alter table public.profiles add constraint profiles_avatar_storage check (app.is_storage_url(avatar_url, id));
alter table public.profile_details add constraint profile_details_banner_storage check (app.is_storage_url(banner_url, id));
alter table public.guestbook_entries add constraint guestbook_image_storage check (app.is_storage_url(image_url, author_id));
alter table public.posts add constraint posts_media_storage check (app.valid_post_media(media, author_id));

-- Themes (profile + gallery): background pictures must be SignedOn uploads. Music artwork: official services only.
create or replace function app.valid_theme(t jsonb) returns boolean language sql immutable set search_path = '' as $$
  select jsonb_typeof(t) = 'object'
    and not exists (select 1 from jsonb_object_keys(t) k
                    where k not in ('preset', 'page', 'card', 'text', 'muted', 'line', 'accent', 'on_accent', 'banner_a', 'banner_b',
                                    'pattern', 'font', 'bg_image', 'radius', 'shadow',
                                    'bg_size', 'bg_x', 'bg_y', 'bg_fixed', 'bg_dim', 'banner_x', 'banner_y', 'banner_zoom'))
    and app.is_hex(t -> 'page') and app.is_hex(t -> 'card') and app.is_hex(t -> 'text') and app.is_hex(t -> 'muted')
    and app.is_hex(t -> 'line') and app.is_hex(t -> 'accent') and app.is_hex(t -> 'on_accent')
    and app.is_hex(t -> 'banner_a') and app.is_hex(t -> 'banner_b')
    and coalesce(t ->> 'pattern', 'dots') in ('none', 'dots', 'grid', 'stripes', 'checker', 'scanlines', 'stars', 'hearts')
    and coalesce(t ->> 'font', 'bold') in ('bold', 'serif', 'pixel', 'mono', 'round')
    and coalesce(t ->> 'preset', 'midnight') ~ '^[a-z0-9_-]{1,30}$'
    and coalesce(t ->> 'radius', 'none') in ('none', 'soft', 'round')
    and coalesce(t ->> 'shadow', 'hard') in ('none', 'hard', 'glow')
    and (t -> 'bg_image' is null or jsonb_typeof(t -> 'bg_image') = 'null' or app.is_storage_url(t ->> 'bg_image'))
    and coalesce(t ->> 'bg_size', 'cover') in ('cover', 'contain', 'tile', 'stretch')
    and app.is_int_between(t -> 'bg_x', 0, 100) and app.is_int_between(t -> 'bg_y', 0, 100)
    and app.is_int_between(t -> 'bg_dim', 0, 80)
    and (t -> 'bg_fixed' is null or jsonb_typeof(t -> 'bg_fixed') = 'boolean')
    and app.is_int_between(t -> 'banner_x', 0, 100) and app.is_int_between(t -> 'banner_y', 0, 100)
    and app.is_int_between(t -> 'banner_zoom', 100, 300);
$$;

create or replace function app.valid_music(m jsonb) returns boolean language sql immutable set search_path = '' as $$
  select m is null or jsonb_typeof(m) = 'null' or (
    jsonb_typeof(m) = 'object'
    and not exists (select 1 from jsonb_object_keys(m) k where k not in ('provider', 'url', 'title', 'artist', 'art', 'autoplay'))
    and (m ->> 'provider') in ('spotify', 'youtube', 'apple', 'soundcloud')
    and char_length(m ->> 'url') <= 500
    and (m ->> 'url') ~ '^https://(open\.spotify\.com|(www\.|m\.|music\.)?youtube\.com|youtu\.be|music\.apple\.com|(m\.)?soundcloud\.com)/[^\s"''<>\\]*$'
    and coalesce(char_length(m ->> 'title'), 0) <= 100 and coalesce(char_length(m ->> 'artist'), 0) <= 100
    and (m -> 'art' is null or jsonb_typeof(m -> 'art') = 'null' or app.is_music_art(m ->> 'art'))
    and (m -> 'autoplay' is null or jsonb_typeof(m -> 'autoplay') = 'boolean'));
$$;
