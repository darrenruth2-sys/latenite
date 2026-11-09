import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getMe } from '@/lib/me';
import { Avatar } from '@/components/Avatar';
import { CommunityActions, CommunityComposer, CommunityPostMenu } from './CommunityBits';
import { timeAgo } from '@/lib/utils';

type Card = { id: string; username: string; display_name: string; avatar_url: string | null };
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) { const { slug } = await params; return { title: slug }; }

export default async function Community({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { me, supabase } = await getMe();
  const { data: c } = await supabase.from('communities').select('*').eq('slug', slug.toLowerCase()).maybeSingle();
  if (!c) notFound();
  const [members, posts, friends] = await Promise.all([
    supabase.from('community_members').select('role, user:profiles!community_members_user_id_fkey(id, username, display_name, avatar_url)').eq('community_id', c.id).order('joined_at').limit(60),
    supabase.from('community_posts').select('id, body, created_at, author_id, author:profiles!community_posts_author_id_fkey(id, username, display_name, avatar_url)').eq('community_id', c.id).order('created_at', { ascending: false }).limit(50),
    me ? supabase.rpc('friends_of', { p_user: me.id, p_limit: 500 }) : Promise.resolve({ data: [] }),
  ]);
  const mem = (members.data || []) as unknown as { role: string; user: Card }[];
  const myRole = mem.find((m) => m.user?.id === me?.id)?.role || null;
  const isMod = myRole === 'owner' || myRole === 'mod';
  const list = (posts.data || []) as unknown as { id: string; body: string; created_at: string; author_id: string; author: Card }[];
  const invitable = ((friends.data || []) as Card[]).filter((f) => !mem.some((m) => m.user?.id === f.id));
  return (
    <div className="mx-auto flex max-w-[1100px] flex-wrap items-start gap-6 px-4 py-6 sm:px-6">
      <header className="w-full border-2 border-fg bg-panel p-6" style={{ boxShadow: `8px 8px 0 ${c.accent}` }}>
        <p className="pixel text-xl" style={{ color: c.accent }}>{c.is_public ? 'PUBLIC COMMUNITY' : 'PRIVATE COMMUNITY'} · {c.member_count} MEMBER{c.member_count === 1 ? '' : 'S'}</p>
        <h1 className="font-display text-[clamp(32px,5vw,52px)] font-extrabold leading-none">{c.name}</h1>
        {c.description && <p className="mt-2 max-w-2xl whitespace-pre-wrap text-muted">{c.description}</p>}
        <div className="mt-4"><CommunityActions id={c.id} isPublic={c.is_public} role={myRole} loggedIn={!!me} invitable={invitable} /></div>
      </header>
      <section aria-label="Posts" className="flex min-w-0 flex-[999_1_560px] flex-col gap-4">
        {myRole && me && <CommunityComposer id={c.id} meId={me.id} />}
        {list.length === 0 ? <p className="panel p-6 text-muted">No posts yet.{myRole ? ' Say hi!' : ''}</p> : list.map((p) => (
          <article key={p.id} className="panel flex gap-3 p-4">
            <Link href={`/u/${p.author.username}`}><Avatar user={p.author} size={44} /></Link>
            <div className="min-w-0 flex-1"><p><Link href={`/u/${p.author.username}`} className="font-bold hover:text-cyan">{p.author.display_name}</Link> <span className="text-sm text-dim">{timeAgo(p.created_at)}</span></p>
              <p className="mt-1 whitespace-pre-wrap break-words leading-relaxed">{p.body}</p></div>
            <CommunityPostMenu id={p.id} canDelete={p.author_id === me?.id || isMod} meId={me?.id || null} owner={p.author_id} />
          </article>
        ))}
      </section>
      <aside className="flex w-full min-w-0 flex-[1_1_280px] flex-col gap-3 panel p-5" aria-labelledby="mem-h">
        <h2 id="mem-h" className="label">Members</h2>
        <ul className="grid grid-cols-4 gap-2.5">{mem.filter((m) => m.user).map((m) => (
          <li key={m.user.id}><Link href={`/u/${m.user.username}`} className="flex flex-col items-center gap-1 text-center text-xs font-semibold" title={m.role}>
            <Avatar user={m.user} size={52} />{m.role !== 'member' && <span className="pixel text-sm text-amber">{m.role.toUpperCase()}</span>}<span className="w-full truncate">{m.user.display_name}</span></Link></li>))}</ul>
      </aside>
    </div>
  );
}
