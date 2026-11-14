-- v10.2: invite codes ("keys") for the beta, and SignedOn HQ (the official community everyone is in).

-- ---------------------------------------------------------------------------
-- 1) Invite codes. While invite-only is on, new accounts need a valid code. It's checked inside the database
--    when the account is created, so there's no way around it (not even calling the signup API directly).
-- ---------------------------------------------------------------------------
create table app.settings (
  singleton boolean primary key default true check (singleton),
  invite_only boolean not null default false
);
insert into app.settings (singleton) values (true);
revoke all on app.settings from public, anon, authenticated;

create table app.invite_codes (
  code text primary key check (code ~ '^SO-[A-Z2-9]{4}-[A-Z2-9]{4}$'),
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles (id) on delete set null,
  batch text not null default 'beta' check (char_length(batch) between 1 and 40),
  note text check (note is null or char_length(note) <= 200),
  max_uses int not null default 1 check (max_uses between 1 and 1000),
  uses int not null default 0,
  expires_at timestamptz,
  revoked_at timestamptz
);
create index invite_batch on app.invite_codes (batch, created_at desc);
create table app.invite_redemptions (
  code text not null references app.invite_codes (code) on delete cascade,
  user_id uuid not null,
  redeemed_at timestamptz not null default now(),
  primary key (code, user_id)
);
create index invite_redemptions_user on app.invite_redemptions (user_id);
revoke all on app.invite_codes, app.invite_redemptions from public, anon, authenticated;

create or replace function app.normalize_code(c text) returns text language sql immutable set search_path = '' as $$
  select upper(regexp_replace(btrim(coalesce(c, '')), '\s', '', 'g'));
$$;

create or replace function app.invite_valid(c text) returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from app.invite_codes i where i.code = app.normalize_code(c)
                 and i.revoked_at is null and i.uses < i.max_uses and (i.expires_at is null or i.expires_at > now()));
$$;

-- Runs before any new account is created.
create or replace function app.invite_gate() returns trigger language plpgsql security definer set search_path = '' as $$
declare v_code text := app.normalize_code(new.raw_user_meta_data ->> 'invite_code'); v_ok text;
begin
  if not coalesce((select invite_only from app.settings), false) then return new; end if;
  update app.invite_codes set uses = uses + 1
  where code = v_code and revoked_at is null and uses < max_uses and (expires_at is null or expires_at > now())
  returning code into v_ok;
  if v_ok is null then raise exception 'AH_INVITE_REQUIRED' using errcode = '42501'; end if;
  insert into app.invite_redemptions (code, user_id) values (v_ok, new.id);
  return new;
end; $$;
create trigger aa_invite_gate before insert on auth.users for each row execute function app.invite_gate();

-- Anyone can check a code (the join link and signup form use it). Says nothing else about the code.
create or replace function public.invite_check(p_code text) returns boolean language sql stable security definer set search_path = '' as $$
  select app.invite_valid(p_code);
$$;
create or replace function public.invite_only() returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select invite_only from app.settings), false);
$$;
revoke execute on function public.invite_check(text), public.invite_only() from public;
grant execute on function public.invite_check(text), public.invite_only() to anon, authenticated;

-- Moderators: make a batch of codes.
create or replace function public.mod_create_invites(p_count int, p_batch text default 'beta', p_max_uses int default 1, p_expires_days int default null, p_note text default null)
returns setof text language plpgsql security definer set search_path = '' as $$
declare v_alpha text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; v_code text; v_n int := 0; v_tries int := 0;
begin
  if not app.is_moderator(auth.uid()) then raise exception 'AH_NOT_ALLOWED' using errcode = '42501'; end if;
  if p_count is null or p_count < 1 or p_count > 500 then raise exception 'AH_BAD_TARGET' using errcode = '22023'; end if;
  while v_n < p_count and v_tries < p_count * 5 loop
    v_tries := v_tries + 1;
    v_code := 'SO-' || (select string_agg(substr(v_alpha, 1 + floor(random() * 32)::int, 1), '') from generate_series(1, 4))
           || '-' || (select string_agg(substr(v_alpha, 1 + floor(random() * 32)::int, 1), '') from generate_series(1, 4));
    begin
      insert into app.invite_codes (code, created_by, batch, note, max_uses, expires_at)
      values (v_code, auth.uid(), left(coalesce(nullif(btrim(p_batch), ''), 'beta'), 40), left(p_note, 200), greatest(1, least(coalesce(p_max_uses, 1), 1000)),
              case when p_expires_days is not null then now() + make_interval(days => p_expires_days) end);
      v_n := v_n + 1;
      return next v_code;
    exception when unique_violation then null;
    end;
  end loop;
end; $$;

