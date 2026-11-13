-- Profile layout controls + music autoplay.
-- Themes may now carry background-picture layout (size, position, scroll, dim) and cover-photo framing (position, zoom).
-- Profile songs may carry an autoplay flag. Everything is still a small, validated set of tokens: never raw CSS.

create or replace function app.is_int_between(v jsonb, lo int, hi int) returns boolean language sql immutable as $$
  select v is null or (jsonb_typeof(v) = 'number' and (v #>> '{}') ~ '^\d{1,3}$' and (v #>> '{}')::int between lo and hi);
$$;

create or replace function app.valid_theme(t jsonb) returns boolean language sql immutable as $$
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
    and (t -> 'bg_image' is null or jsonb_typeof(t -> 'bg_image') = 'null'
         or ((t ->> 'bg_image') ~ '^https?://[^\s"''()<>\\]+$' and char_length(t ->> 'bg_image') <= 500))
    and coalesce(t ->> 'bg_size', 'cover') in ('cover', 'contain', 'tile', 'stretch')
    and app.is_int_between(t -> 'bg_x', 0, 100) and app.is_int_between(t -> 'bg_y', 0, 100)
    and app.is_int_between(t -> 'bg_dim', 0, 80)
    and (t -> 'bg_fixed' is null or jsonb_typeof(t -> 'bg_fixed') = 'boolean')
    and app.is_int_between(t -> 'banner_x', 0, 100) and app.is_int_between(t -> 'banner_y', 0, 100)
    and app.is_int_between(t -> 'banner_zoom', 100, 300);
$$;

create or replace function app.valid_music(m jsonb) returns boolean language sql immutable as $$
  select m is null or jsonb_typeof(m) = 'null' or (
    jsonb_typeof(m) = 'object'
    and not exists (select 1 from jsonb_object_keys(m) k where k not in ('provider', 'url', 'title', 'artist', 'art', 'autoplay'))
    and (m ->> 'provider') in ('spotify', 'youtube', 'apple', 'soundcloud')
    and char_length(m ->> 'url') <= 500
    and (m ->> 'url') ~ '^https://(open\.spotify\.com|(www\.|m\.|music\.)?youtube\.com|youtu\.be|music\.apple\.com|(m\.)?soundcloud\.com)/[^\s"''<>\\]*$'
    and coalesce(char_length(m ->> 'title'), 0) <= 100 and coalesce(char_length(m ->> 'artist'), 0) <= 100
    and (m -> 'art' is null or jsonb_typeof(m -> 'art') = 'null' or ((m ->> 'art') ~ '^https://[^\s"''()<>\\]+$' and char_length(m ->> 'art') <= 500))
    and (m -> 'autoplay' is null or jsonb_typeof(m -> 'autoplay') = 'boolean'));
$$;

alter function app.is_int_between(jsonb, int, int) set search_path = '';
alter function app.valid_theme(jsonb) set search_path = '';
alter function app.valid_music(jsonb) set search_path = '';

-- Custom CSS for power users. Stored as typed; it is ALWAYS cleaned by the app before it reaches a page:
-- scoped to the owner's own profile area, no outside URLs, no screen-covering overlays, no hiding safety buttons.
alter table public.profile_details add column custom_css text check (custom_css is null or char_length(custom_css) <= 20000);
grant update (custom_css) on public.profile_details to authenticated;
