import type { Metadata } from 'next';
import { Guestbook, type GbEntry } from '@/components/profile/Guestbook';
import { GB_SELECT } from '@/lib/guestbook';
import { relationTo } from '@/lib/profile';
import { loadShell, SectionFrame } from '../shell';

type Params = { params: Promise<{ username: string }> };
export async function generateMetadata({ params }: Params): Promise<Metadata> { return { title: `@${decodeURIComponent((await params).username).toLowerCase()} · Guestbook` }; }

export default async function GuestbookSection({ params }: Params) {
  const s = await loadShell((await params).username);
  const meId = s.me?.id || null;
  let gb: GbEntry[] = [];
  let canSign = false;
  const policy = (s.details?.guestbook_policy as string) || 'friends';
  if (s.canSee) {
    const [{ data }, relation] = await Promise.all([
      s.supabase.from('guestbook_entries').select(GB_SELECT).eq('profile_id', s.p.id).order('created_at', { ascending: false }).limit(500),
      relationTo(s.supabase, meId, s.p.id),
    ]);
    gb = (data || []) as unknown as GbEntry[];
    if (meId && gb.length) {
      const { data: liked } = await s.supabase.from('guestbook_reactions').select('entry_id').eq('user_id', meId).in('entry_id', gb.map((e) => e.id));
      const set = new Set((liked || []).map((l) => l.entry_id));
      gb = gb.map((e) => ({ ...e, liked: set.has(e.id) }));
    }
    canSign = !!meId && (s.isMe || policy === 'everyone' || (policy === 'friends' && relation.rel === 'friends'));
  }
  const first = s.p.display_name.split(' ')[0];
  return (
    <SectionFrame s={s} active="guestbook" title={`${first}’s guestbook`}>
      <Guestbook initial={gb} profileId={s.p.id} ownerName={first} meId={meId} isOwner={s.isMe} canSign={canSign} policy={policy} />
    </SectionFrame>
  );
}