create or replace function public.mod_invites(p_batch text default null)
returns table (code text, batch text, note text, created_at timestamptz, max_uses int, uses int, expires_at timestamptz, revoked boolean, used_by text[])
language plpgsql stable security definer set search_path = '' as $$
begin
  if not app.is_moderator(auth.uid()) then raise exception 'AH_NOT_ALLOWED' using errcode = '42501'; end if;
  return query select i.code, i.batch, i.note, i.created_at, i.max_uses, i.uses, i.expires_at, i.revoked_at is not null,
    array(select coalesce(p.username::text, '(deleted)') from app.invite_redemptions r left join public.profiles p on p.id = r.user_id
          where r.code = i.code order by r.redeemed_at)
  from app.invite_codes i where p_batch is null or i.batch = p_batch order by i.created_at desc, i.code limit 1000;
end; $$;

create or replace function public.mod_revoke_invite(p_code text) returns void language plpgsql security definer set search_path = '' as $$
begin
  if not app.is_moderator(auth.uid()) then raise exception 'AH_NOT_ALLOWED' using errcode = '42501'; end if;
  update app.invite_codes set revoked_at = coalesce(revoked_at, now()) where code = app.normalize_code(p_code);
end; $$;

create or replace function public.mod_set_invite_only(p_on boolean) returns void language plpgsql security definer set search_path = '' as $$
begin
  if not app.is_moderator(auth.uid()) then raise exception 'AH_NOT_ALLOWED' using errcode = '42501'; end if;
  update app.settings set invite_only = coalesce(p_on, false) where singleton;
  insert into public.moderation_log (moderator_id, action, target_type, target_id, note)
  values (auth.uid(), case when p_on then 'invite_only_on' else 'invite_only_off' end, 'site', auth.uid(), null);
end; $$;
revoke execute on function public.mod_create_invites(int, text, int, int, text), public.mod_invites(text), public.mod_revoke_invite(text), public.mod_set_invite_only(boolean) from public, anon;
grant execute on function public.mod_create_invites(int, text, int, int, text), public.mod_invites(text), public.mod_revoke_invite(text), public.mod_set_invite_only(boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- 2) SignedOn HQ: the official community. The founder owns it, everyone is a member (new people join
--    automatically, and can leave if they want), and it's where announcements, bug threads and ideas go.
-- ---------------------------------------------------------------------------
create or replace function app.ensure_hq() returns uuid language plpgsql security definer set search_path = '' as $$
declare v_f uuid := (select user_id from app.site_founder); v_id uuid;
begin
  select id into v_id from public.communities where slug = 'signedon-hq';
  if v_id is null then
    if v_f is null then return null; end if;
    insert into public.communities (slug, name, description, accent, is_public, created_by)
    values ('signedon-hq', 'SignedOn HQ', 'Official news from the founder, bug threads and what''s coming next. Tell us what you think: every post gets read.', '#FF2D95', true, v_f)
    returning id into v_id;
    insert into public.community_members (community_id, user_id, role) values (v_id, v_f, 'owner');
  end if;
  -- everyone who isn't in yet (only on first setup; people who leave later aren't re-added)
  insert into public.community_members (community_id, user_id, role)
  select v_id, p.id, 'member' from public.profiles p
  where not exists (select 1 from public.community_members m where m.community_id = v_id and m.user_id = p.id)
    and not exists (select 1 from app.hq_left h where h.user_id = p.id);
  return v_id;
end; $$;

create table app.hq_left (user_id uuid primary key, left_at timestamptz not null default now());
revoke all on app.hq_left from public, anon, authenticated;

create or replace function app.on_profile_join_hq() returns trigger language plpgsql security definer set search_path = '' as $$
declare v_id uuid := (select id from public.communities where slug = 'signedon-hq');
begin
  if v_id is not null then
    insert into public.community_members (community_id, user_id, role) values (v_id, new.id, 'member') on conflict do nothing;
  end if;
  return new;
end; $$;
create trigger zz_join_hq after insert on public.profiles for each row execute function app.on_profile_join_hq();

-- remember who left HQ so a later setup run never re-adds them
create or replace function app.on_hq_leave() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from public.communities c where c.id = old.community_id and c.slug = 'signedon-hq') then
    insert into app.hq_left (user_id) values (old.user_id) on conflict do nothing;
  end if;
  return old;
end; $$;
create trigger hq_leave after delete on public.community_members for each row execute function app.on_hq_leave();

-- set up HQ now if the founder is already named; set_site_founder also sets it up from now on
select app.ensure_hq();
create or replace function app.set_site_founder_hq() returns trigger language plpgsql security definer set search_path = '' as $$
begin perform app.ensure_hq(); return new; end; $$;
create trigger founder_hq after insert or update on app.site_founder for each row execute function app.set_site_founder_hq();
