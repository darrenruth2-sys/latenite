'use client';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Avatar } from '@/components/Avatar';
import { createClient } from '@/lib/supabase/client';
import { prepareImage, randomId } from '@/lib/images';
import { friendlyError, shortTime, timeAgo } from '@/lib/utils';
import type { Me } from '@/lib/me';

type Buddy = { id: string; username: string; display_name: string; avatar_url: string | null; mood: string | null; status: string; status_message: string | null; away_message: string | null; now_playing: string | null; last_seen_at: string | null };
type Member = { id: string; username: string; display_name: string; avatar_url: string | null; status: string | null };
type Conv = { id: string; is_group: boolean; title: string | null; last_message_at: string; muted: boolean; unread: number; last_body: string | null; last_kind: string | null; last_sender: string | null; members: Member[] };
type Msg = { id: string; conversation_id: string; sender_id: string | null; kind: string; body: string | null; media_path: string | null; created_at: string; pending?: boolean; failed?: boolean };
type Presence = { status: string; status_message: string | null; away_message: string | null; now_playing: string | null; show_now_playing: boolean };

const DOT: Record<string, string> = { online: '#22C55E', away: '#F2A900', busy: '#E5484D', offline: '#B8B3CF', invisible: '#B8B3CF' };
const LABEL: Record<string, string> = { online: 'Online', away: 'Away', busy: 'Busy', offline: 'Offline', invisible: 'Appear offline' };
const EMOTES: [string, string][] = [[':)', 'smile'], [';)', 'wink'], [':P', 'tongue'], ['<3', 'heart'], ['xD', 'laugh'], [':O', 'shocked'], ['\\m/', 'rock on'], ['o_O', 'confused']];
const AWAY_PRESETS = ['BRB', 'Out with friends', 'Sleeping. Probably.', 'At work, text me', 'Gaming, do not disturb'];

function convName(c: Conv) { return c.is_group ? c.title || 'Group chat' : c.members[0]?.display_name || 'Deleted user'; }

function beep() {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx(); const o = ctx.createOscillator(); const g = ctx.createGain();
    o.type = 'square'; o.frequency.setValueAtTime(660, ctx.currentTime); o.frequency.setValueAtTime(880, ctx.currentTime + 0.08);
    g.gain.setValueAtTime(0.06, ctx.currentTime); g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.25);
    o.connect(g).connect(ctx.destination); o.start(); o.stop(ctx.currentTime + 0.26);
  } catch { /* no audio */ }
}

