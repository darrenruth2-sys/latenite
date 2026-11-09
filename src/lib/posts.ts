import type { SupabaseClient } from '@supabase/supabase-js';
import type { ProfileCard } from '@/lib/types';

export const POST_SELECT =
  'id, author_id, kind, body, mood, visibility, media, meta, repost_of, created_at, edited_at, ' +
  'author:profiles!posts_author_id_fkey(id, username, display_name, avatar_url, mood), ' +
  'original:posts!repost_of(id, author_id, kind, body, mood, media, meta, created_at, author:profiles!posts_author_id_fkey(id, username, display_name, avatar_url)), ' +
  'comments(count), reactions(count)';

export type FeedPost = {
  id: string; author_id: string; kind: string; body: string | null; mood: string | null; visibility: string;
  media: { url: string; alt?: string }[]; meta: Record<string, unknown>; repost_of: string | null; created_at: string; edited_at: string | null;
  author: ProfileCard; original: (Omit<FeedPost, 'original' | 'author' | 'comments' | 'reactions' | 'liked' | 'friend'> & { author: ProfileCard }) | null;
  comments: { count: number }[]; reactions: { count: number }[];
  liked?: boolean; friend?: ProfileCard | null;
};

/** Adds "liked by me" and resolves friend cards for friendship items. */
export async function enrichPosts(supabase: SupabaseClient, posts: FeedPost[], meId: string | null) {
  if (!posts.length) return posts;
  const ids = posts.map((p) => p.id);
  const friendIds = [...new Set(posts.filter((p) => p.kind === 'friendship').map((p) => String(p.meta.friend_id)))];
  const [likes, friends] = await Promise.all([
    meId ? supabase.from('reactions').select('post_id').eq('user_id', meId).in('post_id', ids) : Promise.resolve({ data: [] as { post_id: string }[] }),
    friendIds.length ? supabase.from('profiles').select('id, username, display_name, avatar_url').in('id', friendIds) : Promise.resolve({ data: [] as ProfileCard[] }),
  ]);
  const liked = new Set((likes.data || []).map((l) => l.post_id));
  const fmap = new Map(((friends.data || []) as ProfileCard[]).map((f) => [f.id, f]));
  return posts.map((p) => ({ ...p, liked: liked.has(p.id), friend: p.kind === 'friendship' ? fmap.get(String(p.meta.friend_id)) || null : null }));
}
