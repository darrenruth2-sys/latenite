'use client';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { friendlyError } from '@/lib/utils';
import { sendKeysToWaiting } from './actions';

type S = { on: boolean; cap: number; given: number; sent: number; failed: number; used: number; waiting: number; on_list: number };

/** Auto-keys: the first N people on the waitlist get a personal beta key by email. */
export function AutoInvites({ emailReady }: { emailReady: boolean }) {
  const sb = createClient();
  const [s, setS] = useState<S | null>(null);
  const [cap, setCap] = useState(5000);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok?: string; error?: string }>({});
  async function load() {
    const { data, error } = await sb.rpc('mod_auto_invite_status');
    if (error) { setMsg({ error: friendlyError(error) }); return; }
    setS(data as S); setCap((data as S).cap);
  }
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  async function save(on: boolean) {
    setBusy(true); setMsg({});
    const { error } = await sb.rpc('mod_set_auto_invite', { p_on: on, p_cap: cap });
    setBusy(false);
    if (error) setMsg({ error: friendlyError(error) }); else { setMsg({ ok: on ? `Auto-keys ON for the first ${cap.toLocaleString()} people.` : 'Auto-keys OFF.' }); load(); }
  }
  async function backfill() {
    if (!confirm(`Email a beta key to the people already waiting (up to ${Math.min(100, s?.waiting ?? 0)} now)?`)) return;
    setBusy(true); setMsg({});
    const r = await sendKeysToWaiting().catch(() => ({ error: 'Couldn’t send.' } as { error: string; ok?: string }));
    setBusy(false); setMsg(r); load();
  }
  if (!s) return null;
  return (
    <div className="flex flex-col gap-3 border-2 border-line p-3">
      <div className="flex flex-wrap items-center gap-3">
        <b className={s.on ? 'text-lime' : 'text-amber'}>{s.on ? '📬 Auto-keys are ON' : '📭 Auto-keys are OFF'}</b>
        <span className="text-sm text-muted">{s.given.toLocaleString()} / {s.cap.toLocaleString()} keys given · {s.sent.toLocaleString()} emailed · {s.used.toLocaleString()} used to join · {s.waiting.toLocaleString()} waiting{s.failed ? ` · ${s.failed} failed` : ''}</span>
      </div>
      {!emailReady && <p role="note" className="border-2 border-amber px-2 py-1.5 text-sm text-amber">Email isn’t set up yet, so no keys go out. Add RESEND_API_KEY in Vercel once Resend says your domain is verified.</p>}
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-sm">First how many people get a key<input type="number" className="field min-h-10 w-32" min={0} max={100000} value={cap} onChange={(e) => setCap(+e.target.value)} /></label>
        <button type="button" className={s.on ? 'btn-ghost btn-sm' : 'btn-cyan btn-sm'} disabled={busy} onClick={() => save(!s.on)}>{s.on ? 'Turn auto-keys off' : 'Turn auto-keys on'}</button>
        {s.on && cap !== s.cap && <button type="button" className="btn-ghost btn-sm" disabled={busy} onClick={() => save(true)}>Save limit</button>}
        {s.on && emailReady && (s.waiting > 0 || s.failed > 0) && <button type="button" className="btn-ghost btn-sm" disabled={busy} onClick={backfill}>Send keys to people already waiting</button>}
      </div>
      <p className="text-xs text-dim">When it’s on, everyone who signs the guestbook on the coming-soon page gets their own one-time key by email, until the limit. After that they just stay on the waitlist.</p>
      {msg.ok && <p role="status" className="text-sm text-lime">{msg.ok}</p>}
      {msg.error && <p role="alert" className="text-sm text-[#FF8A8A]">{msg.error}</p>}
    </div>
  );
}
