import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getMe } from '@/lib/me';
import { relationTo } from '@/lib/profile';
import { Avatar } from '@/components/Avatar';
import { FriendButton } from '@/components/profile/FriendButton';
import { BlockButton } from '@/components/profile/BlockButton';
import { ReportButton } from '@/components/ReportButton';
import { FeedList } from '@/components/feed/FeedList';
import { ProfileView } from '@/components/profile/ProfileView';
import { Guestbook, type GbEntry } from '@/components/profile/Guestbook';
import { GB_SELECT } from '@/lib/guestbook';
import { RecordVisit, VisitorsBox } from '@/components/profile/Visitors';
import type { TopFriend } from '@/components/profile/TopFriends';
import { POST_SELECT, enrichPosts, type FeedPost } from '@/lib/posts';
import { resolveTheme, themeVars } from '@/lib/theme';
import { extraProfileData } from './extras';

type Params = { params: Promise<{ username: string }>; searchParams: Promise<{ edit?: string }> };
type Card = { id: string; username: string; display_name: string; avatar_url: string | null };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { username } = await params;
  return { title: `@${decodeURIComponent(username).toLowerCase()}` };
}

const box = 'flex flex-col gap-3 border-2 border-[var(--text)] bg-[var(--card)] p-5 rounded-[var(--radius)]';
const head = { fontFamily: 'var(--head)' };

