-- Legal safety: TAKE IT DOWN Act (48-hour removal of non-consensual intimate images), child-safety evidence
-- preservation for NCMEC reports (18 U.S.C. 2258A; keep at least 1 year), and DMCA copyright notices.

-- 1) New report reasons
alter table public.reports drop constraint if exists reports_reason_check;
alter table public.reports add constraint reports_reason_check check (reason in
  ('spam', 'harassment', 'hate', 'sexual', 'violence', 'self_harm', 'impersonation', 'underage', 'other',
   'intimate_image', 'child_safety', 'copyright'));

-- 2) Evidence held for legal reasons. Never readable by users, never auto-deleted.
create table app.legal_holds (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  report_id uuid,
  target_type text not null,
  target_id uuid not null,
  owner_id uuid,
  owner_username text,
  content text,
  media_paths text[],
  moderator_id uuid,
  note text
);
revoke all on app.legal_holds from public, anon, authenticated;

-- 3) Takedown requests from anyone (no account needed): intimate images, copyright, impersonation, privacy, other.
create table app.takedown_requests (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  kind text not null check (kind in ('intimate_image', 'child_safety', 'copyright', 'impersonation', 'privacy', 'other')),
  urls text not null check (char_length(urls) between 1 and 4000),
  description text not null check (char_length(description) between 1 and 5000),
  requester_name text not null check (char_length(requester_name) between 1 and 200),
  requester_email text not null check (char_length(requester_email) between 3 and 254),
  requester_contact text check (requester_contact is null or char_length(requester_contact) <= 1000),
  is_subject boolean not null default false,
  sworn boolean not null default false,
  signature text check (signature is null or char_length(signature) <= 200),
  source_hash text,
  status text not null default 'open' check (status in ('open', 'removed', 'rejected', 'reported')),
  resolved_by uuid,
  resolved_at timestamptz,
  note text,
  due_at timestamptz  -- 48-hour legal clock for intimate-image and child-safety requests (set on submit)
);
create index takedown_open on app.takedown_requests (status, created_at);
revoke all on app.takedown_requests from public, anon, authenticated;

-- Server-only (the form's server action), with a per-visitor limit.
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
          case when p_kind in ('intimate_image', 'child_safety') then now() + interval '48 hours' end)
  returning id into v_id;
  return v_id;
end; $$;
revoke execute on function public.submit_takedown(text, text, text, text, text, text, boolean, boolean, text, text) from public, anon, authenticated;
grant execute on function public.submit_takedown(text, text, text, text, text, text, boolean, boolean, text, text) to service_role;

create or replace function public.mod_takedowns(p_status text default 'open')
returns setof app.takedown_requests language plpgsql stable security definer set search_path = '' as $$
begin
  if not app.is_moderator(auth.uid()) then raise exception 'AH_NOT_ALLOWED' using errcode = '42501'; end if;
  return query select * from app.takedown_requests where status = coalesce(p_status, 'open')
    order by (due_at is null), due_at, created_at limit 300;
end; $$;

create or replace function public.mod_resolve_takedown(p_id uuid, p_status text, p_note text default null) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not app.is_moderator(auth.uid()) then raise exception 'AH_NOT_ALLOWED' using errcode = '42501'; end if;
  if p_status not in ('removed', 'rejected', 'reported', 'open') then raise exception 'AH_BAD_TARGET' using errcode = '22023'; end if;
  update app.takedown_requests set status = p_status, resolved_by = auth.uid(), resolved_at = case when p_status = 'open' then null else now() end,
    note = coalesce(p_note, note) where id = p_id;
  insert into public.moderation_log (moderator_id, action, target_type, target_id, note) values (auth.uid(), 'takedown_' || p_status, 'takedown', p_id, p_note);
end; $$;

create or replace function public.mod_urgent_count() returns int language sql stable security definer set search_path = '' as $$
  select case when app.is_moderator(auth.uid()) then
    (select count(*)::int from app.takedown_requests where status = 'open' and kind in ('intimate_image', 'child_safety'))
    + (select count(*)::int from public.reports where status = 'open' and reason in ('intimate_image', 'child_safety'))
  else 0 end;
$$;
revoke execute on function public.mod_takedowns(text), public.mod_resolve_takedown(uuid, text, text), public.mod_urgent_count() from public, anon;
grant execute on function public.mod_takedowns(text), public.mod_resolve_takedown(uuid, text, text), public.mod_urgent_count() to authenticated;

