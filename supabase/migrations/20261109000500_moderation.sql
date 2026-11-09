-- LateNite — Phase 5: moderation queue + actions, account suspension, report rate limits.

create table public.moderation_log (
  id uuid primary key default gen_random_uuid(),
  moderator_id uuid references public.profiles (id) on delete set null,
  action text not null,
  target_type text,
  target_id uuid,
  target_owner uuid references public.profiles (id) on delete set null,
  report_id uuid references public.reports (id) on delete set null,
  note text check (note is null or char_length(note) <= 500),
  created_at timestamptz not null default now()
);
alter table public.moderation_log enable row level security;
revoke all on public.moderation_log from anon, authenticated;
create policy modlog_select on public.moderation_log for select to authenticated using (app.is_moderator((select auth.uid())));
grant select on public.moderation_log to authenticated;

-- No report spam: 20 per day, and one open report per person per item.
create unique index reports_one_open on public.reports (reporter_id, target_type, target_id) where status = 'open';
create or replace function app.report_rate() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if (select count(*) from public.reports where reporter_id = new.reporter_id and created_at > now() - interval '1 day') >= 20 then
    raise exception 'AH_RATE_LIMIT' using errcode = 'P0001';
  end if;
  return new;
end; $$;
create trigger report_rate before insert on public.reports for each row execute function app.report_rate();

-- Report queue with a preview of what was reported (moderators only).
create or replace function public.mod_reports(p_status text default 'open', p_limit int default 100)
returns table (id uuid, created_at timestamptz, reason text, details text, status text, target_type text, target_id uuid,
               reporter jsonb, owner jsonb, preview text, open_reports_on_target int)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not app.is_moderator(auth.uid()) then raise exception 'AH_NOT_ALLOWED' using errcode = '42501'; end if;
  return query
  select r.id, r.created_at, r.reason, r.details, r.status, r.target_type, r.target_id,
    (select jsonb_build_object('id', p.id, 'username', p.username, 'display_name', p.display_name) from public.profiles p where p.id = r.reporter_id),
    (select jsonb_build_object('id', p.id, 'username', p.username, 'display_name', p.display_name, 'suspended', p.suspended_at is not null) from public.profiles p where p.id = r.target_owner),
    left(case r.target_type
      when 'post' then (select coalesce(x.body, x.kind) from public.posts x where x.id = r.target_id)
      when 'comment' then (select x.body from public.comments x where x.id = r.target_id)
      when 'guestbook' then (select coalesce(x.body, x.sticker, 'image') from public.guestbook_entries x where x.id = r.target_id)
      when 'message' then (select coalesce(x.body, x.kind) from public.messages x where x.id = r.target_id)
      when 'blog' then (select x.title from public.blog_posts x where x.id = r.target_id)
      when 'bulletin' then (select x.body from public.bulletins x where x.id = r.target_id)
      when 'community' then (select x.body from public.community_posts x where x.id = r.target_id)
      when 'profile' then (select p.display_name || ' — ' || coalesce(d.bio, '') from public.profiles p left join public.profile_details d on d.id = p.id where p.id = r.target_id)
    end, 400),
    (select count(*)::int from public.reports o where o.target_id = r.target_id and o.status = 'open')
  from public.reports r
  where r.status = coalesce(p_status, 'open')
  order by r.created_at desc
  limit least(coalesce(p_limit, 100), 300);
end; $$;