export default async function ProfilePage({ params, searchParams }: Params) {
  const { username } = await params;
  const { edit } = await searchParams;
  const { supabase, me } = await getMe();
  const uname = decodeURIComponent(username).toLowerCase();
  if (!/^[a-z0-9._]{1,20}$/.test(uname)) notFound();
  const { data: profile } = await supabase.from('profiles').select('id, username, display_name, avatar_url, mood, mood_color, is_private, created_at').eq('username', uname).maybeSingle();
  if (!profile) notFound();
  const p = { ...profile, username: String(profile.username) };
  const meId = me?.id || null;
  const isMe = meId === p.id;

  const [{ data: details }, relation, topRes, statsRes, mutual, friendCountRes] = await Promise.all([
    supabase.from('profile_details').select('*').eq('id', p.id).maybeSingle(),
    relationTo(supabase, meId, p.id),
    supabase.rpc('get_top_friends', { p_owner: p.id }),
    supabase.rpc('visit_stats', { p_profile: p.id }),
    meId && !isMe ? supabase.rpc('mutual_friend_count', { p_other: p.id }) : Promise.resolve({ data: null }),
    supabase.from('friendships').select('*', { count: 'exact', head: true }).or(`user_a.eq.${p.id},user_b.eq.${p.id}`),
  ]);
  const canSee = !!details;
  const extras = canSee ? await extraProfileData(supabase, p, meId, relation.rel === 'friends') : { online: null, statusLine: null, slots: {}, badges: null, side: null };

  const actions = isMe ? (
    <Link href="/settings/profile" className="btn border-[var(--text)] bg-[var(--card)] text-[var(--text)]">Edit details</Link>
  ) : meId ? (
    <>
      <FriendButton otherId={p.id} rel={relation.rel} requestId={relation.requestId} name={p.display_name} className="btn border-[var(--text)] bg-[var(--accent)] text-[var(--on-accent)]" />
      {relation.rel === 'friends' && <Link href={`/messenger?to=${p.username}`} className="btn border-[var(--text)] bg-[var(--card)] text-[var(--text)]">Message</Link>}
    </>
  ) : <Link href={`/login?next=/u/${p.username}`} className="btn border-[var(--text)] bg-[var(--accent)] text-[var(--on-accent)]">Log in to add friend</Link>;

  if (!canSee) {
    const t = resolveTheme(null);
    return (
      <div style={themeVars(t)} className="min-h-[calc(100dvh-64px)]">
        <div className="mx-auto flex max-w-[900px] flex-col items-center gap-5 px-4 py-14 text-center">
          <Avatar user={p} size={120} />
          <h1 className="font-display text-4xl font-extrabold">{p.display_name}</h1>
          <p className="text-muted">@{p.username}</p>
          <p className="pixel text-2xl text-violet">THIS PAGE IS PRIVATE</p>
          <p className="max-w-md text-muted">Only {p.display_name}&apos;s friends can see their page. Send a friend request to get in.</p>
          <div className="flex gap-2">{actions}</div>
          {meId && <div className="flex gap-1"><BlockButton meId={meId} otherId={p.id} name={p.display_name} blocked={false} /><ReportButton type="profile" id={p.id} owner={p.id} meId={meId} label="Report" /></div>}
        </div>
      </div>
    );
  }

  const [gbRes, postsRes, allFriends, pool, myVisitors, mySettings] = await Promise.all([
    supabase.from('guestbook_entries').select(GB_SELECT).eq('profile_id', p.id).order('created_at', { ascending: false }).limit(150),
    supabase.from('posts').select(POST_SELECT).eq('author_id', p.id).order('created_at', { ascending: false }).limit(20),
    supabase.rpc('friends_of', { p_user: p.id, p_limit: 48 }),
    isMe ? supabase.rpc('friends_of', { p_user: p.id, p_limit: 500 }) : Promise.resolve({ data: [] }),
    isMe ? supabase.rpc('my_visitors', { p_limit: 8 }) : Promise.resolve({ data: [] }),
    meId ? supabase.from('profile_settings').select('private_browsing').eq('id', meId).single() : Promise.resolve({ data: null }),
  ]);
  let gb = (gbRes.data || []) as unknown as GbEntry[];
  if (meId && gb.length) {
    const { data: liked } = await supabase.from('guestbook_reactions').select('entry_id').eq('user_id', meId).in('entry_id', gb.map((e) => e.id));
    const set = new Set((liked || []).map((l) => l.entry_id));
    gb = gb.map((e) => ({ ...e, liked: set.has(e.id) }));
  }
  const posts = await enrichPosts(supabase, (postsRes.data || []) as unknown as FeedPost[], meId);
  const friends = (allFriends.data || []) as Card[];
  const policy = details.guestbook_policy as string;
  const canSign = !!meId && (isMe || policy === 'everyone' || (policy === 'friends' && relation.rel === 'friends'));
  const stats = (statsRes.data || { total: 0, week: null }) as { total: number; week: number | null };
  const first = p.display_name.split(' ')[0];

  const slots: Record<string, React.ReactNode> = {
    about: (
      <section aria-labelledby="about-h" className="grid gap-6 border-2 border-[var(--text)] bg-[var(--card)] p-5 rounded-[var(--radius)] sm:grid-cols-2 sm:p-6">
        <div className="flex flex-col gap-2"><h2 id="about-h" className="text-[26px] font-extrabold" style={head}>About me</h2>
          <p className="whitespace-pre-wrap break-words leading-relaxed">{details.bio || (isMe ? <Link className="underline" href="/settings/profile">Add a bio</Link> : <span className="text-[var(--muted)]">Nothing here yet.</span>)}</p></div>
        <div className="flex flex-col gap-2"><h2 className="text-[26px] font-extrabold" style={head}>Who I&apos;d like to meet</h2>
          <p className="whitespace-pre-wrap break-words leading-relaxed">{details.meet || <span className="text-[var(--muted)]">—</span>}</p></div>
      </section>
    ),
    guestbook: <Guestbook initial={gb} profileId={p.id} ownerName={first} meId={meId} isOwner={isMe} canSign={canSign} policy={policy} />,
    posts: (
      <section aria-labelledby="posts-h" className="flex flex-col gap-4">
        <h2 id="posts-h" className="text-[26px] font-extrabold" style={head}>Posts</h2>
        <div className="themed-feed text-fg"><FeedList initial={posts} meId={meId} source={{ kind: 'user', userId: p.id }} showFilters={false} emptyText={isMe ? 'You haven’t posted yet.' : 'Nothing posted yet.'} /></div>
      </section>
    ),
    friends: (
      <section aria-labelledby="allf-h" className={box}>
        <h2 id="allf-h" className="text-[26px] font-extrabold" style={head}>{first}&apos;s friends · {friendCountRes.count ?? friends.length}</h2>
        {friends.length === 0 ? <p className="text-[var(--muted)]">No friends yet.</p> : (
          <ul className="grid grid-cols-4 gap-3 sm:grid-cols-6">{friends.map((f) => (
            <li key={f.id}><Link href={`/u/${f.username}`} className="flex flex-col gap-1 text-xs font-semibold"><Avatar user={f} size={80} border="var(--text)" className="!h-auto !w-full aspect-square" /><span className="truncate">{f.display_name}</span></Link></li>))}</ul>
        )}
      </section>
    ),
    ...extras.slots,
  };

  const side = (
    <>
      <VisitorsBox isOwner={isMe} total={stats.total || 0} week={stats.week} visitors={(myVisitors.data || []) as never} privateBrowsing={!!mySettings.data?.private_browsing} meId={meId} />
      {extras.side}
      <section aria-labelledby="det-h" className={box}>
        <h2 id="det-h" className="text-[22px] font-extrabold" style={head}>The details</h2>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
          {details.region && <><dt className="text-[var(--muted)]">Region</dt><dd>{details.region}</dd></>}
          <dt className="text-[var(--muted)]">Here since</dt><dd>{new Date(p.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}</dd>
          <dt className="text-[var(--muted)]">Friends</dt><dd>{friendCountRes.count ?? friends.length}</dd>
          {typeof mutual.data === 'number' && mutual.data > 0 && <><dt className="text-[var(--muted)]">You + {first}</dt><dd>{mutual.data} friend{mutual.data === 1 ? '' : 's'} in common</dd></>}
          {relation.since && <><dt className="text-[var(--muted)]">Friends since</dt><dd>{new Date(relation.since).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</dd></>}
        </dl>
        {details.interests?.length > 0 && (
          <ul className="flex flex-wrap gap-1.5" aria-label="Interests">
            {details.interests.map((i: string) => <li key={i}><Link href={`/discover?interest=${encodeURIComponent(i)}`} className="inline-flex border-2 border-[var(--text)] px-2 py-0.5 text-[13px] font-semibold hover:bg-[var(--text)] hover:text-[var(--card)]">{i}</Link></li>)}
          </ul>
        )}
      </section>
      {meId && !isMe && (
        <div className="flex flex-wrap gap-1 [&_button]:text-[var(--muted)]">
          <BlockButton meId={meId} otherId={p.id} name={p.display_name} blocked={false} />
          <ReportButton type="profile" id={p.id} owner={p.id} meId={meId} label="Report page" />
        </div>
      )}
    </>
  );

  return (
    <>
      {meId && !isMe && <RecordVisit profileId={p.id} />}
      <ProfileView
        profile={p} isMe={isMe} startEditing={edit === '1'} online={extras.online} statusLine={extras.statusLine}
        details={{ theme: details.theme, layout: details.layout, top_count: details.top_count, top_hidden: details.top_hidden, music: details.music,
          guestbook_policy: policy, banner_url: details.banner_url, headline: details.headline }}
        top={(topRes.data || []) as TopFriend[]} pool={(pool.data || []) as TopFriend[]}
        slots={slots} side={side} actions={actions} badges={extras.badges} themeGalleryEnabled={extras.themeGallery}
      />
    </>
  );
}
