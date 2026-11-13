'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { Logo } from '@/components/Logo';
import { Avatar } from '@/components/Avatar';
import { logOut } from '@/app/actions/auth';
import type { Me } from '@/lib/me';

type Counts = { notifications: number; requests: number; messages: number };

function Badge({ n }: { n: number }) {
  if (!n) return null;
  return <span className="ml-1 bg-pink px-1.5 text-xs font-bold text-ink">{n > 99 ? '99+' : n}</span>;
}

const Icon = {
  feed: <path d="M3 11l9-7 9 7v9H3z" />,
  chat: <path d="M4 5h16v11H9l-5 4z" />,
  search: <><circle cx="11" cy="11" r="7" /><path d="M20 20l-4-4" /></>,
  me: <><circle cx="12" cy="8" r="4" /><path d="M4 21c1-4 4-6 8-6s7 2 8 6" /></>,
  bell: <><path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4z" /><path d="M10 20h4" /></>,
};
function Svg({ d }: { d: React.ReactNode }) {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">{d}</svg>;
}

export function AppHeader({ me, counts }: { me: Me | null; counts: Counts }) {
  const path = usePathname();
  const [menu, setMenu] = useState(false);
  const active = (href: string) => path === href || path.startsWith(href + '/');
  const myPage = me ? `/u/${me.username}` : '/login';
  const nav = [
    { href: '/feed', label: 'Feed', n: 0, icon: Icon.feed },
    { href: '/messenger', label: 'Messenger', n: counts.messages, icon: Icon.chat },
    { href: '/discover', label: 'Discover', n: 0, icon: Icon.search },
    { href: myPage, label: 'My page', n: 0, icon: Icon.me },
  ];
  return (
    <>
      <header className="sticky top-0 z-30 border-b-2 border-line bg-ink/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1320px] items-center gap-3 px-4 py-2.5 sm:gap-6 sm:px-6">
          <Logo href={me ? '/feed' : '/'} />
          <form action="/discover" className="hidden flex-1 md:block" role="search">
            <label htmlFor="hdr-q" className="sr-only">Search people and interests</label>
            <input id="hdr-q" name="q" className="field max-w-[420px]" placeholder="Search people, interests, communities" />
          </form>
          {me ? (
            <>
              <nav aria-label="Main" className="ml-auto hidden items-center gap-1 md:flex">
                {nav.map((n) => (
                  <Link key={n.label} href={n.href} aria-current={active(n.href) ? 'page' : undefined}
                    className={`flex min-h-11 items-center border-b-[3px] px-3 text-sm font-semibold ${active(n.href) ? 'border-cyan text-fg' : 'border-transparent text-muted hover:text-fg'}`}>
                    {n.label}<Badge n={n.n} />
                  </Link>
                ))}
              </nav>
              <Link href="/notifications" aria-label={`Notifications${counts.notifications + counts.requests ? `, ${counts.notifications + counts.requests} new` : ''}`}
                className="relative ml-auto flex h-11 w-11 items-center justify-center text-muted hover:text-fg md:ml-0">
                <Svg d={Icon.bell} />
                {counts.notifications + counts.requests > 0 && <span className="absolute right-1 top-1 min-w-5 bg-pink px-1 text-center text-[11px] font-bold text-ink">{Math.min(99, counts.notifications + counts.requests)}</span>}
              </Link>
              <div className="relative">
                <button type="button" onClick={() => setMenu((v) => !v)} aria-expanded={menu} aria-haspopup="menu" aria-label="Account menu"
                  className="flex h-11 items-center gap-2 px-1">
                  <Avatar user={me} size={34} />
                </button>
                {menu && (
                  <div role="menu" className="absolute right-0 top-12 z-40 flex w-56 flex-col border-2 border-fg bg-panel py-1 shadow-[6px_6px_0_var(--color-cyan)]"
                    // Close after following a link. Not for Log out: closing removes its form before it can send.
                    onClick={(e) => { if ((e.target as HTMLElement).closest('a')) setMenu(false); }}>
                    <Link role="menuitem" href={myPage} className="px-4 py-2.5 hover:bg-panel2">My page</Link>
                    <Link role="menuitem" href={`/u/${me.username}?edit=1`} className="px-4 py-2.5 hover:bg-panel2">Customize my page</Link>
                    <Link role="menuitem" href="/friends" className="px-4 py-2.5 hover:bg-panel2">Friends <Badge n={counts.requests} /></Link>
                    <Link role="menuitem" href="/blog/new" className="px-4 py-2.5 hover:bg-panel2">Write a blog post</Link>
                    <Link role="menuitem" href="/memories" className="px-4 py-2.5 hover:bg-panel2">Memories</Link>
                    <Link role="menuitem" href="/settings" className="px-4 py-2.5 hover:bg-panel2">Settings &amp; privacy</Link>
                    {me.isModerator && <Link role="menuitem" href="/mod" className="px-4 py-2.5 text-amber hover:bg-panel2">Moderation</Link>}
                    <form action={logOut}><button type="submit" role="menuitem" className="w-full px-4 py-2.5 text-left text-muted hover:bg-panel2">Log out</button></form>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="ml-auto flex items-center gap-2">
              <Link href="/login" className="btn-ghost btn-sm whitespace-nowrap">Log in</Link>
              <Link href="/signup" className="btn-pink btn-sm whitespace-nowrap"><span className="sm:hidden">Join</span><span className="hidden sm:inline">Get your page</span></Link>
            </div>
          )}
        </div>
      </header>
      {me && (
        <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t-2 border-line bg-ink pb-[env(safe-area-inset-bottom)] md:hidden">
          {nav.map((n) => (
            <Link key={n.label} href={n.href} aria-current={active(n.href) ? 'page' : undefined}
              className={`relative flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-semibold ${active(n.href) ? 'text-cyan' : 'text-dim'}`}>
              <Svg d={n.icon} />{n.label === 'My page' ? 'Me' : n.label}
              {n.n > 0 && <span className="absolute right-[22%] top-1.5 bg-pink px-1 text-[10px] font-bold text-ink">{n.n}</span>}
            </Link>
          ))}
        </nav>
      )}
    </>
  );
}
