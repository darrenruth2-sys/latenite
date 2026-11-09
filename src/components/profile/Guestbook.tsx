'use client';
import Link from 'next/link';
import { useState } from 'react';
import { Avatar } from '@/components/Avatar';
import { ReportButton } from '@/components/ReportButton';
import { createClient } from '@/lib/supabase/client';
import { uploadImage } from '@/lib/upload';
import { STICKERS } from '@/lib/theme';
import { friendlyError, timeAgo } from '@/lib/utils';

export type GbEntry = {
  id: string; profile_id: string; author_id: string; parent_id: string | null; body: string | null; sticker: string | null; image_url: string | null;
  hidden_at: string | null; created_at: string; author: { id: string; username: string; display_name: string; avatar_url: string | null };
  guestbook_reactions: { count: number }[]; liked?: boolean;
};
import { GB_SELECT } from '@/lib/guestbook';

function Sticker({ k }: { k: string }) {
  const s = STICKERS[k]; if (!s) return null;
  return <span className="inline-block -rotate-3 self-start border-2 border-ink px-2.5 py-0.5 font-pixel text-[22px]" style={{ background: s.bg, color: s.fg }}>{s.label}</span>;
}

function Composer({ profileId, meId, parentId, onDone, compact }: { profileId: string; meId: string; parentId?: string; onDone: (e: GbEntry) => void; compact?: boolean }) {
  const [body, setBody] = useState('');
  const [sticker, setSticker] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [showStickers, setShowStickers] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim() && !sticker && !file) { setErr('Write something, or add a sticker or pic.'); return; }
    setBusy(true); setErr('');
    try {
      const image_url = file ? await uploadImage(meId, file, 'guestbook', 'media', 1200) : null;
      const sb = createClient();
      const { data, error } = await sb.from('guestbook_entries').insert({ profile_id: profileId, author_id: meId, parent_id: parentId || null, body: body.trim() || null, sticker, image_url }).select(GB_SELECT).single();
      if (error) throw error;
      setBody(''); setSticker(null); setFile(null); setShowStickers(false);
      onDone(data as unknown as GbEntry);
    } catch (e) { setErr(e instanceof Error && /Upload|image/.test(e.message) ? e.message : friendlyError(e)); }
    finally { setBusy(false); }
  }
  const id = `gb-${parentId || 'new'}`;
  return (
    <form onSubmit={submit} className={`flex flex-col gap-2 border-2 border-dashed border-[var(--line)] ${compact ? 'p-2.5' : 'p-3.5'}`}>
      <label htmlFor={id} className={compact ? 'sr-only' : 'font-pixel text-xl text-[var(--muted)]'}>{parentId ? 'Reply' : 'SIGN THE GUESTBOOK'}</label>
      <textarea id={id} rows={compact ? 1 : 2} maxLength={1000} value={body} onChange={(e) => setBody(e.target.value)} placeholder={parentId ? 'write a reply…' : 'say something nice. or chaotic. your call.'}
        className="resize-y bg-transparent text-base text-[var(--text)] outline-none placeholder:text-[var(--muted)]" />
      {(sticker || file) && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          {sticker && <><Sticker k={sticker} /><button type="button" onClick={() => setSticker(null)} className="underline">remove</button></>}
          {file && <span>📎 {file.name.slice(0, 30)} <button type="button" onClick={() => setFile(null)} className="underline">remove</button></span>}
        </div>
      )}
      {showStickers && (
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Stickers">
          {Object.keys(STICKERS).map((k) => <button key={k} type="button" onClick={() => { setSticker(k); setShowStickers(false); }} className="scale-90"><Sticker k={k} /></button>)}
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-1.5">
          <button type="button" aria-label="Add a sticker" aria-expanded={showStickers} onClick={() => setShowStickers((v) => !v)} className="h-10 min-w-11 border-2 border-[var(--line)] px-2 font-bold">✶</button>
          <label className="flex h-10 min-w-11 cursor-pointer items-center justify-center border-2 border-[var(--line)] px-2" aria-label="Add a picture">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><rect x="3" y="3" width="18" height="18" /><circle cx="9" cy="9" r="2" /><path d="M21 15l-5-5L5 21" /></svg>
            <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="sr-only" onChange={(e) => setFile(e.target.files?.[0] || null)} /></label>
        </div>
        <button className="btn border-[var(--text)] bg-[var(--accent)] text-[var(--on-accent)]" disabled={busy}>{busy ? 'Posting…' : parentId ? 'Reply' : 'Sign it'}</button>
      </div>
      {err && <p role="alert" className="text-sm font-semibold text-[#FF5A5A]">{err}</p>}
    </form>
  );
}

