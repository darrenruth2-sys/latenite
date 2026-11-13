import Link from 'next/link';
import { getMe } from '@/lib/me';
import { Avatar } from '@/components/Avatar';
import { FriendButton } from '@/components/profile/FriendButton';

export const metadata = { title: 'Discover' };
type R = { id: string; username: string; display_name: string; avatar_url: string | null; mood: string | null; region: string | null; interests: string[]; mutual: number; shared: number; discoverable: boolean };

export default async function Discover({ searchParams }: { searchParams: Promise<{ q?: string; interest?: string; region?: string }> }) {
  const sp = await searchParams;
  const q = (sp.q || '').slice(0, 40), interest = (sp.interest || '').slice(0, 24), region = (sp.region || '').slice(0, 40);
  const { me, supabase } = await getMe();
  const searching = !!(q || interest || region);
  // The header box says "people, interests, communities", so a plain search also matches interests and community names.
  const word = q.trim().replace(/^@/, '');
  const asInterest = !interest && /^[\p{L}\p{N} .&'-]{2,24}$/u.test(word) ? word.toLowerCase() : '';
  const like = `%${word.replace(/[%_\\]/g, (c) => '\\' + c)}%`;
  const [people, byInterest, featured, comms, myDisc] = await Promise.all([
    me ? supabase.rpc('discover_people', { p_q: q || null, p_interest: interest || null, p_region: region || null, p_limit: 36 }) : Promise.resolve({ data: [] }),
    me && asInterest ? supabase.rpc('discover_people', { p_q: null, p_interest: asInterest, p_region: region || null, p_limit: 36 }) : Promise.resolve({ data: [] }),
    supabase.from('featured_profiles').select('note, week_of, profile:profiles!featured_profiles_profile_id_fkey(id, username, display_name, avatar_url, mood)').order('week_of', { ascending: false }).limit(3),
    word
      ? supabase.from('communities').select('slug, name, member_count, accent').eq('is_public', true).ilike('name', like).order('member_count', { ascending: false }).limit(12)
      : supabase.from('communities').select('slug, name, member_count, accent').eq('is_public', true).order('member_count', { ascending: false }).limit(6),
    me ? supabase.from('profiles').select('discoverable').eq('id', me.id).single() : Promise.resolve({ data: null }),
  ]);
  const seen = new Set<string>();
  const results = [...((people.data || []) as R[]), ...((byInterest.data || []) as R[])].filter((r) => !seen.has(r.id) && !!seen.add(r.id));
  const feat = (featured.data || []) as unknown as { note: string | null; profile: R }[];
  return (
    <div className="mx-auto flex max-w-[1200px] flex-col gap-7 px-4 py-6 sm:px-6">
      <div><p className="pixel text-xl text-lime">&gt; NO ALGORITHM. JUST FILTERS.</p><h1 className="font-display text-4xl font-extrabold">Discover people</h1>
        <p className="mt-1 text-muted">Search by name, or find people who opted in by interest and region. Sorted by friends in common, then shared interests.</p></div>
      {me && myDisc.data && !myDisc.data.discoverable && <p className="border-2 border-dashed border-violet p-3 text-sm text-muted">You&apos;re not discoverable, so you won&apos;t show up in interest searches. <Link href="/settings/privacy" className="link">Change that</Link></p>}
      <form className="grid gap-2.5 sm:grid-cols-[2fr_1fr_1fr_auto]" role="search">
        <label className="sr-only" htmlFor="dq">Name or username</label><input id="dq" name="q" defaultValue={q} className="field" placeholder="Name or @username" />
        <label className="sr-only" htmlFor="di">Interest</label><input id="di" name="interest" defaultValue={interest} className="field" placeholder="Interest (e.g. vinyl)" />
        <label className="sr-only" htmlFor="dr">Region</label><input id="dr" name="region" defaultValue={region} className="field" placeholder="Region (e.g. Ohio)" />
        <button className="btn-cyan">Search</button>
      </form>
      {!me ? <p className="panel p-6 text-muted"><Link href="/login?next=/discover" className="link">Log in</Link> to search for people.</p> : (
        <section aria-labelledby="res-h" className="flex flex-col gap-3">
          <h2 id="res-h" className="label">{searching ? `Results · ${results.length}` : 'People you might know'}</h2>
          {results.length === 0 ? <p className="panel p-6 text-muted">{searching ? 'Nobody matches that yet.' : 'No suggestions yet. Try searching by an interest.'}</p> : (
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {results.map((r) => (
                <li key={r.id} className="panel flex flex-col gap-3 p-4">
                  <Link href={`/u/${r.username}`} className="flex items-center gap-3"><Avatar user={r} size={60} />
                    <span className="min-w-0"><span className="block truncate font-bold">{r.display_name}</span><span className="text-sm text-dim">@{r.username}{r.region ? ` · ${r.region}` : ''}</span></span></Link>
                  <p className="text-sm text-muted">{r.mutual > 0 ? `${r.mutual} friend${r.mutual === 1 ? '' : 's'} in common` : 'No friends in common yet'}{r.shared > 0 ? ` · ${r.shared} shared interest${r.shared === 1 ? '' : 's'}` : ''}</p>
                  {r.interests.length > 0 && <ul className="flex flex-wrap gap-1">{r.interests.slice(0, 5).map((i) => <li key={i}><Link href={`/discover?interest=${encodeURIComponent(i)}`} className="chip text-xs">{i}</Link></li>)}</ul>}
                  <div className="mt-auto"><FriendButton otherId={r.id} rel="none" name={r.display_name} className="btn-pink btn-sm" /></div>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
      {feat.length > 0 && (
        <section aria-labelledby="potw-h" className="flex flex-col gap-3">
          <h2 id="potw-h" className="label text-amber">Profile of the week</h2>
          <ul className="grid gap-4 sm:grid-cols-3">{feat.filter((f) => f.profile).map((f) => (
            <li key={f.profile.id}><Link href={`/u/${f.profile.username}`} className="flex items-center gap-3 border-2 border-amber bg-panel p-4 shadow-[6px_6px_0_var(--color-amber)]"><Avatar user={f.profile} size={56} />
              <span><b className="block">{f.profile.display_name}</b><span className="text-sm text-muted">{f.note || 'Featured this week'}</span></span></Link></li>))}</ul>
        </section>
      )}
      {word && (comms.data || []).length === 0 && <p className="text-sm text-muted">No communities match “{word}”. <Link href="/communities/new" className="link">Start one</Link>?</p>}
      {(comms.data || []).length > 0 && (
        <section aria-labelledby="dc-h" className="flex flex-col gap-3">
          <div className="flex items-center justify-between"><h2 id="dc-h" className="label">{word ? `Communities matching “${word}”` : 'Communities'}</h2><Link href="/communities" className="link inline-flex min-h-10 items-center text-sm">See all</Link></div>
          <ul className="flex flex-wrap gap-2">{(comms.data || []).map((c) => <li key={c.slug}><Link href={`/communities/${c.slug}`} className="chip min-h-10 px-3" style={{ borderColor: c.accent }}>{c.name} · {c.member_count}</Link></li>)}</ul>
        </section>
      )}
    </div>
  );
}