-- Resolve a report: dismiss, remove the content, or remove + suspend the owner.
create or replace function public.mod_resolve(p_report uuid, p_action text, p_note text default null) returns void
language plpgsql security definer set search_path = '' as $$
declare r public.reports; v_me uuid := auth.uid();
begin
  if not app.is_moderator(v_me) then raise exception 'AH_NOT_ALLOWED' using errcode = '42501'; end if;
  if p_action not in ('dismiss', 'remove', 'suspend') then raise exception 'AH_BAD_TARGET' using errcode = '22023'; end if;
  select * into r from public.reports where id = p_report;
  if r.id is null then raise exception 'AH_NOT_FOUND' using errcode = 'P0002'; end if;
  if p_action in ('remove', 'suspend') then
    case r.target_type
      when 'post' then update public.posts set hidden_at = now() where id = r.target_id;
      when 'comment' then delete from public.comments where id = r.target_id;
      when 'guestbook' then update public.guestbook_entries set hidden_at = now() where id = r.target_id;
      when 'message' then delete from public.messages where id = r.target_id;
      when 'blog' then update public.blog_posts set status = 'draft' where id = r.target_id;
      when 'bulletin' then delete from public.bulletins where id = r.target_id;
      when 'community' then delete from public.community_posts where id = r.target_id;
      else null;
    end case;
    if r.target_owner is not null then
      insert into public.notifications (user_id, type, data) values (r.target_owner, 'moderation',
        jsonb_build_object('text', case when p_action = 'suspend' then 'Your account was suspended for breaking the community rules.'
                                        else 'A moderator removed something you posted for breaking the community rules.' end));
    end if;
  end if;
  if p_action = 'suspend' and r.target_owner is not null and not app.is_moderator(r.target_owner) then
    update public.profiles set suspended_at = now() where id = r.target_owner;
  end if;
  -- resolving one report resolves every open report on the same item
  update public.reports set status = case when p_action = 'dismiss' then 'dismissed' else 'actioned' end, resolved_by = v_me, resolved_at = now()
  where target_id = r.target_id and status = 'open';
  insert into public.moderation_log (moderator_id, action, target_type, target_id, target_owner, report_id, note)
  values (v_me, p_action, r.target_type, r.target_id, r.target_owner, r.id, p_note);
end; $$;

create or replace function public.mod_set_suspended(p_user uuid, p_suspended boolean, p_note text default null) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not app.is_moderator(auth.uid()) or app.is_moderator(p_user) then raise exception 'AH_NOT_ALLOWED' using errcode = '42501'; end if;
  update public.profiles set suspended_at = case when p_suspended then now() else null end where id = p_user;
  insert into public.moderation_log (moderator_id, action, target_type, target_id, target_owner, note)
  values (auth.uid(), case when p_suspended then 'suspend' else 'unsuspend' end, 'profile', p_user, p_user, p_note);
end; $$;

-- Opt-in Profile of the Week candidates for moderators.
create or replace function public.mod_potw_candidates() returns table (id uuid, username text, display_name text, avatar_url text, friends int)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not app.is_moderator(auth.uid()) then raise exception 'AH_NOT_ALLOWED' using errcode = '42501'; end if;
  return query select p.id, p.username::text, p.display_name, p.avatar_url,
    (select count(*)::int from public.friendships f where p.id in (f.user_a, f.user_b))
  from public.profiles p join public.profile_settings s on s.id = p.id
  where s.potw_opt_in and not p.is_private and p.suspended_at is null
  order by p.created_at desc limit 100;
end; $$;

-- Suspended people can't sign in to do anything new: their writes are already blocked by is_active() checks,
-- and their content disappears for everyone else.

revoke execute on all functions in schema public from public, anon;
grant execute on function public.username_available(text), public.friends_of(uuid, int), public.get_top_friends(uuid), public.visit_stats(uuid),
  public.poll_results(uuid) to anon, authenticated;
grant execute on function public.mod_reports(text, int), public.mod_resolve(uuid, text, text), public.mod_set_suspended(uuid, boolean, text),
  public.mod_potw_candidates() to authenticated;
revoke all on all functions in schema app from public;
grant execute on all functions in schema app to anon, authenticated, service_role;

-- Indexes for every foreign key (fast deletes/cascades and lookups as the site grows).
create index if not exists blog_posts_post on public.blog_posts (post_id);
create index if not exists communities_created_by on public.communities (created_by);
create index if not exists conversations_created_by on public.conversations (created_by);
create index if not exists featured_profiles_profile on public.featured_profiles (profile_id);
create index if not exists friendships_requested_by on public.friendships (requested_by);
create index if not exists modlog_moderator on public.moderation_log (moderator_id);
create index if not exists modlog_report on public.moderation_log (report_id);
create index if not exists modlog_target_owner on public.moderation_log (target_owner);
create index if not exists reports_resolved_by on public.reports (resolved_by);
create index if not exists reports_target_owner on public.reports (target_owner);
create index if not exists user_badges_badge on public.user_badges (badge_key);
