-- Pre-launch "sign the guestbook" list. Emails are private: nobody can read the table through the API;
-- people can only add themselves through join_waitlist(), and the page only gets the total count.

create table public.waitlist (
  id uuid primary key default gen_random_uuid(),
  email extensions.citext not null unique check (char_length(email) <= 254 and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  name text check (name is null or char_length(name) <= 40),
  miss text check (miss is null or char_length(miss) <= 280),
  created_at timestamptz not null default now()
);
alter table public.waitlist enable row level security;
revoke all on public.waitlist from anon, authenticated;

create or replace function public.join_waitlist(p_email text, p_name text default null, p_miss text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_new boolean;
begin
  if p_email is null or char_length(btrim(p_email)) > 254 or btrim(p_email) !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'AH_BAD_EMAIL' using errcode = '22023';
  end if;
  -- crude flood guard for a public form
  if (select count(*) from public.waitlist where created_at > now() - interval '1 minute') >= 30 then
    raise exception 'AH_RATE_LIMIT' using errcode = 'P0001';
  end if;
  insert into public.waitlist (email, name, miss)
  values (lower(btrim(p_email)), nullif(left(btrim(coalesce(p_name, '')), 40), ''), nullif(left(btrim(coalesce(p_miss, '')), 280), ''))
  on conflict (email) do nothing;
  v_new := found;
  return jsonb_build_object('new', v_new, 'count', (select count(*) from public.waitlist));
end; $$;

create or replace function public.waitlist_count() returns bigint language sql stable security definer set search_path = '' as $$
  select count(*) from public.waitlist;
$$;

revoke execute on function public.join_waitlist(text, text, text), public.waitlist_count() from public;
grant execute on function public.join_waitlist(text, text, text), public.waitlist_count() to anon, authenticated;
