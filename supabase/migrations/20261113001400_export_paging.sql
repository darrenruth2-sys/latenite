-- Data export: complete, paged lists. friends_of caps at 500 and my_visitors at 50 (they power the UI), so exports
-- use these instead, a page at a time, with no total cap. Same privacy rules as the UI versions.
create or replace function public.export_my_friends(p_offset int, p_limit int)
returns table (id uuid, username text, display_name text, since timestamptz)
language sql stable security definer set search_path = '' as $$
  select p.id, p.username::text, p.display_name, f.created_at
  from public.friendships f
  join public.profiles p on p.id = case when f.user_a = (select auth.uid()) then f.user_b else f.user_a end
  where (select auth.uid()) in (f.user_a, f.user_b)
  order by f.created_at desc, p.id
  offset greatest(coalesce(p_offset, 0), 0) limit least(greatest(coalesce(p_limit, 1000), 1), 1000);
$$;

create or replace function public.export_my_visitors(p_offset int, p_limit int)
returns table (id uuid, username text, visited_on date, visited_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select p.id, p.username::text, v.visited_on, v.visited_at
  from public.profile_visits v join public.profiles p on p.id = v.visitor_id
  where v.profile_id = (select auth.uid()) and not app.browsing_privately((select auth.uid()))
    and p.suspended_at is null and not app.is_blocked((select auth.uid()), p.id)
  order by v.visited_at desc, p.id
  offset greatest(coalesce(p_offset, 0), 0) limit least(greatest(coalesce(p_limit, 1000), 1), 1000);
$$;
revoke execute on function public.export_my_friends(int, int), public.export_my_visitors(int, int) from public, anon;
grant execute on function public.export_my_friends(int, int), public.export_my_visitors(int, int) to authenticated;
