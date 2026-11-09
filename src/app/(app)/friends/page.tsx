import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getMe } from '@/lib/me';
import { Avatar } from '@/components/Avatar';
import { FriendButton } from '@/components/profile/FriendButton';
import { FriendFilter } from './FriendFilter';
import { timeAgo } from '@/lib/utils';

export const metadata = { title: 'Friends' };
type Card = { id: string; username: string; display_name: string; avatar_url: string | null };

export default async function Friends() {
  const { me, supabase } = await getMe();
  if (!me) redirect('/login');
  const [incoming, outgoing, friends] = await Promise.all([
    supabase.from('friend_requests').select('id, created_at, sender:profiles!friend_requests_sender_id_fkey(id, username, display_name, avatar_url)').eq('recipient_id', me.id).order('created_at', { ascending: false }),
    supabase.from('friend_requests').select('id, created_at, recipient:profiles!friend_requests_recipient_id_fkey(id, username, display_name, avatar_url)').eq('sender_id', me.id).order('created_at', { ascending: false }),
    supabase.rpc('friends_of', { p_user: me.id, p_limit: 500 }),
  ]);
  const inc = (incoming.data || []) as unknown as { id: string; created_at: string; sender: Card }[];
  const out = (outgoing.data || []) as unknown as { id: string; created_at: string; recipient: Card }[];
  const list = (friends.data || []) as (Card & { since: string })[];
  return (
    <div className="mx-auto flex max-w-[900px] flex-col gap-6 px-4 py-6 sm:px-6">
      <h1 className="font-display text-4xl font-extrabold">Friends</h1>
      <section aria-labelledby="inc-h" className="panel flex flex-col gap-3 p-5">
        <h2 id="inc-h" className="label">Friend requests · {inc.length}</h2>
        {inc.length === 0 ? <p className="text-sm text-dim">No new requests.</p> : inc.filter((r) => r.sender).map((r) => (
          <div key={r.id} className="flex flex-wrap items-center gap-3 border-b border-line pb-3">
            <Link href={`/u/${r.sender.username}`} className="flex min-w-0 flex-1 items-center gap-3"><Avatar user={r.sender} size={48} />
              <span className="min-w-0"><b className="block truncate">{r.sender.display_name}</b><span className="text-sm text-dim">@{r.sender.username} · {timeAgo(r.created_at)}</span></span></Link>
            <FriendButton otherId={r.sender.id} rel="incoming" requestId={r.id} name={r.sender.display_name} className="btn-pink btn-sm" />
          </div>
        ))}
      </section>
      {out.length > 0 && (
        <section aria-labelledby="out-h" className="panel flex flex-col gap-3 p-5">
          <h2 id="out-h" className="label">Sent · {out.length}</h2>
          {out.filter((r) => r.recipient).map((r) => (
            <div key={r.id} className="flex flex-wrap items-center gap-3">
              <Link href={`/u/${r.recipient.username}`} className="flex min-w-0 flex-1 items-center gap-3"><Avatar user={r.recipient} size={40} /><b className="truncate">{r.recipient.display_name}</b></Link>
              <FriendButton otherId={r.recipient.id} rel="outgoing" name={r.recipient.display_name} />
            </div>
          ))}
        </section>
      )}
      <section aria-labelledby="all-h" className="flex flex-col gap-3">
        <h2 id="all-h" className="label">All friends · {list.length}</h2>
        {list.length === 0 ? <p className="panel p-5 text-muted">No friends yet. <Link href="/discover" className="link">Find people</Link>.</p> : <FriendFilter friends={list} />}
      </section>
    </div>
  );
}
