import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getMe } from '@/lib/me';
import { PRESETS, resolveTheme, type ThemeTokens } from '@/lib/theme';
import { Avatar } from '@/components/Avatar';
import { RestoreLook } from './RestoreLook';

export const metadata = { title: 'Memories' };

export default async function Memories() {
  const { me, supabase } = await getMe();
  if (!me) redirect('/login');
  const [looks, posts, friends] = await Promise.all([
    supabase.from('theme_history').select('id, theme, music, changed_at').eq('owner_id', me.id).order('changed_at', { ascending: false }).limit(30),
    supabase.from('posts').select('id, body, kind, created_at, meta').eq('author_id', me.id).in('kind', ['status', 'photo', 'blog']).order('created_at', { ascending: true }).limit(500),
    supabase.rpc('friends_of', { p_user: me.id, p_limit: 500 }),
  ]);
  const byMonth = new Map<string, { id: string; body: string | null; kind: string; created_at: string; meta: Record<string, string> }[]>();
  for (const p of posts.data || []) { const k = new Date(p.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }); byMonth.set(k, [...(byMonth.get(k) || []), p]); }
  const fl = ((friends.data || []) as { id: string; username: string; display_name: string; avatar_url: string | null; since: string }[]).slice().reverse();
  return (
    <div className="mx-auto flex max-w-[960px] flex-col gap-8 px-4 py-6 sm:px-6">
      <div><p className="pixel text-xl text-pink">&gt; REMEMBER WHEN</p><h1 className="font-display text-4xl font-extrabold">Memories</h1></div>
      <section aria-labelledby="looks-h" className="flex flex-col gap-3">
        <h2 id="looks-h" className="label">Your past looks</h2>
        {!looks.data?.length ? <p className="panel p-5 text-muted">Every time you change your theme or song, the old one lands here.</p> : (
          <ul className="grid gap-3 sm:grid-cols-3">{looks.data.map((l) => { const t = resolveTheme(l.theme as ThemeTokens); return (
            <li key={l.id} className="flex flex-col border-2 border-line bg-panel">
              <div aria-hidden="true" className="flex h-20 items-center gap-2 px-3" style={{ background: t.page }}><span className="h-10 flex-1" style={{ background: t.card, border: `2px solid ${t.text}` }} /><span className="h-10 w-10" style={{ background: t.accent }} /></div>
              <div className="flex flex-col gap-1.5 p-3 text-sm"><b>{PRESETS[t.preset]?.name || 'Custom'}</b>
                {l.music && (l.music as { title?: string }).title && <span className="text-muted">♫ {(l.music as { title?: string }).title}</span>}
                <span className="text-xs text-dim">until {new Date(l.changed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                <RestoreLook theme={l.theme} music={l.music} username={me.username} /></div>
            </li>); })}</ul>
        )}
      </section>
      <section aria-labelledby="fm-h" className="flex flex-col gap-3">
        <h2 id="fm-h" className="label">Friendship timeline</h2>
        {fl.length === 0 ? <p className="panel p-5 text-muted">Your friendships will show up here.</p> : (
          <ol className="flex flex-col border-l-4 border-pink pl-5">{fl.map((f) => (
            <li key={f.id} className="relative py-2.5 before:absolute before:-left-[30px] before:top-5 before:h-3.5 before:w-3.5 before:bg-pink">
              <Link href={`/u/${f.username}`} className="flex items-center gap-3"><Avatar user={f} size={36} /><span><b>{f.display_name}</b> <span className="text-sm text-dim">friends since {new Date(f.since).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</span></span></Link></li>))}</ol>
        )}
      </section>
      <section aria-labelledby="pm-h" className="flex flex-col gap-3">
        <h2 id="pm-h" className="label">Your posts by month</h2>
        {byMonth.size === 0 ? <p className="panel p-5 text-muted">Nothing yet. Future you will thank present you for posting.</p> : (
          [...byMonth.entries()].reverse().map(([m, list]) => (
            <details key={m} className="panel p-4" open={false}><summary className="cursor-pointer font-display text-xl font-extrabold">{m} <span className="text-sm font-normal text-dim">· {list.length} post{list.length === 1 ? '' : 's'}</span></summary>
              <ul className="mt-3 flex flex-col gap-2">{list.map((p) => <li key={p.id}><Link href={`/post/${p.id}`} className="block border-l-2 border-line pl-3 text-muted hover:text-fg">{p.kind === 'blog' ? `Blog: ${p.meta.title}` : p.body || (p.kind === 'photo' ? 'Photos' : 'Post')}</Link></li>)}</ul></details>
          ))
        )}
      </section>
    </div>
  );
}
