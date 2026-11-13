import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getMe } from '@/lib/me';
import { Avatar } from '@/components/Avatar';
import { timeAgo } from '@/lib/utils';
import { MarkRead } from './MarkRead';

export const metadata = { title: 'Notifications' };
type N = { id: string; type: string; entity_id: string | null; data: Record<string, string>; read_at: string | null; created_at: string;
  actor: { id: string; username: string; display_name: string; avatar_url: string | null } | null };

function describe(n: N, me: string): [string, string] {
  const u = n.actor ? `/u/${n.actor.username}` : '#';
  switch (n.type) {
    case 'friend_request': return ['sent you a friend request', '/friends'];
    case 'first_friend': return ['is your first friend on SignedOn. Welcome in! 👋', u];
    case 'friend_accepted': return ['accepted your friend request', u];
    case 'comment': return ['commented on your post', `/post/${n.entity_id}`];
    case 'like': return ['liked your post', `/post/${n.entity_id}`];
    case 'guestbook': return ['signed your guestbook', `/u/${me}#guestbook`];
    case 'guestbook_reply': return ['replied in a guestbook', `/u/${n.data.profile || me}#guestbook`];
    case 'visit': return ['visited your page', u];
    case 'nudge': return ['nudged you', `/messenger?c=${n.entity_id}`];
    case 'top_friend': return [`added you to their Top ${n.data.count || ''}`.trim(), u];
    case 'gift': return ['sent you a gift', `/u/${me}#gifts`];
    case 'blog_comment': return ['commented on your blog post', `/post/${n.entity_id}`];
    case 'community_invite': return ['invited you to a community', `/communities/${n.data.slug}`];
    case 'badge': return [`You earned the ${n.data.name} badge`, `/u/${me}`];
    case 'mention': return ['mentioned you', `/post/${n.entity_id}`];
    case 'moderation': return [n.data.text || 'A moderator took action on your content', '/settings/account'];
    default: return ['did something', u];
  }
}

export default async function Notifications() {
  const { me, supabase } = await getMe();
  if (!me) redirect('/login');
  const { data } = await supabase.from('notifications').select('id, type, entity_id, data, read_at, created_at, actor:profiles!notifications_actor_id_fkey(id, username, display_name, avatar_url)')
    .eq('user_id', me.id).order('created_at', { ascending: false }).limit(100);
  const list = (data || []) as unknown as N[];
  const unread = list.some((n) => !n.read_at);
  return (
    <div className="mx-auto flex max-w-[760px] flex-col gap-5 px-4 py-6 sm:px-6">
      <h1 className="font-display text-4xl font-extrabold">Notifications</h1>
      {unread && <MarkRead />}
      {list.length === 0 ? <p className="panel p-6 text-muted">Nothing yet. When friends sign your guestbook, comment or add you, it shows up here.</p> : (
        <ul className="flex flex-col">
          {list.map((n) => {
            const [text, href] = describe(n, me.username);
            return (
              <li key={n.id}>
                <Link href={href} className={`flex items-center gap-3 border-b border-line px-2 py-3 hover:bg-panel2 ${n.read_at ? '' : 'bg-panel'}`}>
                  {n.actor ? <Avatar user={n.actor} size={44} /> : <span className="flex h-11 w-11 items-center justify-center bg-amber pixel text-2xl text-ink">★</span>}
                  <span className="min-w-0 flex-1">{n.actor && n.type !== 'badge' && <b>{n.actor.display_name} </b>}{text}
                    <span className="block text-xs text-dim">{timeAgo(n.created_at)}</span></span>
                  {!n.read_at && <span className="h-2.5 w-2.5 shrink-0 bg-pink" aria-label="unread" />}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
