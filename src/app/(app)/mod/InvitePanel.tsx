'use client';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { friendlyError } from '@/lib/utils';
import { AutoInvites } from './AutoInvites';

type Invite = { code: string; batch: string; note: string | null; created_at: string; max_uses: number; uses: number; expires_at: string | null; revoked: boolean; used_by: string[] };

/** Beta keys: turn invite-only on/off, make batches of codes, copy their links, see who used them. */
export function InvitePanel({ inviteOnly: initialOnly, emailReady = false }: { inviteOnly: boolean; emailReady?: boolean }) {
  const sb = createClient();
  const [only, setOnly] = useState(initialOnly);
  const [list, setList] = useState<Invite[]>([]);
  const [count, setCount] = useState(25);
  const [batch, setBatch] = useState('beta-1');
  const [uses, setUses] = useState(1);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok?: string; error?: string }>({});
  const [show, setShow] = useState<'unused' | 'used' | 'all'>('unused');
  const origin = typeof window === 'undefined' ? '' : window.location.origin;

  async function load() {
    const { data, error } = await sb.rpc('mod_invites', { p_batch: null });
    if (error) setMsg({ error: friendlyError(error) }); else setList((data || []) as Invite[]);
  }
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function make(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setMsg({});
    const { data, error } = await sb.rpc('mod_create_invites', { p_count: count, p_batch: batch, p_max_uses: uses, p_expires_days: null, p_note: null });
    setBusy(false);
    if (error) { setMsg({ error: friendlyError(error) }); return; }
    setMsg({ ok: `Made ${(data as string[]).length} codes in “${batch}”.` }); load();
  }
  async function toggle() {
    setBusy(true); const next = !only;
    const { error } = await sb.rpc('mod_set_invite_only', { p_on: next });
    setBusy(false);
    if (error) setMsg({ error: friendlyError(error) }); else { setOnly(next); setMsg({ ok: next ? 'Invite-only is ON: new accounts need a code.' : 'Invite-only is OFF: anyone can sign up.' }); }
  }
  async function revoke(code: string) {
    if (!confirm(`Turn off ${code}? Anyone who hasn’t used it yet won’t be able to.`)) return;
    await sb.rpc('mod_revoke_invite', { p_code: code }); load();
  }
  const unused = list.filter((i) => !i.revoked && i.uses < i.max_uses);
  const shown = show === 'unused' ? unused : show === 'used' ? list.filter((i) => i.uses > 0) : list;
  async function copy(items: Invite[]) {
    const text = items.map((i) => `${origin}/join/${i.code}`).join('\n');
    try { await navigator.clipboard.writeText(text); setMsg({ ok: `Copied ${items.length} invite link${items.length === 1 ? '' : 's'}.` }); }
    catch { setMsg({ error: 'Couldn’t copy. Select the links and copy them by hand.' }); }
  }

  return (
    <section aria-labelledby="inv-h" className="flex flex-col gap-3">
      <h2 id="inv-h" className="label text-lime">Beta invite codes ({unused.length} unused · {list.reduce((n, i) => n + i.uses, 0)} people joined with one)</h2>
      <div className="panel flex flex-col gap-4 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <b className={only ? 'text-lime' : 'text-amber'}>{only ? '🔒 Invite-only is ON' : '🔓 Invite-only is OFF'}</b>
          <button type="button" className="btn-ghost btn-sm" disabled={busy} onClick={toggle}>{only ? 'Let anyone sign up' : 'Require invite codes'}</button>
        </div>
        <AutoInvites emailReady={emailReady} />
        <span className="label text-dim">Make codes by hand (for people who reach out)</span>
        <form onSubmit={make} className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-sm">How many<input type="number" className="field min-h-10 w-24" min={1} max={500} value={count} onChange={(e) => setCount(+e.target.value)} /></label>
          <label className="flex flex-col gap-1 text-sm">Batch name<input className="field min-h-10 w-40" maxLength={40} value={batch} onChange={(e) => setBatch(e.target.value)} /></label>
          <label className="flex flex-col gap-1 text-sm">People per code<input type="number" className="field min-h-10 w-24" min={1} max={1000} value={uses} onChange={(e) => setUses(+e.target.value)} /></label>
          <button type="submit" className="btn-cyan btn-sm" disabled={busy}>Make codes</button>
        </form>
        <p className="text-xs text-dim">Each link signs one person up (or more, if you set “people per code” higher, like one code for a whole class). Send links one per person.</p>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          {(['unused', 'used', 'all'] as const).map((k) => <button key={k} type="button" onClick={() => setShow(k)} className={show === k ? 'btn-cyan btn-sm' : 'btn-ghost btn-sm'}>{k}</button>)}
          {show === 'unused' && unused.length > 0 && <button type="button" className="btn-ghost btn-sm" onClick={() => copy(unused)}>Copy all {unused.length} links</button>}
        </div>
        {msg.ok && <p role="status" className="text-sm text-lime">{msg.ok}</p>}
        {msg.error && <p role="alert" className="text-sm text-[#FF8A8A]">{msg.error}</p>}
        <ul className="flex max-h-96 flex-col overflow-y-auto border-2 border-line text-sm" aria-label="Invite codes">
          {shown.length === 0 && <li className="p-3 text-dim">None here.</li>}
          {shown.map((i) => (
            <li key={i.code} className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-line p-2.5 last:border-0">
              <code className="font-mono font-bold">{i.code}</code>
              <span className="chip">{i.batch}</span>
              <span className="text-dim">{i.revoked ? 'turned off' : `${i.uses}/${i.max_uses} used`}</span>
              {i.used_by.length > 0 && <span className="text-dim">by {i.used_by.map((u) => '@' + u).join(', ')}</span>}
              <span className="ml-auto flex gap-1">
                {!i.revoked && i.uses < i.max_uses && <button type="button" className="btn-ghost btn-sm" onClick={() => copy([i])}>Copy link</button>}
                {!i.revoked && i.uses < i.max_uses && <button type="button" className="btn-ghost btn-sm" onClick={() => revoke(i.code)}>Turn off</button>}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
