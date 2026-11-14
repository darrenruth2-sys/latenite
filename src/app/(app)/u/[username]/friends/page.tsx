import Link from 'next/link';
import type { Metadata } from 'next';
import { Avatar } from '@/components/Avatar';
import { loadShell, SectionFrame } from '../shell';

type Params = { params: Promise<{ username: string }> };
export async function generateMetadata({ params }: Params): Promise<Metadata> { return { title: `@${decodeURIComponent((await params).username).toLowerCase()} · Friends` }; }

export default async function FriendsSection({ params }: Params) {
  const s = await loadShell((await params).username);
  const { data } = s.canSee ? await s.supabase.rpc('friends_of', { p_user: s.p.id, p_limit: 500 }) : { data: [] };
  const friends = (data || []) as { id: string; username: string; display_name: string; avatar_url: string | null; mood: string | null }[];
  const first = s.p.display_name.split(' ')[0];
  return (
    <SectionFrame s={s} active="friends" title={`${first}’s friends · ${friends.length}`}>
      {friends.length === 0 ? <p className="text-[var(--muted)]">No friends yet.</p> : (
        <ul className="grid grid-cols-3 gap-3 sm:grid-cols-5 lg:grid-cols-6">
          {friends.map((f) => (
            <li key={f.id}>
              <Link href={`/u/${f.username}`} className="flex flex-col gap-1.5 border-2 border-[var(--text)] bg-[var(--card)] p-2 text-sm font-semibold rounded-[var(--radius)] hover:bg-[var(--accent)] hover:text-[var(--on-accent)]">
                <Avatar user={f} size={120} border="var(--text)" className="!h-auto !w-full aspect-square" />
                <span className="truncate">{f.display_name}</span>
                <span className="truncate text-xs font-normal opacity-75">@{f.username}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </SectionFrame>
  );
}
