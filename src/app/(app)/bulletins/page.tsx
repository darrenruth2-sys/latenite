import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getMe } from '@/lib/me';
import { Avatar } from '@/components/Avatar';
import { timeAgo } from '@/lib/utils';
import { BulletinComposer, DeleteBulletin } from './BulletinBits';

export const metadata = { title: 'Bulletins' };
type B = { id: string; body: string; created_at: string; expires_at: string; author_id: string; author: { id: string; username: string; display_name: string; avatar_url: string | null } };

export default async function Bulletins() {
  const { me, supabase } = await getMe();
  if (!me) redirect('/login');
  const { data } = await supabase.from('bulletins').select('id, body, created_at, expires_at, author_id, author:profiles!bulletins_author_id_fkey(id, username, display_name, avatar_url)')
    .gt('expires_at', new Date().toISOString()).order('created_at', { ascending: false }).limit(100);
  const list = (data || []) as unknown as B[];
  return (
    <div className="mx-auto flex max-w-[780px] flex-col gap-5 px-4 py-6 sm:px-6">
      <div><p className="pixel text-xl text-cyan">&gt; THE BULLETIN BOARD</p><h1 className="font-display text-4xl font-extrabold">Bulletins</h1>
        <p className="mt-1 text-muted">Shout something to all your friends at once. Bulletins disappear after 10 days.</p></div>
      <BulletinComposer meId={me.id} />
      {list.length === 0 ? <p className="panel p-6 text-muted">No bulletins from your friends right now.</p> : (
        <ul className="flex flex-col">
          {list.map((b) => (
            <li key={b.id} className="flex gap-3 border-b-2 border-line py-4">
              <Link href={`/u/${b.author.username}`}><Avatar user={b.author} size={48} /></Link>
              <div className="min-w-0 flex-1">
                <p><Link href={`/u/${b.author.username}`} className="font-bold hover:text-cyan">{b.author.display_name}</Link> <span className="text-sm text-dim">{timeAgo(b.created_at)}</span></p>
                <p className="mt-1 whitespace-pre-wrap break-words text-[17px] leading-relaxed">{b.body}</p>
              </div>
              {b.author_id === me.id && <DeleteBulletin id={b.id} />}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
