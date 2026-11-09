import type { SupabaseClient } from '@supabase/supabase-js';

export type Relation = 'self' | 'friends' | 'outgoing' | 'incoming' | 'none' | 'blocked';

export async function relationTo(supabase: SupabaseClient, meId: string | null, otherId: string): Promise<{ rel: Relation; requestId?: string; since?: string }> {
  if (!meId) return { rel: 'none' };
  if (meId === otherId) return { rel: 'self' };
  const a = meId < otherId ? meId : otherId, b = meId < otherId ? otherId : meId;
  const [fs, reqs, blk] = await Promise.all([
    supabase.from('friendships').select('created_at').eq('user_a', a).eq('user_b', b).maybeSingle(),
    supabase.from('friend_requests').select('id, sender_id').or(`and(sender_id.eq.${meId},recipient_id.eq.${otherId}),and(sender_id.eq.${otherId},recipient_id.eq.${meId})`),
    supabase.from('blocks').select('blocked_id').eq('blocker_id', meId).eq('blocked_id', otherId).maybeSingle(),
  ]);
  if (blk.data) return { rel: 'blocked' };
  if (fs.data) return { rel: 'friends', since: fs.data.created_at };
  const r = reqs.data?.[0];
  if (r) return r.sender_id === meId ? { rel: 'outgoing', requestId: r.id } : { rel: 'incoming', requestId: r.id };
  return { rel: 'none' };
}