export function MessengerApp({ me, initialBuddies, initialConvs, initialActive, presence, settings, startError }:
  { me: Me; initialBuddies: Buddy[]; initialConvs: Conv[]; initialActive: string | null; presence: Presence; settings: { allow_nudges: boolean; read_receipts: boolean }; startError: string }) {
  const sb = useMemo(() => createClient(), []);
  const router = useRouter();
  const params = useSearchParams();
  const [buddies, setBuddies] = useState<Buddy[]>(initialBuddies);
  const [convs, setConvs] = useState<Conv[]>(initialConvs);
  const [active, setActive] = useState<string | null>(initialActive);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [state, setState] = useState<{ user_id: string; typing: boolean; last_read_at: string | null }[]>([]);
  const [me2, setMe2] = useState<Presence>(presence);
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<Record<string, boolean>>({ Chats: true, Online: true, Away: true, Offline: false });
  const [draft, setDraft] = useState('');
  const [err, setErr] = useState(startError);
  const [shake, setShake] = useState(false);
  const [nudgeWait, setNudgeWait] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const [notifyOn, setNotifyOn] = useState(false);
  const [groupDlg, setGroupDlg] = useState(false);
  const [recording, setRecording] = useState<MediaRecorder | null>(null);
  const [recSecs, setRecSecs] = useState(0);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const listRef = useRef<HTMLDivElement>(null);
  const lastTyping = useRef(0);
  const seenIds = useRef(new Set<string>());
  const prevStatus = useRef(new Map(initialBuddies.map((b) => [b.id, b.status])));
  const activeRef = useRef<string | null>(initialActive);
  const reqSeq = useRef(0); const appliedSeq = useRef(0);
  const stickToBottom = useRef(true);
  const [netFails, setNetFails] = useState(0);
  const conv = convs.find((c) => c.id === active) || null;
  const convRef = useRef<Conv | null>(conv); convRef.current = conv;
  activeRef.current = active;

  useEffect(() => { setNotifyOn(typeof Notification !== 'undefined' && Notification.permission === 'granted'); }, []);
  useEffect(() => { const c = params.get('c'); if (c && c !== active) setActive(c); }, [params]); // eslint-disable-line react-hooks/exhaustive-deps

  const refreshLists = useCallback(async () => {
    const [b, c] = await Promise.all([sb.rpc('buddy_list'), sb.rpc('my_conversations')]);
    if (b.data) {
      const fresh = b.data as Buddy[];
      for (const x of fresh) {
        const was = prevStatus.current.get(x.id);
        if (was && was === 'offline' && x.status !== 'offline') setToast(`${x.display_name} just signed on`);
        prevStatus.current.set(x.id, x.status);
      }
      setBuddies(fresh);
    }
    if (c.data) setConvs(c.data as Conv[]);
  }, [sb]);

  const markRead = useCallback((convId: string) => {
    if (document.hidden) return; // read receipts only once you've actually looked
    sb.rpc('mark_read', { p_conv: convId }).then(() => {}, () => {});
  }, [sb]);

  const fetchMsgs = useCallback(async (convId: string, initial = false) => {
    const seq = ++reqSeq.current;
    if (initial) setLoadingMsgs(true);
    let res;
    try {
      res = await sb.from('messages').select('id, conversation_id, sender_id, kind, body, media_path, created_at')
        .eq('conversation_id', convId).order('created_at', { ascending: false }).limit(150)
        .retry(false).abortSignal(AbortSignal.timeout(8000)); // we poll anyway — fail fast so "reconnecting" shows and nothing hangs
    } catch { res = { data: null, error: new Error('network') }; }
    const { data, error } = res;
    // Ignore answers for a chat you've since left, and answers older than one already shown.
    if (convId !== activeRef.current) return;
    setLoadingMsgs(false);
    if (seq < appliedSeq.current) return;
    appliedSeq.current = seq;
    if (error || !data) { setNetFails((n) => n + 1); return; }
    setNetFails(0);
    const list = (data as Msg[]).reverse();
    const fresh = list.filter((m) => !seenIds.current.has(m.id));
    list.forEach((m) => seenIds.current.add(m.id));
    if (!initial) {
      for (const m of fresh) {
        if (m.sender_id === me.id) continue;
        if (m.kind === 'nudge') { setShake(true); setTimeout(() => setShake(false), 650); beep(); }
        if (document.hidden && notifyOn && m.kind !== 'system') {
          const who = convRef.current?.members.find((x) => x.id === m.sender_id)?.display_name || 'Someone';
          try { new Notification(m.kind === 'nudge' ? `${who} nudged you!` : `${who} says:`, { body: m.kind === 'nudge' ? '' : m.body || 'sent something', tag: convId }); } catch { /* blocked */ }
        }
      }
    }
    setMsgs((cur) => [...list, ...cur.filter((m) => (m.pending || m.failed) && m.conversation_id === convId)]);
    if (fresh.some((m) => m.sender_id !== me.id) || initial) markRead(convId);
  }, [sb, me.id, notifyOn, markRead]);

  // open a conversation
  useEffect(() => {
    if (!active) return;
    seenIds.current = new Set(); setMsgs([]); setState([]); setErr(''); stickToBottom.current = true; setNetFails(0);
    fetchMsgs(active, true).then(() => setConvs((cs) => cs.map((c) => (c.id === active ? { ...c, unread: 0 } : c))));
    const url = `/messenger?c=${active}`;
    if (window.location.search !== `?c=${active}`) window.history.replaceState(null, '', url);
  }, [active]); // eslint-disable-line react-hooks/exhaustive-deps

  // Polling: every 2.5s while the chat is on screen, every 10s in a background tab (so desktop alerts still fire),
  // plus an instant refresh from realtime when it's available and whenever you come back to the tab.
  useEffect(() => {
    let alive = true; let n = 0; let busy = false;
    const tick = async (force = false) => {
      if (!alive || !active || busy) return;
      n++;
      if (document.hidden && !force && n % 4 !== 0) return;
      busy = true;
      try {
        await fetchMsgs(active);
        const { data } = await sb.rpc('conversation_state', { p_conv: active }).abortSignal(AbortSignal.timeout(8000));
        if (alive && data && activeRef.current === active) setState(data);
      } catch { /* next tick retries */ } finally { busy = false; }
    };
    const t1 = setInterval(() => tick(), 2500);
    const t2 = setInterval(() => { if (!document.hidden) refreshLists(); }, 12000);
    const onVisible = () => { if (!document.hidden && active) { tick(true); markRead(active); refreshLists(); } };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', onVisible);
    const channel = active ? sb.channel(`conv-${active}`).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${active}` }, () => tick(true)).subscribe() : null;
    return () => {
      alive = false; clearInterval(t1); clearInterval(t2);
      document.removeEventListener('visibilitychange', onVisible); window.removeEventListener('online', onVisible);
      if (channel) sb.removeChannel(channel);
    };
  }, [active, fetchMsgs, refreshLists, markRead, sb]);

  // Follow new messages only if you're already at the bottom (or you just sent one) — never yank you while reading history.
  const lastMsg = msgs[msgs.length - 1];
  useEffect(() => {
    const el = listRef.current; if (!el) return;
    if (stickToBottom.current || (lastMsg && lastMsg.sender_id === me.id && lastMsg.pending)) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [msgs.length, lastMsg?.id, state.some((s) => s.typing)]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 5000); return () => clearTimeout(t); }, [toast]);
  useEffect(() => { if (nudgeWait <= 0) return; const t = setTimeout(() => setNudgeWait((n) => n - 1), 1000); return () => clearTimeout(t); }, [nudgeWait]);

  async function openBuddy(b: Buddy) {
    const { data, error } = await sb.rpc('start_dm', { p_other: b.id });
    if (error) { setErr(friendlyError(error)); return; }
    if (!convs.some((c) => c.id === data)) await refreshLists();
    setActive(data as string);
  }

  async function deliver(body: string, convId: string, tempId?: string) {
    const temp: Msg = { id: tempId || 'tmp-' + randomId(), conversation_id: convId, sender_id: me.id, kind: 'text', body, media_path: null, created_at: new Date().toISOString(), pending: true };
    setMsgs((m) => (tempId ? m.map((x) => (x.id === tempId ? temp : x)) : [...m, temp])); setErr('');
    stickToBottom.current = true;
    let res;
    try {
      res = await sb.from('messages').insert({ conversation_id: convId, sender_id: me.id, kind: 'text', body })
        .select('id, conversation_id, sender_id, kind, body, media_path, created_at').single();
    } catch { res = { data: null, error: new Error('network') }; }
    if (res.error || !res.data) {
      setMsgs((m) => m.map((x) => (x.id === temp.id ? { ...x, failed: true, pending: false } : x)));
      setErr(res.error?.message === 'network' ? 'Couldn’t reach LateNite. Tap Retry when you’re back online.' : friendlyError(res.error));
      return;
    }
    const saved = res.data as Msg;
    seenIds.current.add(saved.id);
    // Swap the placeholder for the real message in place — no blink.
    setMsgs((m) => (m.some((x) => x.id === saved.id) ? m.filter((x) => x.id !== temp.id) : m.map((x) => (x.id === temp.id ? saved : x))));
    if (activeRef.current === convId) fetchMsgs(convId);
    refreshLists();
  }
  async function send(e?: React.FormEvent) {
    e?.preventDefault();
    const body = draft.trim(); if (!body || !active) return;
    setDraft('');
    await deliver(body, active);
  }
  function retry(m: Msg) { if (m.body && m.conversation_id) deliver(m.body, m.conversation_id, m.id); }
  function discard(m: Msg) { setMsgs((list) => list.filter((x) => x.id !== m.id)); setErr(''); }

  async function sendMedia(kind: 'image' | 'voice', blob: Blob, ext: string) {
    if (!active) return;
    setErr('');
    const path = `${active}/${me.id}/${randomId()}.${ext}`;
    const up = await sb.storage.from('private-media').upload(path, blob, { contentType: blob.type });
    if (up.error) { setErr('Upload failed. Try again.'); return; }
    const { error } = await sb.from('messages').insert({ conversation_id: active, sender_id: me.id, kind, media_path: path });
    if (error) setErr(friendlyError(error)); else { await fetchMsgs(active); refreshLists(); }
  }
  async function pickImage(f?: File) {
    if (!f) return;
    try { const b = await prepareImage(f, 1600); await sendMedia('image', b, b.type === 'image/gif' ? 'gif' : 'webp'); } catch (e) { setErr(e instanceof Error ? e.message : 'Couldn’t send that image.'); }
  }
  async function toggleRecord() {
    if (recording) { recording.stop(); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const type = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4';
      const rec = new MediaRecorder(stream, { mimeType: type }); const chunks: Blob[] = [];
      rec.ondataavailable = (ev) => chunks.push(ev.data);
      let secs = 0; setRecSecs(0);
      const timer = setInterval(() => { secs++; setRecSecs(secs); if (secs >= 60) rec.stop(); }, 1000);
      rec.onstop = async () => {
        clearInterval(timer); stream.getTracks().forEach((t) => t.stop()); setRecording(null);
        if (secs >= 1) await sendMedia('voice', new Blob(chunks, { type }), type === 'audio/webm' ? 'webm' : 'mp4');
      };
      rec.start(); setRecording(rec);
    } catch { setErr('Microphone access was blocked.'); }
  }

  async function nudge() {
    if (!active || nudgeWait > 0) return;
    const { error } = await sb.rpc('send_nudge', { p_conv: active });
    if (error) { setErr(friendlyError(error)); return; }
    setShake(true); setTimeout(() => setShake(false), 650); setNudgeWait(10); fetchMsgs(active);
  }

  function onDraft(v: string) {
    setDraft(v);
    if (active && v && Date.now() - lastTyping.current > 3000) { lastTyping.current = Date.now(); sb.rpc('set_typing', { p_conv: active, p_typing: true }).then(() => {}, () => {}); }
  }

  async function savePresence(patch: Partial<Presence>) {
    const next = { ...me2, ...patch }; setMe2(next);
    await sb.rpc('heartbeat');
    const { error } = await sb.from('presence').update(patch).eq('user_id', me.id);
    if (error) setErr(friendlyError(error));
  }

  async function toggleMute() {
    if (!conv) return;
    await sb.from('conversation_members').update({ muted: !conv.muted }).eq('conversation_id', conv.id).eq('user_id', me.id);
    setConvs(convs.map((c) => (c.id === conv.id ? { ...c, muted: !c.muted } : c)));
  }
  async function leave() {
    if (!conv || !confirm('Leave this group?')) return;
    await sb.rpc('leave_group', { p_conv: conv.id }); setActive(null); refreshLists();
  }
  async function enableNotifications() {
    if (typeof Notification === 'undefined') return;
    setNotifyOn((await Notification.requestPermission()) === 'granted');
  }

  // signed URLs for private media
  useEffect(() => {
    const need = msgs.filter((m) => m.media_path && !urls[m.media_path]).map((m) => m.media_path!);
    if (!need.length) return;
    Promise.all(need.map(async (p) => [p, (await sb.storage.from('private-media').createSignedUrl(p, 3600)).data?.signedUrl] as const))
      .then((pairs) => setUrls((u) => ({ ...u, ...(Object.fromEntries(pairs.filter(([, v]) => v)) as Record<string, string>) })));
  }, [msgs]); // eslint-disable-line react-hooks/exhaustive-deps

  const ql = q.toLowerCase();
  const filtered = buddies.filter((b) => !ql || b.username.includes(ql) || b.display_name.toLowerCase().includes(ql));
  const groups: [string, Buddy[]][] = [
    ['Online', filtered.filter((b) => b.status === 'online' || b.status === 'busy')],
    ['Away', filtered.filter((b) => b.status === 'away')],
    ['Offline', filtered.filter((b) => b.status === 'offline')],
  ];
  const typingNames = state.filter((s) => s.typing).map((s) => conv?.members.find((m) => m.id === s.user_id)?.display_name).filter(Boolean);
  const lastMine = [...msgs].reverse().find((m) => m.sender_id === me.id && !m.pending && ['text', 'image', 'voice'].includes(m.kind));
  const seenBy = lastMine && !conv?.is_group ? state.find((s) => s.last_read_at && s.last_read_at >= lastMine.created_at) : null;
  const other = conv && !conv.is_group ? conv.members[0] : null;
  const otherBuddy = other ? buddies.find((b) => b.id === other.id) : null;
  const nameOf = (id: string | null) => id === me.id ? me.username : conv?.members.find((m) => m.id === id)?.username || 'someone';

  const buddyListPane = (
    <section aria-labelledby="bl-h" className={`flex w-full flex-col border-2 border-fg bg-paper text-plum shadow-[8px_8px_0_var(--color-violet)] lg:max-w-[380px] ${active ? 'hidden lg:flex' : 'flex'}`}>
      <div className="flex items-center justify-between bg-violet px-3 py-2 text-ink">
        <h2 id="bl-h" className="font-display text-base font-extrabold">Buddy list</h2>
        <button type="button" onClick={() => setGroupDlg(true)} className="min-h-8 border-2 border-ink bg-paper px-2 text-xs font-bold">+ Group</button>
      </div>
      <div className="flex flex-col gap-2.5 border-b-2 border-[#D9D2F5] bg-white p-3.5">
        <div className="flex items-center gap-3">
          <Avatar user={me} size={52} border="#1A0F2E" />
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="truncate font-bold">{me.display_name}</span>
            <label className="sr-only" htmlFor="ms-status">Your status</label>
            <div className="flex items-center gap-1.5">
              <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: DOT[me2.status] }} />
              <select id="ms-status" value={me2.status} onChange={(e) => savePresence({ status: e.target.value })} className="min-h-9 flex-1 border-2 border-plum bg-paper px-1.5 text-sm font-semibold text-plum">
                {['online', 'away', 'busy', 'invisible'].map((s) => <option key={s} value={s}>{LABEL[s]}</option>)}
              </select>
            </div>
          </div>
        </div>
        <label htmlFor="ms-pm" className="font-pixel text-[17px] text-[#5A4A80]">YOUR STATUS MESSAGE</label>
        <input id="ms-pm" maxLength={80} defaultValue={me2.status_message || ''} onBlur={(e) => e.target.value !== (me2.status_message || '') && savePresence({ status_message: e.target.value.trim() || null })}
          placeholder="what's on your mind" className="min-h-10 border-2 border-[#D9D2F5] bg-paper px-2.5 text-sm text-plum" />
        <label htmlFor="ms-np" className="font-pixel text-[17px] text-[#5A4A80]">NOW PLAYING</label>
        <div className="flex items-center gap-2">
          <input id="ms-np" maxLength={120} defaultValue={me2.now_playing || ''} onBlur={(e) => e.target.value !== (me2.now_playing || '') && savePresence({ now_playing: e.target.value.trim() || null })}
            placeholder="song — artist" className="min-h-10 flex-1 border-2 border-[#D9D2F5] bg-paper px-2.5 text-sm text-plum" />
          <label className="flex min-h-10 items-center gap-1.5 text-xs"><input type="checkbox" checked={me2.show_now_playing} onChange={(e) => savePresence({ show_now_playing: e.target.checked })} className="h-5 w-5 accent-pink" />Show</label>
        </div>
        {me2.status === 'away' && (
          <div className="flex flex-col gap-2 border-2 border-dashed border-[#B8860B] bg-[#FFF6DA] p-2.5">
            <label htmlFor="ms-away" className="font-pixel text-[17px] text-[#6B4A00]">AWAY MESSAGE (AUTO-REPLY)</label>
            <textarea id="ms-away" rows={2} maxLength={200} key={me2.away_message || ''} defaultValue={me2.away_message || ''}
              onBlur={(e) => e.target.value !== (me2.away_message || '') && savePresence({ away_message: e.target.value.trim() || null })}
              className="border-2 border-[#E5C76B] bg-white p-1.5 text-sm text-plum" />
            <div className="flex flex-wrap gap-1.5">{AWAY_PRESETS.map((t) => <button key={t} type="button" onClick={() => savePresence({ away_message: t })} className="min-h-8 border border-[#B8860B] bg-white px-2 text-xs font-semibold text-[#6B4A00]">{t}</button>)}</div>
          </div>
        )}
      </div>
      <div className="px-2.5 pt-2.5"><label htmlFor="ms-q" className="sr-only">Find a buddy</label>
        <input id="ms-q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a buddy" className="min-h-10 w-full border-2 border-[#D9D2F5] bg-white px-2.5 text-sm text-plum" /></div>
      <div className="flex max-h-[60vh] flex-col overflow-y-auto px-1.5 pb-2.5 pt-1 lg:max-h-[520px]">
        {[['Chats', convs.filter((c) => c.is_group || c.unread > 0)] as const, ...groups].map(([name, items]) => {
          if (name === 'Chats' && items.length === 0) return null;
          const isOpen = open[name] || !!ql;
          return (
            <div key={name} className="flex flex-col">
              <button type="button" aria-expanded={isOpen} onClick={() => setOpen({ ...open, [name]: !open[name] })}
                className="flex min-h-9 items-center gap-1.5 px-1.5 text-left text-[13px] font-bold uppercase tracking-wider text-[#5A4A80]">
                <span className="w-3">{isOpen ? '▾' : '▸'}</span>{name} ({items.length})</button>
              {isOpen && (
                <ul>
                  {name === 'Chats' ? (items as Conv[]).map((c) => (
                    <li key={c.id}><button type="button" onClick={() => setActive(c.id)} className={`flex min-h-12 w-full items-center gap-2.5 px-2 py-1.5 text-left hover:bg-[#E4DEFF] ${active === c.id ? 'bg-[#E4DEFF]' : ''}`}>
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center border-2 border-plum bg-amber font-display text-xs font-extrabold">{c.is_group ? 'GRP' : ''}{!c.is_group && c.members[0] && <Avatar user={c.members[0]} size={32} border="transparent" />}</span>
                      <span className="flex min-w-0 flex-1 flex-col"><span className="truncate text-sm font-semibold">{convName(c)} {c.unread > 0 && <span className="bg-pink px-1.5 text-[11px] font-bold text-ink">{c.unread}</span>}</span>
                        <span className="truncate text-xs text-[#5A4A80]">{c.last_kind === 'nudge' ? 'nudge!' : c.last_kind === 'image' ? 'photo' : c.last_kind === 'voice' ? 'voice note' : c.last_body || ''}</span></span>
                    </button></li>
                  )) : (items as Buddy[]).map((b) => {
                    const c = convs.find((x) => !x.is_group && x.members[0]?.id === b.id);
                    return (
                      <li key={b.id}><button type="button" onClick={() => openBuddy(b)} className={`flex min-h-13 w-full items-center gap-2.5 px-2 py-1.5 text-left hover:bg-[#E4DEFF] ${c && active === c.id ? 'bg-[#E4DEFF]' : ''}`}>
                        <span className="relative" style={{ opacity: b.status === 'offline' ? 0.55 : 1 }}><Avatar user={b} size={36} border="#1A0F2E" />
                          <span className="absolute -bottom-1 -right-1 h-3 w-3 rounded-full border-2 border-paper" style={{ background: DOT[b.status] }} /></span>
                        <span className="flex min-w-0 flex-1 flex-col"><span className="truncate text-sm font-semibold">{b.display_name} {c && c.unread > 0 && <span className="bg-pink px-1.5 text-[11px] font-bold text-ink">{c.unread}</span>}</span>
                          <span suppressHydrationWarning className="truncate text-xs text-[#5A4A80]">{b.now_playing ? `♫ ${b.now_playing}` : b.status === 'away' && b.away_message ? b.away_message : b.status_message || (b.status === 'offline' && b.last_seen_at ? `last on ${timeAgo(b.last_seen_at)}` : LABEL[b.status])}</span></span>
                      </button></li>
                    );
                  })}
                </ul>
              )}
            </div>
          );
        })}
        {buddies.length === 0 && <p className="p-3 text-sm text-[#5A4A80]">No buddies yet. <Link href="/discover" className="font-semibold underline">Find friends</Link> to chat with.</p>}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t-2 border-[#D9D2F5] px-3.5 py-2.5 text-[13px]">
        <button type="button" onClick={enableNotifications} disabled={notifyOn} className="min-h-8 font-semibold underline disabled:no-underline disabled:opacity-70">{notifyOn ? 'Desktop alerts on' : 'Turn on desktop alerts'}</button>
        <Link href="/settings/privacy" className="inline-flex min-h-10 items-center font-semibold underline">Nudges &amp; receipts</Link>
      </div>
    </section>
  );

  return (
    <div className="mx-auto flex max-w-[1320px] flex-col gap-6 px-4 py-6 sm:px-6 lg:flex-row lg:items-start">
      <h1 className="sr-only">Messenger</h1>
      {buddyListPane}
      <section id="chat" aria-label={conv ? `Conversation with ${convName(conv)}` : 'Conversation'}
        className={`min-w-0 flex-1 flex-col border-2 border-fg bg-white text-plum shadow-[8px_8px_0_var(--color-cyan)] ${active ? 'flex' : 'hidden lg:flex'} ${shake ? 'animate-shake' : ''}`}
        style={{ height: 'min(760px, calc(100dvh - 150px))' }}>
        {!conv ? (
          <div className="m-auto flex max-w-sm flex-col items-center gap-2 p-6 text-center">
            <p className="font-pixel text-[28px] text-[#6B2FD6]">pick someone to talk to</p>
            <p className="text-sm text-[#5A4A80]">Click a buddy to start chatting. Use + Group for group chats.</p>
            {err && <p role="alert" className="text-sm font-semibold text-[#B4232A]">{err}</p>}
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2 bg-cyan px-3 py-2 text-ink">
              <button type="button" onClick={() => setActive(null)} className="min-h-11 min-w-11 px-2 text-xl font-bold lg:hidden" aria-label="Back to buddy list">←</button>
              <h2 className="min-w-0 flex-1 truncate font-display text-base font-extrabold">{convName(conv)} — conversation</h2>
              <button type="button" onClick={toggleMute} className="min-h-8 border-2 border-ink bg-paper px-2 text-xs font-bold">{conv.muted ? 'Unmute' : 'Mute'}</button>
              {conv.is_group && <button type="button" onClick={leave} className="min-h-8 border-2 border-ink bg-paper px-2 text-xs font-bold">Leave</button>}
            </div>
            <div className="flex items-center gap-3.5 border-b-2 border-[#E4DEFF] bg-paper px-4 py-3">
              {other ? (
                <Link href={`/u/${other.username}`} aria-label={`${other.display_name}'s page`} className="relative">
                  <Avatar user={other} size={56} border="#1A0F2E" />
                  {otherBuddy && <span className="absolute -bottom-1 -right-1 h-3.5 w-3.5 rounded-full border-[3px] border-paper" style={{ background: DOT[otherBuddy.status] }} />}
                </Link>
              ) : <span className="flex h-14 w-14 items-center justify-center border-2 border-plum bg-amber font-display font-extrabold">GRP</span>}
              <div className="min-w-0 flex-1">
                <p className="truncate font-display text-xl font-extrabold">{convName(conv)} {otherBuddy && <span className="text-[13px] font-semibold text-[#5A4A80]">({LABEL[otherBuddy.status]})</span>}</p>
                <p className="truncate text-sm text-[#5A4A80]">{conv.is_group ? conv.members.map((m) => m.display_name).join(', ') : otherBuddy?.now_playing ? `♫ ${otherBuddy.now_playing}` : otherBuddy?.status_message || ''}</p>
              </div>
            </div>
            {me2.status === 'away' && me2.away_message && <p role="status" className="border-b-2 border-[#E5C76B] bg-[#FFF6DA] px-4 py-2 text-[13px] text-[#6B4A00]">You&apos;re away. People who message you get: <b>&ldquo;{me2.away_message}&rdquo;</b></p>}
            {netFails >= 2 && <p role="status" className="border-b-2 border-[#E5C76B] bg-[#FFF6DA] px-4 py-1.5 text-[13px] font-semibold text-[#6B4A00]">Connection lost — reconnecting<span className="animate-blink">…</span></p>}
            <div ref={listRef} aria-live="polite" onScroll={(e) => { const el = e.currentTarget; stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120; }}
              className="flex flex-1 flex-col gap-3.5 overflow-y-auto p-4">
              {loadingMsgs && <p className="m-auto text-sm text-[#5A4A80]">Loading…</p>}
              {!loadingMsgs && msgs.length === 0 && <div className="m-auto text-center"><p className="font-pixel text-[26px] text-[#6B2FD6]">no messages yet</p><p className="text-sm text-[#5A4A80]">Say hi. Your first message starts the conversation.</p></div>}
              {msgs.map((m) => {
                if (m.kind === 'nudge') return <p key={m.id} className="self-center border border-dashed border-pink bg-[#FFE3F1] px-3 py-0.5 font-pixel text-[19px] text-[#A1125C]">{m.sender_id === me.id ? 'You sent a nudge!' : `${nameOf(m.sender_id)} sent you a nudge!`}</p>;
                if (m.kind === 'system') return <p key={m.id} className="self-center text-xs text-[#5A4A80]">{nameOf(m.sender_id)} {m.body}</p>;
                if (m.kind === 'away') return <p key={m.id} className="self-start border-2 border-dashed border-[#B8860B] bg-[#FFF6DA] px-3 py-1 text-sm text-[#6B4A00]"><b>{nameOf(m.sender_id)} is away:</b> {m.body}</p>;
                const mine = m.sender_id === me.id;
                return (
                  <div key={m.id} className={`flex flex-col gap-0.5 ${m.pending ? 'opacity-60' : ''}`}>
                    <p className="text-[13px] font-bold" style={{ color: mine ? '#A1125C' : '#4A1AA8' }}>{nameOf(m.sender_id)} says: <span suppressHydrationWarning className="font-normal text-[#5A4A80]">{shortTime(m.created_at)}</span>
                      {m.failed && <span className="ml-1.5 font-semibold text-[#B4232A]">· not sent
                        <button type="button" onClick={() => retry(m)} className="ml-2 min-h-8 border-2 border-[#B4232A] bg-white px-2 text-xs font-bold">Retry</button>
                        <button type="button" onClick={() => discard(m)} className="ml-1 min-h-8 px-1.5 text-xs font-bold underline">Delete</button></span>}</p>
                    {m.body && <p className="whitespace-pre-wrap break-words pl-3.5 text-base leading-normal">{m.body}</p>}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {m.kind === 'image' && (m.media_path && urls[m.media_path] ? <img src={urls[m.media_path]} alt="Photo" className="ml-3.5 max-h-72 max-w-[80%] self-start border-2 border-plum object-contain" /> : <span className="ml-3.5 text-sm text-[#5A4A80]">loading photo…</span>)}
                    {m.kind === 'voice' && (m.media_path && urls[m.media_path] ? <audio controls src={urls[m.media_path]} className="ml-3.5 max-w-full" /> : <span className="ml-3.5 text-sm text-[#5A4A80]">loading voice note…</span>)}
                  </div>
                );
              })}
              {seenBy && <p className="self-end text-xs text-[#5A4A80]">Seen {shortTime(seenBy.last_read_at!)}</p>}
              {typingNames.length > 0 && <p className="text-sm text-[#5A4A80]">{typingNames.join(', ')} {typingNames.length > 1 ? 'are' : 'is'} typing<span className="animate-blink">…</span></p>}
            </div>
            <form onSubmit={send} className="flex flex-col gap-2 border-t-2 border-[#E4DEFF] bg-paper px-3.5 pb-3.5 pt-2.5">
              <div role="toolbar" aria-label="Message extras" className="flex flex-wrap items-center gap-1.5">
                {EMOTES.map(([t, l]) => <button key={t} type="button" aria-label={`Insert ${l}`} onClick={() => setDraft((d) => (d ? d + ' ' : '') + t)} className="min-h-9 min-w-10 border-2 border-[#D9D2F5] bg-white text-sm font-bold">{t}</button>)}
                <label className="flex min-h-9 min-w-10 cursor-pointer items-center justify-center border-2 border-[#D9D2F5] bg-white" aria-label="Send a photo">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><rect x="3" y="3" width="18" height="18" /><circle cx="9" cy="9" r="2" /><path d="M21 15l-5-5L5 21" /></svg>
                  <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="sr-only" onChange={(e) => { pickImage(e.target.files?.[0]); e.target.value = ''; }} /></label>
                <button type="button" onClick={toggleRecord} aria-label={recording ? 'Stop recording and send' : 'Record a voice note'} className={`min-h-9 min-w-10 border-2 px-2 text-sm font-bold ${recording ? 'border-[#E5484D] bg-[#FFE3E3] text-[#B4232A]' : 'border-[#D9D2F5] bg-white'}`}>
                  {recording ? `■ ${recSecs}s` : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" className="mx-auto"><rect x="9" y="3" width="6" height="12" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></svg>}</button>
                {!conv.is_group && (
                  <button type="button" onClick={nudge} disabled={nudgeWait > 0 || otherBuddy?.status === 'offline'} className="ml-auto min-h-9 border-2 border-plum bg-pink px-3 font-display text-sm font-extrabold text-ink disabled:bg-[#D9D2F5]">
                    {nudgeWait > 0 ? `Nudge (${nudgeWait}s)` : 'Nudge!'}</button>
                )}
              </div>
              <div className="flex gap-2">
                <label htmlFor="ms-msg" className="sr-only">Message</label>
                <input id="ms-msg" value={draft} onChange={(e) => onDraft(e.target.value)} maxLength={4000} autoComplete="off" placeholder="Type a message…"
                  className="min-h-12 min-w-0 flex-1 border-2 border-plum bg-white px-3 text-base text-plum" />
                <button type="submit" disabled={!draft.trim()} className="min-h-12 border-2 border-plum bg-[#6B2FD6] px-5 font-bold text-white disabled:opacity-50">Send</button>
              </div>
              {err && <p role="alert" className="text-sm font-semibold text-[#B4232A]">{err}</p>}
            </form>
          </>
        )}
      </section>
      {toast && (
        <div role="status" className="animate-rise fixed bottom-20 right-4 z-40 w-72 border-2 border-plum bg-paper text-plum shadow-[6px_6px_0_var(--color-lime)] md:bottom-6">
          <div className="flex items-center justify-between bg-lime px-2.5 py-1 text-xs font-bold text-ink">LateNite<button type="button" onClick={() => setToast(null)} aria-label="Dismiss" className="px-2 text-base">×</button></div>
          <p className="p-3 text-sm font-semibold">{toast}</p>
        </div>
      )}
      {groupDlg && <GroupDialog buddies={buddies} onClose={() => setGroupDlg(false)} onCreated={async (id) => { setGroupDlg(false); await refreshLists(); setActive(id); router.refresh(); }} />}
    </div>
  );
}