export function Guestbook({ initial, profileId, ownerName, meId, isOwner, canSign, policy }:
  { initial: GbEntry[]; profileId: string; ownerName: string; meId: string | null; isOwner: boolean; canSign: boolean; policy: string }) {
  const [entries, setEntries] = useState(initial);
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [err, setErr] = useState('');
  const sb = createClient();
  const top = entries.filter((e) => !e.parent_id);
  const replies = (id: string) => entries.filter((e) => e.parent_id === id).sort((a, b) => a.created_at.localeCompare(b.created_at));
  async function hide(e: GbEntry) {
    const hidden_at = e.hidden_at ? null : new Date().toISOString();
    const { error } = await sb.from('guestbook_entries').update({ hidden_at }).eq('id', e.id);
    if (error) setErr(friendlyError(error)); else setEntries(entries.map((x) => (x.id === e.id ? { ...x, hidden_at } : x)));
  }
  async function del(e: GbEntry) {
    if (!confirm('Delete this guestbook entry?')) return;
    const { error } = await sb.from('guestbook_entries').delete().eq('id', e.id);
    if (error) setErr(friendlyError(error)); else setEntries(entries.filter((x) => x.id !== e.id && x.parent_id !== e.id));
  }
  async function like(e: GbEntry) {
    if (!meId) return;
    const was = !!e.liked;
    setEntries(entries.map((x) => (x.id === e.id ? { ...x, liked: !was, guestbook_reactions: [{ count: (x.guestbook_reactions[0]?.count || 0) + (was ? -1 : 1) }] } : x)));
    const { error } = was ? await sb.from('guestbook_reactions').delete().eq('entry_id', e.id).eq('user_id', meId) : await sb.from('guestbook_reactions').insert({ entry_id: e.id, user_id: meId });
    if (error && !/duplicate/.test(error.message)) setErr(friendlyError(error));
  }
  const entry = (e: GbEntry, nested?: boolean) => (
    <li key={e.id} className={`flex gap-3.5 ${nested ? 'mt-3' : 'border-b border-[var(--line)] pb-4'}`}>
      <Link href={`/u/${e.author.username}`} tabIndex={-1} aria-hidden="true"><Avatar user={e.author} size={nested ? 38 : 52} border="var(--text)" /></Link>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
          <Link href={`/u/${e.author.username}`} className="font-bold text-[var(--accent)]">{e.author.display_name}</Link>
          <time suppressHydrationWarning className="text-[13px] text-[var(--muted)]" dateTime={e.created_at}>{timeAgo(e.created_at)}</time>
          {e.hidden_at && <span className="bg-[var(--muted)] px-1.5 text-[11px] font-bold text-[var(--card)]">HIDDEN FROM VISITORS</span>}
        </div>
        <div className={`flex flex-col gap-2 ${e.hidden_at ? 'opacity-50' : ''}`}>
          {e.body && <p className="whitespace-pre-wrap break-words leading-normal">{e.body}</p>}
          {e.sticker && <Sticker k={e.sticker} />}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {e.image_url && <img src={e.image_url} alt={`Picture from ${e.author.display_name}`} loading="lazy" className="max-h-72 max-w-full self-start border-2 border-[var(--text)] object-contain" />}
        </div>
        <div className="flex flex-wrap gap-1.5 text-[13px] font-semibold">
          <button type="button" onClick={() => like(e)} aria-pressed={!!e.liked} disabled={!meId}
            className="min-h-9 border border-[var(--line)] px-2.5" style={e.liked ? { background: 'color-mix(in srgb, var(--accent) 25%, transparent)' } : undefined}>♥ {e.guestbook_reactions?.[0]?.count || 0}</button>
          {canSign && !nested && <button type="button" onClick={() => setReplyTo(replyTo === e.id ? null : e.id)} className="min-h-9 border border-[var(--line)] px-2.5">Reply</button>}
          {isOwner && <button type="button" onClick={() => hide(e)} className="min-h-9 border border-[var(--line)] px-2.5 text-[var(--muted)]">{e.hidden_at ? 'Unhide' : 'Hide'}</button>}
          {(isOwner || e.author_id === meId) && <button type="button" onClick={() => del(e)} className="min-h-9 border border-[var(--line)] px-2.5 text-[var(--muted)]">Delete</button>}
          {!isOwner && e.author_id !== meId && <ReportButton type="guestbook" id={e.id} owner={e.author_id} meId={meId} className="min-h-9 px-2.5 text-[var(--muted)]" />}
        </div>
        {!nested && (replies(e.id).length > 0 || replyTo === e.id) && (
          <ul className="border-l-2 border-[var(--line)] pl-3">
            {replies(e.id).map((r) => entry(r, true))}
            {replyTo === e.id && meId && <li className="mt-3"><Composer compact profileId={profileId} meId={meId} parentId={e.id} onDone={(n) => { setEntries([...entries, n]); setReplyTo(null); }} /></li>}
          </ul>
        )}
      </div>
    </li>
  );
  return (
    <section id="guestbook" aria-labelledby="gb-h" className="flex scroll-mt-24 flex-col gap-4 border-2 border-[var(--text)] bg-[var(--card)] p-5 rounded-[var(--radius)] sm:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="gb-h" className="text-3xl font-extrabold" style={{ fontFamily: 'var(--head)' }}>Guestbook</h2>
        <span className="font-pixel text-xl text-[var(--muted)]">{top.filter((e) => !e.hidden_at || isOwner).length} signatures</span>
      </div>
      {canSign && meId ? <Composer profileId={profileId} meId={meId} onDone={(n) => setEntries([n, ...entries])} />
        : <p className="border-2 border-dashed border-[var(--line)] p-3 text-sm text-[var(--muted)]">
            {!meId ? <><Link href="/login" className="underline">Log in</Link> to sign {ownerName}&apos;s guestbook.</> : policy === 'off' ? `${ownerName}'s guestbook is closed right now.` : `Only ${ownerName}'s friends can sign.`}</p>}
      {err && <p role="alert" className="text-sm font-semibold text-[#FF5A5A]">{err}</p>}
      {top.length === 0 ? <p className="text-[var(--muted)]">No signatures yet. Be the first.</p> : (
        <ul className="flex flex-col gap-4">{top.map((e) => entry(e))}</ul>
      )}
    </section>
  );
}
