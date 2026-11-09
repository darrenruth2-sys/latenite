'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { friendlyError } from '@/lib/utils';
import type { Relation } from '@/lib/profile';

export function FriendButton({ otherId, rel, requestId, name, className = 'btn-pink' }: { otherId: string; rel: Relation; requestId?: string; name: string; className?: string }) {
  const [state, setState] = useState(rel);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [menu, setMenu] = useState(false);
  const router = useRouter();
  const sb = createClient();
  async function run(fn: () => PromiseLike<{ data?: unknown; error: unknown }>, next: Relation) {
    setBusy(true); setErr('');
    const { data, error } = await fn();
    setBusy(false);
    if (error) { setErr(friendlyError(error)); return; }
    setState(data === 'accepted' || data === 'already_friends' ? 'friends' : next); setMenu(false); router.refresh();
  }
  if (state === 'self' || state === 'blocked') return null;
  return (
    <div className="relative flex flex-col gap-1">
      {state === 'none' && <button disabled={busy} className={className} onClick={() => run(() => sb.rpc('send_friend_request', { p_target: otherId }), 'outgoing')}>Add friend</button>}
      {state === 'outgoing' && <button disabled={busy} className="btn-ghost" onClick={() => run(() => sb.rpc('cancel_friend_request', { p_target: otherId }), 'none')}>Request sent · Cancel</button>}
      {state === 'incoming' && (
        <div className="flex gap-2">
          <button disabled={busy} className={className} onClick={() => run(() => sb.rpc('respond_friend_request', { p_request: requestId, p_accept: true }), 'friends')}>Accept request</button>
          <button disabled={busy} className="btn-ghost" onClick={() => run(() => sb.rpc('respond_friend_request', { p_request: requestId, p_accept: false }), 'none')}>Decline</button>
        </div>
      )}
      {state === 'friends' && (
        <>
          <button className="btn-ghost" aria-expanded={menu} onClick={() => setMenu((m) => !m)}>✓ Friends</button>
          {menu && (
            <div className="absolute left-0 top-12 z-20 w-52 border-2 border-fg bg-panel p-1 shadow-[4px_4px_0_var(--color-pink)]">
              <button disabled={busy} className="w-full px-3 py-2.5 text-left hover:bg-panel2"
                onClick={() => { if (confirm(`Unfriend ${name}?`)) run(() => sb.rpc('unfriend', { p_other: otherId }), 'none'); }}>Unfriend</button>
            </div>
          )}
        </>
      )}
      {err && <p role="alert" className="text-sm text-[#FF8A8A]">{err}</p>}
    </div>
  );
}
