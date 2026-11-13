-- Audit fixes.

-- 1) Founder-at-#1 reorder: ranks may only be 1..16, so the old "+100 then -99" shuffle would fail as soon as
--    someone already had Top Friends. Shift one at a time from the bottom up instead (always into a free slot).
create or replace function app.befriend_founder(u uuid, at_top boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare v_f uuid := (select user_id from app.site_founder); v_rank int; r record;
begin
  if v_f is null or u is null or u = v_f then return; end if;
  if app.is_blocked(u, v_f) then return; end if;
  insert into public.friendships (user_a, user_b, requested_by)
  values (least(u, v_f), greatest(u, v_f), null) on conflict do nothing;
  if exists (select 1 from public.top_friends where owner_id = u and friend_id = v_f) then return; end if;
  if at_top then
    delete from public.top_friends where owner_id = u and rank >= 16;
    for r in select friend_id from public.top_friends where owner_id = u order by rank desc loop
      update public.top_friends set rank = rank + 1 where owner_id = u and friend_id = r.friend_id;
    end loop;
    insert into public.top_friends (owner_id, friend_id, rank) values (u, v_f, 1);
  else
    select coalesce(max(rank), 0) + 1 into v_rank from public.top_friends where owner_id = u;
    if v_rank <= 8 then insert into public.top_friends (owner_id, friend_id, rank) values (u, v_f, v_rank); end if;
  end if;
end; $$;
revoke execute on function app.befriend_founder(uuid, boolean) from public, anon, authenticated;
