import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getMe } from '@/lib/me';
import { Avatar } from '@/components/Avatar';
import { resolveTheme, themeVars } from '@/lib/theme';

export type Shell = Awaited<ReturnType<typeof loadShell>>;
const TABS = [['', 'Page'], ['friends', 'Friends'], ['photos', 'Photos'], ['guestbook', 'Guestbook'], ['blog', 'Blog']] as const;

/** Loads the profile for a section page. The database decides whether the viewer may see it (private pages, blocks). */
export async function loadShell(username: string) {
  const { supabase, me } = await getMe();
  const uname = decodeURIComponent(username).toLowerCase();
  if (!/^[a-z0-9._]{1,20}$/.test(uname)) notFound();
  const { data: profile } = await supabase.from('profiles').select('id, username, display_name, avatar_url, mood').eq('username', uname).maybeSingle();
  if (!profile) notFound();
  const p = { ...profile, username: String(profile.username) };
  const { data: details } = await supabase.from('profile_details').select('theme, guestbook_policy').eq('id', p.id).maybeSingle();
  return { supabase, me, p, details, canSee: !!details, isMe: me?.id === p.id, theme: resolveTheme(details?.theme) };
}

/** Themed frame with the profile's name and section tabs (each tab is its own link, like /u/name/photos). */
export function SectionFrame({ s, active, title, children }: { s: Shell; active: string; title: string; children: React.ReactNode }) {
  const { p } = s;
  return (
    <div style={themeVars(s.theme)} className="min-h-[calc(100dvh-64px)] bg-[var(--pg)] text-[var(--text)]">
      <div className="mx-auto flex max-w-[1100px] flex-col gap-5 px-4 py-6 sm:px-6">
        <header className="flex items-center gap-4 border-2 border-[var(--text)] bg-[var(--card)] p-4 rounded-[var(--radius)]">
          <Link href={`/u/${p.username}`} aria-label={`Back to ${p.display_name}’s page`}><Avatar user={p} size={64} border="var(--text)" /></Link>
          <div className="min-w-0">
            <h1 className="truncate text-[clamp(1.5rem,4vw,2.2rem)] font-extrabold leading-tight" style={{ fontFamily: 'var(--head)' }}>{title}</h1>
            <Link href={`/u/${p.username}`} className="text-sm text-[var(--muted)] hover:underline">{p.display_name} · @{p.username}</Link>
          </div>
        </header>
        <nav aria-label="Profile sections" className="-mx-4 flex gap-1.5 overflow-x-auto px-4">
          {TABS.map(([slug, label]) => {
            const on = slug === active;
            return <Link key={slug} href={`/u/${p.username}${slug ? '/' + slug : ''}`} aria-current={on ? 'page' : undefined}
              className={`inline-flex min-h-10 shrink-0 items-center border-2 border-[var(--text)] px-3 text-sm font-bold ${on ? 'bg-[var(--accent)] text-[var(--on-accent)]' : 'bg-[var(--card)]'}`}>{label}</Link>;
          })}
        </nav>
        {s.canSee ? children : (
          <div className="flex flex-col items-center gap-3 border-2 border-[var(--text)] bg-[var(--card)] p-8 text-center rounded-[var(--radius)]">
            <p className="pixel text-2xl">THIS PAGE IS PRIVATE</p>
            <p className="text-[var(--muted)]">Only {p.display_name}&apos;s friends can see this.</p>
            <Link href={`/u/${p.username}`} className="underline">Go to their page</Link>
          </div>
        )}
      </div>
    </div>
  );
}