-- 4) Report queue: urgent legal reasons first.
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
    left(app.report_preview(r.target_type, r.target_id), 400),
    (select count(*)::int from public.reports o where o.target_id = r.target_id and o.status = 'open')
  from public.reports r
  where r.status = coalesce(p_status, 'open')
  order by (r.reason in ('child_safety', 'intimate_image')) desc, r.created_at desc
  limit least(coalesce(p_limit, 100), 300);
end; $$;

create or replace function app.report_preview(p_type text, p_id uuid) returns text language sql stable security definer set search_path = '' as $$
  select case p_type
    when 'post' then (select coalesce(x.body, x.kind) from public.posts x where x.id = p_id)
    when 'comment' then (select x.body from public.comments x where x.id = p_id)
    when 'guestbook' then (select coalesce(x.body, x.sticker, 'image') from public.guestbook_entries x where x.id = p_id)
    when 'message' then (select coalesce(x.body, x.kind) from public.messages x where x.id = p_id)
    when 'blog' then (select x.title from public.blog_posts x where x.id = p_id)
    when 'bulletin' then (select x.body from public.bulletins x where x.id = p_id)
    when 'community' then (select x.body from public.community_posts x where x.id = p_id)
    when 'profile' then (select p.display_name || ' — ' || coalesce(d.bio, '') from public.profiles p left join public.profile_details d on d.id = p.id where p.id = p_id)
  end;
$$;
revoke execute on function app.report_preview(text, uuid) from public, anon, authenticated;

-- 5) Resolve: new 'preserve' action for child-safety reports. It saves evidence, hides the content and suspends the
--    account WITHOUT deleting anything (the law requires preserving it for NCMEC). 'remove' is refused on those reports.
create or replace function public.mod_resolve(p_report uuid, p_action text, p_note text default null) returns void
language plpgsql security definer set search_path = '' as $$
declare r public.reports; v_me uuid := auth.uid(); v_media text[];
begin
  if not app.is_moderator(v_me) then raise exception 'AH_NOT_ALLOWED' using errcode = '42501'; end if;
  if p_action not in ('dismiss', 'remove', 'suspend', 'preserve') then raise exception 'AH_BAD_TARGET' using errcode = '22023'; end if;
  select * into r from public.reports where id = p_report;
  if r.id is null then raise exception 'AH_NOT_FOUND' using errcode = 'P0002'; end if;
  if r.reason = 'child_safety' and p_action in ('remove', 'suspend') then
    raise exception 'AH_USE_PRESERVE' using errcode = '22023', hint = 'Child-safety reports must be preserved, not deleted.';
  end if;

  if p_action = 'preserve' then
    v_media := case r.target_type
      when 'message' then (select array_remove(array[x.media_path], null) from public.messages x where x.id = r.target_id)
      when 'post' then (select array(select jsonb_array_elements(x.media)::text) from public.posts x where x.id = r.target_id)
      else null end;
    insert into app.legal_holds (report_id, target_type, target_id, owner_id, owner_username, content, media_paths, moderator_id, note)
    values (r.id, r.target_type, r.target_id, r.target_owner, (select username::text from public.profiles where id = r.target_owner),
            app.report_preview(r.target_type, r.target_id), v_media, v_me, p_note);
    -- hide (never delete) what can be hidden; suspension hides everything else the owner posted
    case r.target_type
      when 'post' then update public.posts set hidden_at = now() where id = r.target_id;
      when 'guestbook' then update public.guestbook_entries set hidden_at = now() where id = r.target_id;
      when 'blog' then update public.blog_posts set status = 'draft' where id = r.target_id;
      else null;
    end case;
    if r.target_owner is not null and not app.is_moderator(r.target_owner) then
      update public.profiles set suspended_at = coalesce(suspended_at, now()) where id = r.target_owner;
    end if;
  elsif p_action in ('remove', 'suspend') then
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
    if p_action = 'suspend' and r.target_owner is not null and not app.is_moderator(r.target_owner) then
      update public.profiles set suspended_at = now() where id = r.target_owner;
    end if;
  end if;

  update public.reports set status = case when p_action = 'dismiss' then 'dismissed' else 'actioned' end, resolved_by = v_me, resolved_at = now()
  where target_id = r.target_id and status = 'open';
  insert into public.moderation_log (moderator_id, action, target_type, target_id, target_owner, report_id, note)
  values (v_me, p_action, r.target_type, r.target_id, r.target_owner, r.id, p_note);
end; $$;
