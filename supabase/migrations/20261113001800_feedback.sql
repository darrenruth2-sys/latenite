-- Ideas & questions from members and visitors, read by moderators (and emailed to the founder when email is set up).
create table app.feedback (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  user_id uuid references public.profiles (id) on delete set null,
  kind text not null check (kind in ('idea', 'question', 'bug', 'other')),
  message text not null check (char_length(message) between 3 and 4000),
  reply_email text check (reply_email is null or (char_length(reply_email) <= 254 and reply_email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$')),
  page text check (page is null or char_length(page) <= 300),
  source_hash text,
  status text not null default 'new' check (status in ('new', 'read', 'done'))
);
create index feedback_new on app.feedback (status, created_at desc);
revoke all on app.feedback from public, anon, authenticated;

-- Server only (the form's server action), 5 per hour per visitor.
create or replace function public.submit_feedback(p_user uuid, p_kind text, p_message text, p_email text, p_page text, p_source text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if (select count(*) from app.feedback where source_hash = p_source and created_at > now() - interval '1 hour') >= 5 then
    raise exception 'AH_RATE_LIMIT' using errcode = 'P0001';
  end if;
  insert into app.feedback (user_id, kind, message, reply_email, page, source_hash)
  values (p_user, p_kind, btrim(p_message), nullif(lower(btrim(coalesce(p_email, ''))), ''), nullif(left(coalesce(p_page, ''), 300), ''), p_source)
  returning id into v_id;
  return v_id;
end; $$;
revoke execute on function public.submit_feedback(uuid, text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.submit_feedback(uuid, text, text, text, text, text) to service_role;

create or replace function public.mod_feedback(p_status text default 'new')
returns table (id uuid, created_at timestamptz, kind text, message text, reply_email text, page text, status text, username text)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not app.is_moderator(auth.uid()) then raise exception 'AH_NOT_ALLOWED' using errcode = '42501'; end if;
  return query select f.id, f.created_at, f.kind, f.message, f.reply_email, f.page, f.status, p.username::text
    from app.feedback f left join public.profiles p on p.id = f.user_id
    where p_status is null or f.status = p_status order by f.created_at desc limit 200;
end; $$;
create or replace function public.mod_feedback_status(p_id uuid, p_status text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not app.is_moderator(auth.uid()) then raise exception 'AH_NOT_ALLOWED' using errcode = '42501'; end if;
  if p_status not in ('new', 'read', 'done') then raise exception 'AH_BAD_TARGET' using errcode = '22023'; end if;
  update app.feedback set status = p_status where id = p_id;
end; $$;
revoke execute on function public.mod_feedback(text), public.mod_feedback_status(uuid, text) from public, anon;
grant execute on function public.mod_feedback(text), public.mod_feedback_status(uuid, text) to authenticated;
