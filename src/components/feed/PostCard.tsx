'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Avatar } from '@/components/Avatar';
import { ReportButton } from '@/components/ReportButton';
import { MusicEmbed } from '@/components/profile/MusicEmbed';
import { createClient } from '@/lib/supabase/client';
import { friendlyError, timeAgo } from '@/lib/utils';
import { moodColor } from '@/lib/moods';
import type { FeedPost } from '@/lib/posts';

const TAGS: Record<string, [string, string]> = {
  status: ['STATUS', '#FF4FA3'], photo: ['PHOTOS', '#FFC23D'], music: ['MUSIC', '#38E1FF'], profile_update: ['PROFILE', '#7CF5D0'],
  friendship: ['FRIENDS', '#5CFF8A'], blog: ['BLOG', '#9B7BFF'],
};

type Comment = { id: string; body: string; created_at: string; author_id: string; author: { id: string; username: string; display_name: string; avatar_url: string | null } };

function actionText(p: FeedPost) {
  if (p.repost_of) return 'reposted';
  switch (p.kind) {
    case 'photo': return `added ${p.media.length} photo${p.media.length === 1 ? '' : 's'}`;
    case 'music': return 'shared a song';
    case 'profile_update': return String(p.meta.text || 'updated their page');
    case 'friendship': return 'and';
    case 'blog': return 'wrote a new blog post';
    default: return 'updated their status';
  }
}

