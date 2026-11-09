import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';
import type { ProfileCard } from '@/lib/types';

export type Me = ProfileCard & { isModerator: boolean; suspended: boolean };

/** Current user's profile + badge counts, fetched once per request. */
export const getMe = cache(async () => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, me: null as Me | null, counts: { notifications: 0, requests: 0, messages: 0 } };
  const [p, n, r, m, mod] = await Promise.all([
    supabase.from('profiles').select('id, username, display_name, avatar_url, mood, mood_color, is_private, suspended_at').eq('id', user.id).maybeSingle(),
    supabase.from('notifications').select('id', { count: 'exact', head: true }).eq('user_id', user.id).is('read_at', null),
    supabase.from('friend_requests').select('id', { count: 'exact', head: true }).eq('recipient_id', user.id),
    supabase.rpc('unread_conversation_count'),
    supabase.from('moderators').select('user_id').eq('user_id', user.id).maybeSingle(),
  ]);
  const me = p.data ? ({ ...(p.data as ProfileCard), username: String(p.data.username), isModerator: !!mod.data, suspended: !!p.data.suspended_at } as Me) : null;
  return { supabase, me, counts: { notifications: n.count || 0, requests: r.count || 0, messages: typeof m.data === 'number' ? m.data : 0 } };
});