function GroupDialog({ buddies, onClose, onCreated }: { buddies: Buddy[]; onClose: () => void; onCreated: (id: string) => void }) {
  const [title, setTitle] = useState('');
  const [picked, setPicked] = useState<string[]>([]);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  async function create() {
    if (picked.length < 2) { setErr('Pick at least 2 friends.'); return; }
    setBusy(true);
    const { data, error } = await createClient().rpc('create_group', { p_title: title.trim() || 'Group chat', p_members: picked });
    setBusy(false);
    if (error) setErr(friendlyError(error)); else onCreated(data as string);
  }
  return (
    <div role="dialog" aria-modal="true" aria-labelledby="grp-h" className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="flex max-h-[85vh] w-full max-w-md flex-col gap-3 border-2 border-fg bg-panel p-5 shadow-[8px_8px_0_var(--color-violet)]">
        <h2 id="grp-h" className="font-display text-2xl font-extrabold">New group chat</h2>
        <label className="flex flex-col gap-2"><span className="label">Name</span><input className="field" maxLength={60} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Rink crew" /></label>
        <fieldset className="flex min-h-0 flex-col gap-1 overflow-y-auto"><legend className="label mb-2">Friends ({picked.length})</legend>
          {buddies.length === 0 && <p className="text-sm text-dim">Add some friends first.</p>}
          {buddies.map((b) => (
            <label key={b.id} className="flex min-h-11 items-center gap-3"><input type="checkbox" className="h-5 w-5 accent-pink" checked={picked.includes(b.id)}
              onChange={(e) => setPicked(e.target.checked ? [...picked, b.id] : picked.filter((x) => x !== b.id))} /><Avatar user={b} size={30} />{b.display_name}</label>
          ))}
        </fieldset>
        {err && <p role="alert" className="text-sm text-[#FF8A8A]">{err}</p>}
        <div className="flex gap-2"><button type="button" className="btn-pink" onClick={create} disabled={busy}>{busy ? 'Creating…' : 'Create group'}</button><button type="button" className="btn-ghost" onClick={onClose}>Cancel</button></div>
      </div>
    </div>
  );
}
