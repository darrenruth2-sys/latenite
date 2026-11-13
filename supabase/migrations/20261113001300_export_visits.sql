-- Data export: your own visit history (pages you visited). The visits table stays locked; this returns only your rows.
create or replace function public.my_visit_history() returns table (profile_id uuid, username text, visited_on date, visited_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select v.profile_id, p.username::text, v.visited_on, v.visited_at
  from public.profile_visits v join public.profiles p on p.id = v.profile_id
  where v.visitor_id = (select auth.uid())
  order by v.visited_at desc;
$$;
revoke execute on function public.my_visit_history() from public, anon;
grant execute on function public.my_visit_history() to authenticated;
