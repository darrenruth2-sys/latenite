'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Avatar } from '@/components/Avatar';
import { createClient } from '@/lib/supabase/client';
import { GIFTS } from '@/lib/gifts';
import { friendlyError, timeAgo } from '@/lib/utils';

const box = 'flex flex-col gap-3 border-2 border-[var(--text)] bg-[var(--card)] p-5 rounded-[var(--radius)] sm:p-6';
const head = { fontFamily: 'var(--head)' };
const btn = 'btn border-[var(--text)] bg-[var(--accent)] text-[var(--on-accent)]';
const field = 'min-h-10 w-full border-2 border-[var(--line)] bg-transparent px-2.5 text-[var(--text)] placeholder:text-[var(--muted)]';

type Gift = { id: string; gift_key: string; message: string | null; created_at: string; sender: { id: string; username: string; display_name: string; avatar_url: string | null } | null };

export function GiftShelf({ gifts, ownerId, ownerName, meId, canSend, isOwner }: { gifts: Gift[]; ownerId: string; ownerName: string; meId: string | null; canSend: boolean; isOwner: boolean }) {
  const [open, setOpen] = useState(false); const [pick, setPick] = useState('cassette'); const [msg, setMsg] = useState(''); const [pub, setPub] = useState(true);
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false); const router = useRouter();
  if (!gifts.length && !canSend && !isOwner) return null;
  async function send() {
    setBusy(true); setErr('');
    const { error } = await createClient().from('gifts').insert({ sender_id: meId, recipient_id: ownerId, gift_key: pick, message: msg.trim() || null, is_public: pub });
    setBusy(false); if (error) setErr(friendlyError(error)); else { setOpen(false); setMsg(''); router.refresh(); }
  }
  async function remove(id: string) { await createClient().from('gifts').delete().eq('id', id); router.refresh(); }
  return (
    <section id="gifts" aria-labelledby="gift-h" className={box}>
      <div className="flex flex-wrap items-baseline justify-between gap-2"><h2 id="gift-h" className="text-[26px] font-extrabold" style={head}>Gift shelf</h2>
        {canSend && <button type="button" className={btn} onClick={() => setOpen((o) => !o)}>{open ? 'Cancel' : `Send ${ownerName} a gift`}</button>}</div>
      {open && (
        <div className="flex flex-col gap-3 border-2 border-dashed border-[var(--line)] p-3">
          <div role="radiogroup" aria-label="Pick a gift" className="grid grid-cols-5 gap-2">
            {Object.entries(GIFTS).map(([k, g]) => (
              <button key={k} type="button" role="radio" aria-checked={pick === k} aria-label={g.name} onClick={() => setPick(k)}
                className={`flex aspect-square items-center justify-center border-2 text-xl font-bold text-ink ${pick === k ? 'border-[var(--text)] outline outline-2 outline-[var(--accent)]' : 'border-transparent'}`} style={{ background: g.bg }}>{g.glyph}</button>
            ))}
          </div>
          <p className="text-sm font-semibold">{GIFTS[pick].name}</p>
          <input className={field} maxLength={140} value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="Add a note (optional)" aria-label="Gift note" />
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={pub} onChange={(e) => setPub(e.target.checked)} className="h-4 w-4" />Show on their shelf (uncheck to send privately)</label>
          <button type="button" className={`${btn} self-start`} onClick={send} disabled={busy}>{busy ? 'Sending…' : 'Send gift'}</button>
          {err && <p role="alert" className="text-sm font-semibold text-[#FF5A5A]">{err}</p>}
        </div>
      )}
      {gifts.length === 0 ? <p className="text-[var(--muted)]">{isOwner ? 'Gifts your friends send show up here.' : 'No gifts yet.'}</p> : (
        <ul className="grid grid-cols-3 gap-3 sm:grid-cols-5">
          {gifts.map((g) => { const def = GIFTS[g.gift_key]; return (
            <li key={g.id} className="flex flex-col items-center gap-1 text-center" title={g.message || def?.name}>
              <span className="flex aspect-square w-full items-center justify-center border-2 border-[var(--text)] text-2xl font-bold text-ink" style={{ background: def?.bg }}>{def?.glyph}</span>
              <span className="text-xs font-semibold">{def?.name}</span>
              {g.sender && <Link href={`/u/${g.sender.username}`} className="text-[11px] text-[var(--muted)] underline">from {g.sender.display_name}</Link>}
              {g.message && <span className="text-[11px] italic text-[var(--muted)]">&ldquo;{g.message}&rdquo;</span>}
              {isOwner && <button type="button" onClick={() => remove(g.id)} className="text-[11px] text-[var(--muted)] underline">remove</button>}
            </li>); })}
        </ul>
      )}
    </section>
  );
}

