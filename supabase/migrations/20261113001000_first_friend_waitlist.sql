-- 1) "Tom from MySpace": the site founder is everyone's first friend.
--    Every new account starts friends with the founder, with the founder at #1 in their Top 8.
--    People can re-rank, remove or unfriend the founder like anyone else.
--    Set the founder once with:  select app.set_site_founder('username');

create table app.site_founder (
  singleton boolean primary key default true check (singleton),
  user_id uuid not null references public.profiles (id) on delete cascade,
  set_at timestamptz not null default now()
);
revoke all on app.site_founder from public, anon, authenticated;

update public.badges set name = 'Community Founder' where key = 'founder';
insert into public.badges (key, name, description, color)
values ('site_founder', 'SignedOn Founder', 'Started SignedOn. Everyone''s first friend.', '#FF2D95')
on conflict (key) do update set name = excluded.name, description = excluded.description, color = excluded.color;

-- Make u and the founder friends, and put the founder in u's Top Friends (at #1 for new people).
create or replace function app.befriend_founder(u uuid, at_top boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare v_f uuid := (select user_id from app.site_founder); v_rank int;
begin
  if v_f is null or u is null or u = v_f then return; end if;
  if app.is_blocked(u, v_f) then return; end if;
  insert into public.friendships (user_a, user_b, requested_by)
  values (least(u, v_f), greatest(u, v_f), null) on conflict do nothing;
  if exists (select 1 from public.top_friends where owner_id = u and friend_id = v_f) then return; end if;
  if at_top then
    -- shift everyone down one; drop whoever falls past #16
    delete from public.top_friends where owner_id = u and rank >= 16;
    update public.top_friends set rank = rank + 100 where owner_id = u;
    update public.top_friends set rank = rank - 99 where owner_id = u;
    insert into public.top_friends (owner_id, friend_id, rank) values (u, v_f, 1);
  else
    select coalesce(max(rank), 0) + 1 into v_rank from public.top_friends where owner_id = u;
    if v_rank <= 8 then insert into public.top_friends (owner_id, friend_id, rank) values (u, v_f, v_rank); end if;
  end if;
end; $$;

create or replace function app.on_profile_first_friend() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_f uuid := (select user_id from app.site_founder);
begin
  if v_f is not null and new.id <> v_f then
    perform app.befriend_founder(new.id, true);
    perform app.notify(new.id, v_f, 'first_friend', null);
  end if;
  return null;
end; $$;
-- "zz_" so it runs after the other profile triggers (they fire in name order).
create trigger zz_first_friend after insert on public.profiles for each row execute function app.on_profile_first_friend();

-- One-time setup: name the founder, give the badge, befriend everyone already here
-- (existing people get the founder at the end of their Top 8 if there's room — we don't reshuffle their picks).
create or replace function app.set_site_founder(p_username text) returns int
language plpgsql security definer set search_path = '' as $$
declare v_f uuid; v_n int := 0; r record;
begin
  select id into v_f from public.profiles where username = p_username::extensions.citext;
  if v_f is null then raise exception 'No profile named %', p_username; end if;
  insert into app.site_founder (singleton, user_id) values (true, v_f)
  on conflict (singleton) do update set user_id = excluded.user_id, set_at = now();
  perform app.award(v_f, 'site_founder');
  for r in select id from public.profiles where id <> v_f and suspended_at is null loop
    perform app.befriend_founder(r.id, false); v_n := v_n + 1;
  end loop;
  return v_n;
end; $$;
revoke execute on function app.set_site_founder(text), app.befriend_founder(uuid, boolean), app.on_profile_first_friend() from public, anon, authenticated;

-- 2) Waitlist: the old limit was 30 sign-ups a minute for the WHOLE site, so one bot could lock everyone out.
--    Now each visitor (by a salted, one-way hash of their network address — never the address itself)
--    gets 5 tries per 10 minutes, with a much higher site-wide backstop. Only the server can call it.

create table app.waitlist_attempts (
  source_hash text not null,
  at timestamptz not null default now()
);
create index waitlist_attempts_src on app.waitlist_attempts (source_hash, at);
revoke all on app.waitlist_attempts from public, anon, authenticated;

drop function public.join_waitlist(text, text, text);

create or replace function public.join_waitlist(p_email text, p_name text, p_miss text, p_source text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_new boolean; v_src text := coalesce(nullif(left(p_source, 128), ''), 'unknown');
begin
  if p_email is null or char_length(btrim(p_email)) > 254 or btrim(p_email) !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'AH_BAD_EMAIL' using errcode = '22023';
  end if;
  delete from app.waitlist_attempts where at < now() - interval '1 hour';
  if (select count(*) from app.waitlist_attempts where source_hash = v_src and at > now() - interval '10 minutes') >= 5
     or (select count(*) from app.waitlist_attempts where at > now() - interval '1 minute') >= 600 then
    raise exception 'AH_RATE_LIMIT' using errcode = 'P0001';
  end if;
  insert into app.waitlist_attempts (source_hash) values (v_src);
  insert into public.waitlist (email, name, miss)
  values (lower(btrim(p_email)), nullif(left(btrim(coalesce(p_name, '')), 40), ''), nullif(left(btrim(coalesce(p_miss, '')), 280), ''))
  on conflict (email) do nothing;
  v_new := found;
  return jsonb_build_object('new', v_new, 'count', (select count(*) from public.waitlist));
end; $$;

-- Only the server (service role) can add people now; the page still reads the public count.
revoke execute on function public.join_waitlist(text, text, text, text) from public, anon, authenticated;
grant execute on function public.join_waitlist(text, text, text, text) to service_role;