export function PostBody({ p }: { p: Pick<FeedPost, 'kind' | 'body' | 'media' | 'meta'> & { friend?: FeedPost['friend'] } }) {
  return (
    <>
      {p.body && <p className="whitespace-pre-wrap break-words text-[17px] leading-relaxed">{p.body}</p>}
      {p.media?.length > 0 && (
        <div className={`grid gap-1.5 ${p.media.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
          {p.media.map((m, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <a key={i} href={m.url} target="_blank" rel="noopener noreferrer"><img src={m.url} alt={m.alt || 'Photo'} loading="lazy" className="max-h-[420px] w-full border-2 border-fg object-cover" /></a>
          ))}
        </div>
      )}
      {(p.kind === 'music' || p.kind === 'profile_update') && p.meta.url ? <MusicEmbed music={p.meta as { provider: string; url: string; title?: string }} compact /> : null}
      {p.kind === 'blog' && p.meta.slug ? (
        <Link href={`/blog/${p.meta.username}/${p.meta.slug}`} className="block border-2 border-fg bg-fg p-4 text-plum no-underline shadow-[4px_4px_0_var(--color-violet)]">
          <span className="pixel text-[17px] text-[#6B2FD6]">NEW BLOG POST</span>
          <span className="mt-1 block font-serif text-2xl font-extrabold leading-tight">{String(p.meta.title)}</span>
          {p.meta.excerpt ? <span className="mt-1.5 block text-[15px] leading-normal text-[#3B2E57]">{String(p.meta.excerpt)}</span> : null}
        </Link>
      ) : null}
    </>
  );
}

export function PostCard({ post, meId, onDeleted }: { post: FeedPost; meId: string | null; onDeleted?: (id: string) => void }) {
  const [liked, setLiked] = useState(!!post.liked);
  const [likes, setLikes] = useState(post.reactions?.[0]?.count || 0);
  const [cCount, setCCount] = useState(post.comments?.[0]?.count || 0);
  const [open, setOpen] = useState(false);
  const [comments, setComments] = useState<Comment[] | null>(null);
  const [draft, setDraft] = useState('');
  const [err, setErr] = useState('');
  const [reposted, setReposted] = useState(false);
  const router = useRouter();
  const sb = createClient();
  const [tag, tagC] = TAGS[post.repost_of ? 'status' : post.kind] || TAGS.status;
  const a = post.author;

  async function toggleLike() {
    if (!meId) return router.push('/login');
    const next = !liked; setLiked(next); setLikes((n) => n + (next ? 1 : -1)); setErr('');
    const { error } = next ? await sb.from('reactions').insert({ post_id: post.id, user_id: meId }) : await sb.from('reactions').delete().eq('post_id', post.id).eq('user_id', meId);
    if (error && !/duplicate/.test(error.message)) { setLiked(!next); setLikes((n) => n + (next ? -1 : 1)); setErr(friendlyError(error)); }
  }
  async function loadComments() {
    const { data } = await sb.from('comments').select('id, body, created_at, author_id, author:profiles!comments_author_id_fkey(id, username, display_name, avatar_url)')
      .eq('post_id', post.id).order('created_at').limit(200);
    setComments((data || []) as unknown as Comment[]);
  }
  async function toggleComments() { const n = !open; setOpen(n); if (n && !comments) await loadComments(); }
  async function addComment(e: React.FormEvent) {
    e.preventDefault(); if (!meId) return router.push('/login');
    const body = draft.trim(); if (!body) return;
    setErr('');
    const { error } = await sb.from('comments').insert({ post_id: post.id, author_id: meId, body });
    if (error) { setErr(friendlyError(error)); return; }
    setDraft(''); setCCount((n) => n + 1); await loadComments();
  }
  async function delComment(id: string) {
    const { error } = await sb.from('comments').delete().eq('id', id);
    if (!error) { setComments((c) => (c || []).filter((x) => x.id !== id)); setCCount((n) => Math.max(0, n - 1)); }
  }
  async function repost() {
    if (!meId) return router.push('/login');
    const { error } = await sb.from('posts').insert({ author_id: meId, kind: 'status', repost_of: post.repost_of || post.id, visibility: 'friends' });
    if (error) setErr(friendlyError(error)); else { setReposted(true); router.refresh(); }
  }
  async function remove() {
    if (!confirm('Delete this post?')) return;
    const { error } = await sb.from('posts').delete().eq('id', post.id);
    if (error) setErr(friendlyError(error)); else { onDeleted?.(post.id); router.refresh(); }
  }

  return (
    <article className="animate-rise border-2 border-line bg-panel" aria-label={`Post by ${a?.display_name || 'someone'}`}>
      <div className="flex items-start gap-3 px-4 pb-2.5 pt-3.5">
        {a && <Link href={`/u/${a.username}`} tabIndex={-1} aria-hidden="true"><Avatar user={a} size={48} /></Link>}
        <div className="min-w-0 flex-1">
          <p className="leading-snug">
            {a && <Link href={`/u/${a.username}`} className="font-bold hover:text-cyan">{a.display_name}</Link>}{' '}
            <span className="text-muted">{actionText(post)}</span>
            {post.kind === 'friendship' && post.friend && <> <Link href={`/u/${post.friend.username}`} className="font-bold hover:text-cyan">{post.friend.display_name}</Link> <span className="text-muted">are now friends</span></>}
          </p>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[13px] text-dim">
            <time suppressHydrationWarning dateTime={post.created_at}>{timeAgo(post.created_at)}</time>
            {post.mood && <span className="pixel text-[17px]" style={{ color: moodColor(post.mood) }}>mood: {post.mood}</span>}
            <span className="pixel border px-1.5 text-base" style={{ color: tagC, borderColor: tagC }}>{tag}</span>
            {post.visibility !== 'friends' && <span className="text-xs">{post.visibility === 'public' ? 'Public' : 'Top Friends'}</span>}
          </div>
        </div>
      </div>
      <div className="flex flex-col gap-3 px-4 pb-3 sm:pl-[76px]">
        {post.repost_of ? (
          post.original?.author ? (
            <div className="flex flex-col gap-2 border-2 border-line bg-ink p-3">
              <Link href={`/u/${post.original.author.username}`} className="flex items-center gap-2 text-sm font-bold"><Avatar user={post.original.author} size={26} />{post.original.author.display_name}</Link>
              <PostBody p={post.original} />
            </div>
          ) : <p className="border-2 border-dashed border-line p-3 text-sm text-dim">The original post isn&apos;t available to you.</p>
        ) : <PostBody p={post} />}
        {post.kind === 'friendship' && post.friend && (
          <div className="flex items-center gap-2.5" aria-hidden="true">
            <Avatar user={a} size={44} /><svg width="28" height="14" viewBox="0 0 28 14"><path d="M0 7h28" stroke="#FF4FA3" strokeWidth="3" strokeDasharray="4 3" /></svg><Avatar user={post.friend} size={44} />
          </div>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-1 border-t border-line px-3 py-1.5 sm:pl-[72px]">
        <button type="button" onClick={toggleLike} aria-pressed={liked} className={`min-h-10 px-3 text-sm font-semibold hover:bg-panel2 ${liked ? 'text-pink' : 'text-muted'}`}>♥ {likes}</button>
        <button type="button" onClick={toggleComments} aria-expanded={open} className="min-h-10 px-3 text-sm font-semibold text-muted hover:bg-panel2">Comment · {cCount}</button>
        {post.kind !== 'friendship' && post.author_id !== meId && (
          <button type="button" onClick={repost} disabled={reposted} className={`min-h-10 px-3 text-sm font-semibold hover:bg-panel2 ${reposted ? 'text-lime' : 'text-muted'}`}>{reposted ? 'Reposted' : 'Repost'}</button>
        )}
        <span className="ml-auto flex">
          {post.author_id === meId
            ? <button type="button" onClick={remove} className="min-h-10 px-2 text-sm text-dim hover:text-fg">Delete</button>
            : <ReportButton type="post" id={post.id} owner={post.author_id} meId={meId} />}
        </span>
      </div>
      {err && <p role="alert" className="px-4 pb-2 text-sm text-[#FF8A8A] sm:pl-[76px]">{err}</p>}
      {open && (
        <div className="flex flex-col gap-2 px-4 pb-3.5 sm:pl-[76px]">
          {comments === null && <p className="text-sm text-dim">Loading…</p>}
          {comments?.map((c) => (
            <div key={c.id} className="flex items-start gap-2 border border-line bg-ink px-2.5 py-2 text-sm">
              <Link href={`/u/${c.author.username}`} tabIndex={-1} aria-hidden="true"><Avatar user={c.author} size={26} /></Link>
              <p className="min-w-0 flex-1 break-words"><Link href={`/u/${c.author.username}`} className="font-bold text-cyan">{c.author.display_name}</Link> {c.body}
                <span suppressHydrationWarning className="ml-1.5 text-xs text-dim">{timeAgo(c.created_at)}</span></p>
              {(c.author_id === meId || post.author_id === meId) && <button type="button" onClick={() => delComment(c.id)} aria-label="Delete comment" className="px-1 text-dim hover:text-fg">×</button>}
            </div>
          ))}
          {meId && (
            <form onSubmit={addComment} className="flex gap-1.5">
              <label htmlFor={`c-${post.id}`} className="sr-only">Write a comment</label>
              <input id={`c-${post.id}`} value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={1000} placeholder="write a comment…" className="field min-h-10 flex-1" />
              <button className="btn-cyan btn-sm" disabled={!draft.trim()}>Reply</button>
            </form>
          )}
        </div>
      )}
    </article>
  );
}