type Poll = { id: string; question: string; options: string[]; closed_at: string | null; created_at: string };
export function PollBox({ poll, results, isOwner, meId }: { poll: Poll | null; results: { counts: number[] | null; mine: number | null } | null; isOwner: boolean; meId: string | null }) {
  const [q, setQ] = useState(''); const [opts, setOpts] = useState(['', '']); const [err, setErr] = useState(''); const router = useRouter();
  const sb = createClient();
  if (!poll && !isOwner) return null;
  async function create() {
    const o = opts.map((x) => x.trim()).filter(Boolean);
    if (!q.trim() || o.length < 2) { setErr('Ask a question and give at least 2 answers.'); return; }
    if (poll) await sb.from('polls').update({ closed_at: new Date().toISOString() }).eq('id', poll.id);
    const { error } = await sb.from('polls').insert({ owner_id: meId, question: q.trim(), options: o.map((x) => x.slice(0, 60)) });
    if (error) setErr(friendlyError(error)); else { setQ(''); setOpts(['', '']); router.refresh(); }
  }
  async function vote(i: number) { const { error } = await sb.from('poll_votes').insert({ poll_id: poll!.id, voter_id: meId, option_idx: i }); if (error) setErr(friendlyError(error)); else router.refresh(); }
  async function close() { await sb.from('polls').update({ closed_at: new Date().toISOString() }).eq('id', poll!.id); router.refresh(); }
  const total = results?.counts?.reduce((a, b) => a + b, 0) || 0;
  return (
    <section aria-labelledby="poll-h" className={box}>
      <h2 id="poll-h" className="text-[26px] font-extrabold" style={head}>{poll ? poll.question : 'Ask your friends something'}</h2>
      {poll && (
        <div className="flex flex-col gap-2">
          {poll.options.map((o, i) => {
            const c = results?.counts?.[i]; const pct = results?.counts && total ? Math.round(((c || 0) / total) * 100) : 0;
            const canVote = !!meId && !isOwner && !poll.closed_at && results?.counts === null;
            return (
              <button key={i} type="button" disabled={!canVote} onClick={() => vote(i)}
                className="relative min-h-11 overflow-hidden border-2 px-3 text-left font-semibold disabled:cursor-default" style={{ borderColor: results?.mine === i ? 'var(--accent)' : 'var(--line)' }}>
                {results?.counts && <span aria-hidden="true" className="absolute inset-y-0 left-0" style={{ width: `${pct}%`, background: 'color-mix(in srgb, var(--accent) 30%, transparent)' }} />}
                <span className="relative flex justify-between gap-2"><span>{o}{results?.mine === i ? ' ✓' : ''}</span>{results?.counts && <span>{pct}%</span>}</span>
              </button>
            );
          })}
          <p suppressHydrationWarning className="text-xs text-[var(--muted)]">{poll.closed_at ? 'Poll closed · ' : ''}{results?.counts ? `${total} vote${total === 1 ? '' : 's'}` : meId ? 'Vote to see results' : 'Log in to vote'} · asked {timeAgo(poll.created_at)}</p>
          {isOwner && !poll.closed_at && <button type="button" onClick={close} className="self-start text-sm underline">Close poll</button>}
        </div>
      )}
      {isOwner && (
        <details className="border-2 border-dashed border-[var(--line)] p-3" open={!poll}>
          <summary className="cursor-pointer text-sm font-semibold">{poll ? 'Ask a new question' : 'Create a poll'}</summary>
          <div className="mt-3 flex flex-col gap-2">
            <input className={field} maxLength={140} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Best profile song energy?" aria-label="Question" />
            {opts.map((o, i) => <input key={i} className={field} maxLength={60} value={o} onChange={(e) => setOpts(opts.map((x, j) => (j === i ? e.target.value : x)))} placeholder={`Answer ${i + 1}`} aria-label={`Answer ${i + 1}`} />)}
            <div className="flex gap-2">{opts.length < 6 && <button type="button" className="text-sm underline" onClick={() => setOpts([...opts, ''])}>+ answer</button>}
              <button type="button" className={`${btn} ml-auto`} onClick={create}>Post poll</button></div>
            {err && <p role="alert" className="text-sm font-semibold text-[#FF5A5A]">{err}</p>}
          </div>
        </details>
      )}
      {!isOwner && err && <p role="alert" className="text-sm font-semibold text-[#FF5A5A]">{err}</p>}
    </section>
  );
}

export function BlogSection({ posts, username, isOwner }: { posts: { id: string; title: string; slug: string; excerpt: string | null; published_at: string | null }[]; username: string; isOwner: boolean }) {
  if (!posts.length && !isOwner) return null;
  return (
    <section aria-labelledby="blog-h" className={box}>
      <div className="flex flex-wrap items-baseline justify-between gap-2"><h2 id="blog-h" className="text-[26px] font-extrabold" style={head}>Blog</h2>
        <Link href={`/blog/${username}`} className="text-sm underline">{isOwner ? 'My blog' : 'All posts'}</Link></div>
      {posts.length === 0 ? <p className="text-[var(--muted)]">No posts yet. <Link href="/blog/new" className="underline">Write your first</Link>.</p> : (
        <ul className="flex flex-col gap-3">{posts.map((b) => (
          <li key={b.id} className="border-l-4 border-[var(--accent)] pl-3"><Link href={`/blog/${username}/${b.slug}`} className="font-serif text-xl font-extrabold hover:underline">{b.title}</Link>
            {b.excerpt && <p className="line-clamp-2 text-sm text-[var(--muted)]">{b.excerpt}</p>}
            {b.published_at && <p suppressHydrationWarning className="font-pixel text-base text-[var(--muted)]">{new Date(b.published_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>}</li>))}</ul>
      )}
    </section>
  );
}

export function BadgeRow({ badges }: { badges: { key: string; name: string; description: string; color: string }[] }) {
  if (!badges.length) return null;
  return (
    <ul className="flex flex-wrap gap-1.5 pt-1" aria-label="Badges">
      {badges.map((b) => <li key={b.key} title={b.description} className="px-2 font-pixel text-lg leading-tight text-ink" style={{ background: b.color }}>{b.name.toUpperCase()}</li>)}
    </ul>
  );
}
export { Avatar };
