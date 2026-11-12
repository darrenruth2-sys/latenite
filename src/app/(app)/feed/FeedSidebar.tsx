import Link from 'next/link';
import { getMe } from '@/lib/me';
import { Avatar } from '@/components/Avatar';

type Buddy = { id: string; username: string; display_name: string; avatar_url: string | null; status: string; status_message: string | null; now_playing: string | null };
type Mile = { id: string; username: string; display_name: string; avatar_url: string | null; since: string; months: number; kind: string };

export async function FeedSidebar() {
  const { me, supabase } = await getMe();
  if (!me) return null;
  const [buddies, miles, bulletins] = await Promise.all([
    supabase.rpc('buddy_list'), supabase.rpc('friend_milestones'),
    supabase.from('bulletins').select('id, body, author:profiles!bulletins_author_id_fkey(username, display_name)').gt('expires_at', new Date().toISOString()).neq('author_id', me.id).order('created_at', { ascending: false }).limit(4),
  ]);
  const online = ((buddies.data || []) as Buddy[]).filter((b) => b.status !== 'offline').slice(0, 8);
  const ms = (miles.data || []) as Mile[];
  const buls = (bulletins.data || []) as unknown as { id: string; body: string; author: { username: string; display_name: string } }[];
  return (
    <aside className="flex w-full min-w-0 flex-[1_1_280px] flex-col gap-5 lg:max-w-[340px]" aria-label="Friends sidebar">
      <section aria-labelledby="on-h" className="panel flex flex-col gap-1.5 p-4">
        <h2 id="on-h" className="pixel text-[21px] text-lime">ONLINE NOW · {online.length}</h2>
        {online.length === 0 ? <p className="text-sm text-dim">Nobody&apos;s on right now.</p> : online.map((b) => (
          <Link key={b.id} href={`/messenger?to=${b.username}`} className="flex min-h-11 items-center gap-2.5 px-1 hover:bg-panel2">
            <span className="relative"><Avatar user={b} size={32} /><span className={`absolute -bottom-1 -right-1 h-2.5 w-2.5 rounded-full border-2 border-panel ${b.status === 'away' ? 'bg-amber' : b.status === 'busy' ? 'bg-[#E5484D]' : 'bg-lime'}`} /></span>
            <span className="min-w-0"><span className="block truncate text-sm font-semibold">{b.display_name}</span>
              <span className="block truncate text-xs text-dim">{b.now_playing ? `♫ ${b.now_playing}` : b.status_message || b.status}</span></span>
          </Link>
        ))}
      </section>
      {ms.length > 0 && (
        <section aria-labelledby="ann-h" className="flex flex-col gap-2 border-2 border-fg bg-amber p-4 text-ink">
          <h2 id="ann-h" className="pixel text-lg">FRIENDSHIP MILESTONES</h2>
          {ms.slice(0, 3).map((m) => (
            <Link key={m.id} href={`/u/${m.username}#guestbook`} className="flex items-center gap-2.5 font-semibold"><Avatar user={m} size={36} border="#0A0A18" />
              <span className="leading-tight">{m.kind === 'new' ? <>You and {m.display_name} just became friends</> : <>You and {m.display_name}: {m.months >= 12 && m.months % 12 === 0 ? `${m.months / 12} year${m.months === 12 ? '' : 's'}` : `${m.months} month${m.months === 1 ? '' : 's'}`} today</>}
                <span className="block text-xs font-normal underline">Leave a guestbook note</span></span></Link>
          ))}
        </section>
      )}
      <section aria-labelledby="bul-h" className="panel flex flex-col gap-2.5 p-4">
        <div className="flex items-center justify-between"><h2 id="bul-h" className="pixel text-[21px] text-cyan">BULLETINS</h2><Link href="/bulletins" className="link inline-flex min-h-10 items-center text-sm">All / post</Link></div>
        {buls.length === 0 ? <p className="text-sm text-dim">No bulletins from friends.</p> : buls.map((b) => (
          <Link key={b.id} href="/bulletins" className="text-sm leading-snug hover:text-cyan"><b>{b.author?.display_name}</b> — <span className="line-clamp-2 inline">{b.body}</span></Link>
        ))}
      </section>
    </aside>
  );
}
