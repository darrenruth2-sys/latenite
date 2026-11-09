'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { friendlyError } from '@/lib/utils';

export function ModActions({ reportId, ownerId }: { reportId: string; ownerId: string | null }) {
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false); const router = useRouter();
  async function act(action: 'dismiss' | 'remove' | 'suspend') {
    if (action === 'suspend' && !confirm('Remove this and suspend the account?')) return;
    setBusy(true); const { error } = await createClient().rpc('mod_resolve', { p_report: reportId, p_action: action }); setBusy(false);
    if (error) setErr(friendlyError(error)); else router.refresh();
  }
  return (
    <div className="flex flex-wrap gap-2">
      <button className="btn-ghost btn-sm" disabled={busy} onClick={() => act('dismiss')}>Dismiss</button>
      <button className="btn-cyan btn-sm" disabled={busy} onClick={() => act('remove')}>Remove content</button>
      {ownerId && <button className="btn btn-sm border-fg bg-[#FF5A5A] text-ink" disabled={busy} onClick={() => act('suspend')}>Remove + suspend</button>}
      {err && <span role="alert" className="text-sm text-[#FF8A8A]">{err}</span>}
    </div>
  );
}
export function FeatureButton({ id }: { id: string }) {
  const [done, setDone] = useState(false);
  return <button className="btn-pink btn-sm" disabled={done} onClick={async () => { const note = prompt('Short note for the feature (optional)') || null; const { error } = await createClient().rpc('feature_profile', { p_profile: id, p_note: note }); if (!error) setDone(true); }}>{done ? 'Featured' : 'Feature'}</button>;
}
