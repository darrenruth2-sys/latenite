'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { friendlyError } from '@/lib/utils';

export function ModActions({ reportId, ownerId, reason }: { reportId: string; ownerId: string | null; reason?: string }) {
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false); const router = useRouter();
  async function act(action: 'dismiss' | 'remove' | 'suspend' | 'preserve') {
    if (action === 'suspend' && !confirm('Remove this and suspend the account?')) return;
    if (action === 'preserve' && !confirm('Hide this, save it as evidence and suspend the account? Nothing is deleted. Then file the NCMEC CyberTipline report.')) return;
    setBusy(true); const { error } = await createClient().rpc('mod_resolve', { p_report: reportId, p_action: action }); setBusy(false);
    if (error) setErr(friendlyError(error)); else router.refresh();
  }
  return (
    <div className="flex flex-wrap gap-2">
      <button className="btn-ghost btn-sm" disabled={busy} onClick={() => act('dismiss')}>Dismiss</button>
      {reason === 'child_safety' ? (
        <button className="btn btn-sm border-fg bg-[#FF5A5A] text-ink" disabled={busy} onClick={() => act('preserve')}>Preserve evidence + suspend</button>
      ) : (<>
        <button className="btn-cyan btn-sm" disabled={busy} onClick={() => act('remove')}>Remove content</button>
        {ownerId && <button className="btn btn-sm border-fg bg-[#FF5A5A] text-ink" disabled={busy} onClick={() => act('suspend')}>Remove + suspend</button>}
      </>)}
      {err && <span role="alert" className="text-sm text-[#FF8A8A]">{err}</span>}
    </div>
  );
}
export function FeatureButton({ id }: { id: string }) {
  const [done, setDone] = useState(false);
  return <button className="btn-pink btn-sm" disabled={done} onClick={async () => { const note = prompt('Short note for the feature (optional)') || null; const { error } = await createClient().rpc('feature_profile', { p_profile: id, p_note: note }); if (!error) setDone(true); }}>{done ? 'Featured' : 'Feature'}</button>;
}

export function TakedownActions({ id, kind }: { id: string; kind: string }) {
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false); const router = useRouter();
  async function set(status: 'removed' | 'rejected' | 'reported') {
    const note = prompt(status === 'rejected' ? 'Why is this request being rejected? (saved for your records)' : 'Note for your records (what you removed / report number)') || null;
    setBusy(true); const { error } = await createClient().rpc('mod_resolve_takedown', { p_id: id, p_status: status, p_note: note }); setBusy(false);
    if (error) setErr(friendlyError(error)); else router.refresh();
  }
  return (
    <div className="flex flex-wrap gap-2">
      {kind === 'child_safety'
        ? <button className="btn btn-sm border-fg bg-[#FF5A5A] text-ink" disabled={busy} onClick={() => set('reported')}>Preserved + reported to NCMEC</button>
        : <button className="btn-cyan btn-sm" disabled={busy} onClick={() => set('removed')}>Content removed</button>}
      <button className="btn-ghost btn-sm" disabled={busy} onClick={() => set('rejected')}>Reject request</button>
      {err && <span role="alert" className="text-sm text-[#FF8A8A]">{err}</span>}
    </div>
  );
}
