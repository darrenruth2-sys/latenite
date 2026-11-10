-- Founding Backers wall for the coming-soon page. GoFundMe has no public API for donor lists, so Darren adds
-- backers himself (Supabase → Table Editor → backers) — only people who are OK being thanked publicly.
-- Anyone can read the wall; nobody can write to it through the API.

create table public.backers (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 40),
  note text check (note is null or char_length(note) <= 140),
  amount_usd numeric(10, 2) check (amount_usd is null or amount_usd > 0),
  show_amount boolean not null default false,
  created_at timestamptz not null default now()
);
create index backers_recent on public.backers (created_at desc);
alter table public.backers enable row level security;
revoke all on public.backers from anon, authenticated;
create policy backers_read on public.backers for select to anon, authenticated using (true);
grant select (id, name, note, created_at) on public.backers to anon, authenticated;

-- amount only when the backer said it can be shown
create or replace function public.recent_backers(p_limit int default 12)
returns table (id uuid, name text, note text, amount_usd numeric, created_at timestamptz, total bigint)
language sql stable security definer set search_path = '' as $$
  select b.id, b.name, b.note, case when b.show_amount then b.amount_usd end, b.created_at, count(*) over ()
  from public.backers b order by b.created_at desc limit least(greatest(coalesce(p_limit, 12), 1), 50);
$$;
revoke execute on function public.recent_backers(int) from public;
grant execute on function public.recent_backers(int) to anon, authenticated;
