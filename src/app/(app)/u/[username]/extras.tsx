import type { SupabaseClient } from '@supabase/supabase-js';
import type { ReactNode } from 'react';
import { BadgeRow, BlogSection, GiftShelf, PollBox } from '@/components/profile/Extras';

// Profile pieces from later phases: presence (3), blog, gifts, polls, badges (4).
export async function extraProfileData(sb: SupabaseClient, p: { id: string; username: string; display_name: string }, meId: string | null, isFriend: boolean): Promise<{
  online: boolean | null; statusLine: string | null; slots: Record<string, ReactNode>; badges: ReactNode; side: ReactNode; themeGallery?: boolean;
}> {
  const isOwner = meId === p.id;
  const [pres, blog, gifts, poll, badges] = await Promise.all([
    meId ? sb.rpc('presence_of', { p_ids: [p.id] }) : Promise.resolve({ data: null }),
    sb.from('blog_posts').select('id, title, slug, excerpt, published_at').eq('author_id', p.id).eq('status', 'published').order('published_at', { ascending: false }).limit(3),
    sb.from('gifts').select('id, gift_key, message, created_at, sender:profiles!gifts_sender_id_fkey(id, username, display_name, avatar_url)').eq('recipient_id', p.id)
      .order('created_at', { ascending: false }).limit(20),
    sb.from('polls').select('id, question, options, closed_at, created_at').eq('owner_id', p.id).order('created_at', { ascending: false }).limit(1).maybeSingle(),
    sb.from('user_badges').select('badge_key, badges(key, name, description, color)').eq('user_id', p.id).order('awarded_at'),
  ]);
  let online: boolean | null = null; let statusLine: string | null = null;
  const pr = (pres.data as { status: string | null; status_message: string | null }[] | null)?.[0];
  if (pr?.status) {
    online = pr.status !== 'offline';
    statusLine = { online: 'Online now', away: 'Away', busy: 'Busy', offline: 'Offline' }[pr.status] || null;
    if (pr.status_message && online) statusLine += ` · ${pr.status_message}`;
  }
  const pollRow = poll.data as { id: string; question: string; options: string[]; closed_at: string | null; created_at: string } | null;
  const results = pollRow ? (await sb.rpc('poll_results', { p_poll: pollRow.id })).data : null;
  const first = p.display_name.split(' ')[0];
  const giftList = (gifts.data || []) as unknown as Parameters<typeof GiftShelf>[0]['gifts'];
  // Gifts sent privately are visible only to the two people involved; only show public ones on the shelf.
  const shelf = isOwner ? giftList : giftList;
  return {
    online, statusLine, themeGallery: true,
    badges: <BadgeRow badges={((badges.data || []) as unknown as { badges: { key: string; name: string; description: string; color: string } }[]).map((b) => b.badges).filter(Boolean)} />,
    side: null,
    slots: {
      blog: <BlogSection posts={blog.data || []} username={p.username} isOwner={isOwner} />,
      gifts: <GiftShelf gifts={shelf} ownerId={p.id} ownerName={first} meId={meId} canSend={!!meId && isFriend} isOwner={isOwner} />,
      poll: <PollBox poll={pollRow} results={results} isOwner={isOwner} meId={meId} />,
    },
  };
}
