-- Automatic beta keys: the first N people who sign the waitlist get their own invite code by email.
alter table app.settings add column auto_invite boolean not null default false;
alter table app.settings add column auto_invite_cap int not null default 5000 check (auto_invite_cap between 0 and 100000);

alter table public.waitlist add column invite_code text references app.invite_codes (code) on delete set null;
alter table public.waitlist add column invite_sent_at timestamptz;
alter table public.waitlist add column invite_failed_at timestamptz;
alter table public.waitlist add column unsubscribed_at timestamptz;
create index waitlist_waiting on public.waitlist (created_at) where invite_code is null and unsubscribed_at is null;

create or replace function app.new_invite_code(p_batch text, p_note text) returns text
language plpgsql security definer set search_path = '' as $$
declare v_alpha text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; v_code text;
begin
  loop
    v_code := 'SO-' || (select string_agg(substr(v_alpha, 1 + floor(random() * 32)::int, 1), '') from generate_series(1, 4))
           || '-' || (select string_agg(substr(v_alpha, 1 + floor(random() * 32)::int, 1), '') from generate_series(1, 4));
    begin
      insert into app.invite_codes (code, batch, note) values (v_code, p_batch, left(p_note, 200));
      return v_code;
    exception when unique_violation then null;
    end;
  end loop;
end; $$;

create or replace function app.auto_invites_left() returns int language sql stable security definer set search_path = '' as $$
  select greatest(0, (select auto_invite_cap from app.settings where singleton)
                     - (select count(*)::int from public.waitlist where invite_code is not null));
$$;

-- Server only: give this waitlist email a key if auto-invites are on and there are keys left.
-- Returns the code to email (or null). If an earlier email failed, returns the same code again to retry.
create or replace function public.waitlist_claim_invite(p_email text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare w public.waitlist; v_code text;
begin
  select * into w from public.waitlist where email = lower(btrim(p_email)) for update;
  if w.id is null or w.unsubscribed_at is not null then return null; end if;
  if w.invite_code is not null then
    if w.invite_sent_at is null then return jsonb_build_object('code', w.invite_code, 'name', w.name, 'email', w.email::text); end if;
    return null;
  end if;
  if not coalesce((select auto_invite from app.settings where singleton), false) or app.auto_invites_left() <= 0 then return null; end if;
  v_code := app.new_invite_code('waitlist', 'auto: ' || w.email::text);
  update public.waitlist set invite_code = v_code where id = w.id;
  return jsonb_build_object('code', v_code, 'name', w.name, 'email', w.email::text);
end; $$;

create or replace function public.waitlist_invite_result(p_email text, p_ok boolean) returns void
language sql security definer set search_path = '' as $$
  update public.waitlist set invite_sent_at = case when p_ok then now() else invite_sent_at end,
                             invite_failed_at = case when p_ok then null else now() end
  where email = lower(btrim(p_email));
$$;

create or replace function public.waitlist_unsubscribe(p_email text) returns void
language sql security definer set search_path = '' as $$
  update public.waitlist set unsubscribed_at = coalesce(unsubscribed_at, now()) where email = lower(btrim(p_email));
$$;
revoke execute on function public.waitlist_claim_invite(text), public.waitlist_invite_result(text, boolean), public.waitlist_unsubscribe(text) from public, anon, authenticated;
grant execute on function public.waitlist_claim_invite(text), public.waitlist_invite_result(text, boolean), public.waitlist_unsubscribe(text) to service_role;

-- Moderators: status, on/off + cap, and "send keys to everyone already waiting".
create or replace function public.mod_auto_invite_status() returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not app.is_moderator(auth.uid()) then raise exception 'AH_NOT_ALLOWED' using errcode = '42501'; end if;
  return jsonb_build_object(
    'on', (select auto_invite from app.settings where singleton),
    'cap', (select auto_invite_cap from app.settings where singleton),
    'given', (select count(*) from public.waitlist where invite_code is not null),
    'sent', (select count(*) from public.waitlist where invite_sent_at is not null),
    'failed', (select count(*) from public.waitlist where invite_code is not null and invite_sent_at is null and invite_failed_at is not null),
    'used', (select count(*) from public.waitlist w join app.invite_codes i on i.code = w.invite_code where i.uses > 0),
    'waiting', (select count(*) from public.waitlist where invite_code is null and unsubscribed_at is null),
    'on_list', (select count(*) from public.waitlist));
end; $$;

create or replace function public.mod_set_auto_invite(p_on boolean, p_cap int) returns void language plpgsql security definer set search_path = '' as $$
begin
  if not app.is_moderator(auth.uid()) then raise exception 'AH_NOT_ALLOWED' using errcode = '42501'; end if;
  update app.settings set auto_invite = coalesce(p_on, auto_invite), auto_invite_cap = greatest(0, least(coalesce(p_cap, auto_invite_cap), 100000)) where singleton;
  insert into public.moderation_log (moderator_id, action, target_type, target_id, note)
  values (auth.uid(), 'auto_invite', 'site', auth.uid(), coalesce(p_on::text, '') || ' cap ' || coalesce(p_cap::text, ''));
end; $$;

-- Emails of people already waiting (oldest first) who should get a key now, plus emails whose key failed to send.
create or replace function public.mod_waiting_for_keys(p_limit int default 100) returns setof text language plpgsql security definer set search_path = '' as $$
begin
  if not app.is_moderator(auth.uid()) then raise exception 'AH_NOT_ALLOWED' using errcode = '42501'; end if;
  return query
    (select w.email::text from public.waitlist w where w.invite_code is not null and w.invite_sent_at is null and w.unsubscribed_at is null order by w.created_at)
    union all
    (select w.email::text from public.waitlist w where w.invite_code is null and w.unsubscribed_at is null order by w.created_at
     limit least(app.auto_invites_left(), greatest(1, least(coalesce(p_limit, 100), 200))));
end; $$;
revoke execute on function public.mod_auto_invite_status(), public.mod_set_auto_invite(boolean, int), public.mod_waiting_for_keys(int) from public, anon;
grant execute on function public.mod_auto_invite_status(), public.mod_set_auto_invite(boolean, int), public.mod_waiting_for_keys(int) to authenticated;
create index waitlist_invite_code on public.waitlist (invite_code);
