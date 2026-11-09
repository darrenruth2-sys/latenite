'use client';
import { useEffect, useState } from 'react';
import { PostCard } from './PostCard';
import { createClient } from '@/lib/supabase/client';
import { POST_SELECT, type FeedPost } from '@/lib/posts';

type Source = { kind: 'friends' } | { kind: 'user'; userId: string } | { kind: 'discover' };

const FILTERS: [string, string][] = [['all', 'All'], ['status', 'Statuses'], ['photo', 'Photos'], ['blog', 'Blogs'], ['music', 'Music']];

async function fetchPage(source: Source, before: string | null, meId: string | null) {
  const sb = createClient();
  let q;
  if (source.kind === 'friends') q = sb.rpc('friend_feed', { p_before: before, p_limit: 20 }).select(POST_SELECT);
  else if (source.kind === 'discover') q = sb.rpc('discover_feed', { p_before: before, p_limit: 20 }).select(POST_SELECT);
  else { q = sb.from('posts').select(POST_SELECT).eq('author_id', source.userId).order('created_at', { ascending: false }).limit(20); if (before) q = q.lt('created_at', before); }
  const { data, error } = await q;
  if (error) throw error;
  const posts = (data || []) as unknown as FeedPost[];
  if (!posts.length) return posts;
  const ids = posts.map((p) => p.id);
  const friendIds = [...new Set(posts.filter((p) => p.kind === 'friendship').map((p) => String(p.meta.friend_id)))];
  const [likes, friends] = await Promise.all([
    meId ? sb.from('reactions').select('post_id').eq('user_id', meId).in('post_id', ids) : Promise.resolve({ data: [] }),
    friendIds.length ? sb.from('profiles').select('id, username, display_name, avatar_url').in('id', friendIds) : Promise.resolve({ data: [] }),
  ]);
  const liked = new Set(((likes.data || []) as { post_id: string }[]).map((l) => l.post_id));
  const fmap = new Map(((friends.data || []) as FeedPost['author'][]).map((f) => [f.id, f]));
  return posts.map((p) => ({ ...p, liked: liked.has(p.id), friend: fmap.get(String(p.meta.friend_id)) || null }));
}

export function FeedList({ initial, meId, source, emptyText, endText, showFilters = true }:
  { initial: FeedPost[]; meId: string | null; source: Source; emptyText: React.ReactNode; endText?: string; showFilters?: boolean }) {
  const [posts, setPosts] = useState(initial);
  const [done, setDone] = useState(initial.length < 20);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [filter, setFilter] = useState('all');
  useEffect(() => { setPosts(initial); setDone(initial.length < 20); }, [initial]);
  async function more() {
    setLoading(true); setErr('');
    try {
      const page = await fetchPage(source, posts[posts.length - 1]?.created_at || null, meId);
      setPosts((p) => [...p, ...page.filter((x) => !p.some((y) => y.id === x.id))]); if (page.length < 20) setDone(true);
    } catch { setErr('Couldn’t load more. Try again.'); } finally { setLoading(false); }
  }
  const shown = posts.filter((p) => filter === 'all' || (filter === 'status' ? p.kind === 'status' && !p.repost_of : p.kind === filter));
  return (
    <div className="flex flex-col gap-4">
      {showFilters && posts.length > 0 && (
        <div role="group" aria-label="Filter posts" className="flex flex-wrap gap-1.5">
          {FILTERS.map(([k, l]) => (
            <button key={k} type="button" onClick={() => setFilter(k)} aria-pressed={filter === k}
              className={`min-h-9 border-2 border-cyan px-3 text-[13px] font-semibold ${filter === k ? 'bg-cyan text-ink' : 'text-fg'}`}>{l}</button>
          ))}
        </div>
      )}
      {posts.length === 0 ? (
        <div className="border-2 border-dashed border-line p-6 text-center text-muted">{emptyText}</div>
      ) : (
        <ol className="flex flex-col gap-4">
          {shown.map((p) => <li key={p.id}><PostCard post={p} meId={meId} onDeleted={(id) => setPosts((x) => x.filter((y) => y.id !== id))} /></li>)}
          {shown.length === 0 && <li className="border-2 border-dashed border-line p-5 text-center text-muted">Nothing here for this filter yet.</li>}
        </ol>
      )}
      {err && <p role="alert" className="text-sm text-[#FF8A8A]">{err}</p>}
      {!done && posts.length > 0 && <button type="button" onClick={more} disabled={loading} className="btn-ghost self-center">{loading ? 'Loading…' : 'Load older posts'}</button>}
      {done && posts.length > 0 && endText && (
        <div className="flex flex-col items-center gap-1.5 border-2 border-lime p-5 text-center">
          <p className="pixel text-[26px] text-lime">&gt; YOU&apos;RE ALL CAUGHT UP</p><p className="text-muted">{endText}</p>
        </div>
      )}
    </div>
  );
}
