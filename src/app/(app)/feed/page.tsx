import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getMe } from '@/lib/me';
import { Avatar } from '@/components/Avatar';
import { PostComposer } from '@/components/feed/PostComposer';
import { FeedList } from '@/components/feed/FeedList';
import { POST_SELECT, enrichPosts, type FeedPost } from '@/lib/posts';
import { moodColor } from '@/lib/moods';
import { FeedSidebar } from './FeedSidebar';

export const metadata = { title: 'Feed' };

export default async function FeedPage({ searchParams }: { searchParams: Promise<{ tab?: string; notice?: string }> }) {
  const { me, supabase, counts } = await getMe();
  if (!me) redirect('/login');
  const { tab, notice } = await searchParams;
  const discover = tab === 'discover';
  let discoverOn = false;
  if (discover) {
    const { data } = await supabase.from('profile_settings').select('discover_feed').eq('id', me.id).single();
    discoverOn = !!data?.discover_feed;
  }
  const { data, error } = discover
    ? (discoverOn ? await supabase.rpc('discover_feed', { p_limit: 20 }).select(POST_SELECT) : { data: [], error: null })
    : await supabase.rpc('friend_feed', { p_limit: 20 }).select(POST_SELECT);
  const posts = await enrichPosts(supabase, ((data || []) as unknown as FeedPost[]), me.id);
  const tabCls = (on: boolean) => `flex min-h-11 items-center px-4 text-[15px] font-bold ${on ? 'bg-fg text-ink' : 'text-fg hover:bg-panel2'}`;
  return (
    <div className="mx-auto flex max-w-[1320px] flex-wrap items-start gap-6 px-4 py-6 sm:px-6">
      <aside className="hidden w-full max-w-[270px] flex-col gap-4 lg:flex">
        <Link href={`/u/${me.username}`} className="panel flex items-center gap-3 p-3">
          <Avatar user={me} size={52} online />
          <span className="min-w-0"><span className="block truncate font-bold">{me.display_name}</span>
            {me.mood && <span className="pixel text-lg" style={{ color: moodColor(me.mood) }}>mood: {me.mood}</span>}</span>
        </Link>
        <nav aria-label="Feed sections" className="flex flex-col">
          {[
            ['/feed', 'Friends feed', 0], ['/friends', 'Friends', counts.requests], ['/bulletins', 'Bulletins', 0], ['/blog/new', 'Write a blog post', 0],
            ['/communities', 'Communities', 0], ['/themes', 'Theme gallery', 0], ['/memories', 'Memories', 0],
          ].map(([href, label, n]) => (
            <Link key={href as string} href={href as string} className={`flex min-h-11 items-center justify-between border-l-4 px-3 font-semibold hover:bg-panel2 ${href === '/feed' ? 'border-cyan bg-panel2' : 'border-transparent text-muted'}`}>
              {label}{(n as number) > 0 && <span className="bg-pink px-1.5 text-xs font-bold text-ink">{n as number}</span>}
            </Link>
          ))}
        </nav>
      </aside>
      <section className="flex min-w-0 flex-[999_1_560px] flex-col gap-5" aria-label="Feed">
        {notice === 'password' && <p role="status" className="border-2 border-lime px-3 py-2 text-sm text-lime">Password updated.</p>}
        <PostComposer meId={me.id} name={me.display_name.split(' ')[0]} defaultMood={me.mood} />
        <div role="tablist" aria-label="Feed type" className="flex self-start border-2 border-fg">
          <Link role="tab" aria-selected={!discover} href="/feed" className={tabCls(!discover)}>Friends · newest first</Link>
          <Link role="tab" aria-selected={discover} href="/feed?tab=discover" className={`${tabCls(discover)} ${discover ? '!bg-violet' : ''}`}>Discover</Link>
        </div>
        {error && <p role="alert" className="border-2 border-[#FF5A5A] p-3 text-sm">Couldn&apos;t load your feed. Refresh to try again.</p>}
        {discover && !discoverOn ? (
          <section className="flex flex-col items-start gap-3 border-2 border-dashed border-violet bg-panel p-7">
            <p className="pixel text-[22px] text-violet">DISCOVERY IS OFF</p>
            <h2 className="font-display text-3xl font-extrabold">Meet new people — only if you want to.</h2>
            <p className="max-w-[560px] leading-relaxed text-muted">Discover shows public posts from people who chose to be discoverable, newest first — not whatever keeps you scrolling. It never mixes into your friends feed.</p>
            <form action="/api/settings/discover" method="post"><button className="btn border-fg bg-violet text-ink">Turn on Discover</button></form>
          </section>
        ) : (
          <FeedList key={discover ? 'd' : 'f'} initial={posts} meId={me.id} source={discover ? { kind: 'discover' } : { kind: 'friends' }}
            emptyText={discover ? 'No public posts from discoverable people yet.' : <>Your feed is quiet. <Link href="/discover" className="link">Find friends</Link> or post something.</>}
            endText={discover ? 'That’s everything public for now.' : 'That’s everything from your friends. Go sign a guestbook or something.'} />
        )}
      </section>
      <FeedSidebar />
    </div>
  );
}
