import Link from 'next/link';
import { getMe } from '@/lib/me';
import { PRESETS, resolveTheme, patternCss, type ThemeTokens } from '@/lib/theme';
import { UseThemeButton, DeleteThemeButton } from './ThemeButtons';

export const metadata = { title: 'Theme gallery' };
type T = { id: string; name: string; tokens: ThemeTokens; uses_count: number; owner_id: string; owner: { username: string; display_name: string } | null };

function Swatch({ tokens }: { tokens: ThemeTokens }) {
  const t = resolveTheme(tokens); const pat = patternCss(t.pattern, t.text);
  return (
    <div aria-hidden="true" className="flex h-36 flex-col gap-2 p-3" style={{ backgroundColor: t.page, backgroundImage: t.bg_image ? `url("${t.bg_image}")` : pat.image, backgroundSize: t.bg_image ? 'cover' : pat.size }}>
      <div className="h-8" style={{ background: `repeating-linear-gradient(45deg, ${t.banner_a} 0 10px, ${t.banner_b} 10px 20px)`, border: `2px solid ${t.text}` }} />
      <div className="flex flex-1 items-center gap-2 px-2" style={{ background: t.card, border: `2px solid ${t.text}`, color: t.text }}>
        <span className="h-6 w-6" style={{ background: t.accent }} /><span className="text-sm font-bold">Aa</span><span className="text-xs" style={{ color: t.muted }}>your page</span>
      </div>
    </div>
  );
}

export default async function Themes({ searchParams }: { searchParams: Promise<{ sort?: string }> }) {
  const { sort } = await searchParams;
  const { me, supabase } = await getMe();
  const { data } = await supabase.from('profile_themes').select('id, name, tokens, uses_count, owner_id, owner:profiles!profile_themes_owner_id_fkey(username, display_name)')
    .order(sort === 'new' ? 'created_at' : 'uses_count', { ascending: false }).limit(60);
  const list = (data || []) as unknown as T[];
  return (
    <div className="mx-auto flex max-w-[1200px] flex-col gap-6 px-4 py-6 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><p className="pixel text-xl text-amber">&gt; LAYOUTS BY THE COMMUNITY</p><h1 className="font-display text-4xl font-extrabold">Theme gallery</h1>
          <p className="mt-1 text-muted">Pick one and it goes straight onto your page. Make your own in the live editor and hit Share theme.</p></div>
        <div className="flex gap-2"><Link href="/themes" className={sort !== 'new' ? 'btn-cyan btn-sm' : 'btn-ghost btn-sm'}>Popular</Link><Link href="/themes?sort=new" className={sort === 'new' ? 'btn-cyan btn-sm' : 'btn-ghost btn-sm'}>Newest</Link></div>
      </div>
      <h2 className="label">Starter themes</h2>
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {Object.entries(PRESETS).map(([k, p]) => (
          <li key={k} className="flex flex-col border-2 border-line bg-panel"><Swatch tokens={{ preset: k }} />
            <div className="flex items-center justify-between gap-2 p-3"><span className="font-semibold">{p.name}</span>{me && <UseThemeButton preset={k} />}</div></li>
        ))}
      </ul>
      <h2 className="label">Shared by people</h2>
      {list.length === 0 ? <p className="panel p-6 text-muted">Nobody has shared a theme yet. Be the first — open your page editor and press Share theme.</p> : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {list.map((t) => (
            <li key={t.id} className="flex flex-col border-2 border-line bg-panel"><Swatch tokens={t.tokens} />
              <div className="flex flex-col gap-2 p-3">
                <span className="font-semibold">{t.name}</span>
                <span className="text-xs text-dim">by {t.owner ? <Link href={`/u/${t.owner.username}`} className="link">@{t.owner.username}</Link> : 'someone'} · used {t.uses_count}×</span>
                <div className="flex gap-2">{me && <UseThemeButton id={t.id} />}{me?.id === t.owner_id && <DeleteThemeButton id={t.id} />}</div>
              </div></li>
          ))}
        </ul>
      )}
    </div>
  );
}
