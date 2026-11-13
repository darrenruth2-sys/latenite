'use client';
import { takedownRemove } from './actions';
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
  const [err, setErr] = useState(''); const [ok, setOk] = useState(''); const [busy, setBusy] = useState(false); const router = useRouter();
  const [link, setLink] = useState(''); const [choose, setChoose] = useState<{ target_type: string; target_id: string; label: string }[] | null>(null);
  async function set(status: 'removed' | 'rejected' | 'reported') {
    const note = prompt(status === 'rejected' ? 'Why is this request being rejected? (saved for your records)' : status === 'reported' ? 'CyberTipline report number (saved for your records)' : 'What did you remove, and how? (saved for your records)') || null;
    if (status !== 'rejected' && !note) return;
    setBusy(true); const { error } = await createClient().rpc('mod_resolve_takedown', { p_id: id, p_status: status, p_note: note }); setBusy(false);
    if (error) setErr(friendlyError(error)); else router.refresh();
  }
  async function remove(pick?: { type: string; id: string }) {
    setErr(''); setOk(''); setBusy(true);
    const r = await takedownRemove(id, link, pick).catch(() => ({ error: 'Couldn’t remove it.' } as { error: string; ok?: string; choose?: undefined }));
    setBusy(false);
    if (r.choose) { setChoose(r.choose); return; }
    if (r.error) { setErr(r.error); return; }
    setChoose(null); setOk(r.ok || 'Removed.'); router.refresh();
  }
  return (
    <div className="flex flex-col gap-2">
      <form className="flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); remove(); }}>
        <label htmlFor={`td-link-${id}`} className="sr-only">Link to the content</label>
        <input id={`td-link-${id}`} className="field min-h-10 min-w-[220px] flex-1 text-sm" placeholder="Paste the link to the content (post, profile, blog, picture)" value={link} onChange={(e) => setLink(e.target.value)} />
        <button type="submit" className={kind === 'child_safety' ? 'btn btn-sm border-fg bg-[#FF5A5A] text-ink' : 'btn-cyan btn-sm'} disabled={busy || !link.trim()}>
          {kind === 'child_safety' ? 'Preserve + take down' : 'Remove it'}</button>
      </form>
      {choose && (
        <div className="flex flex-wrap items-center gap-2 text-sm"><span className="text-dim">That link matches more than one thing. Which one?</span>
          {choose.map((c) => <button key={c.target_type + c.target_id} type="button" className="btn-ghost btn-sm" disabled={busy} onClick={() => remove({ type: c.target_type, id: c.target_id })}>{c.label}</button>)}</div>
      )}
      <div className="flex flex-wrap gap-2">
        {kind === 'child_safety'
          ? <button className="btn-ghost btn-sm" disabled={busy} onClick={() => set('reported')}>Reported to NCMEC (add report number)</button>
          : <button className="btn-ghost btn-sm" disabled={busy} onClick={() => set('removed')}>I removed it another way</button>}
        <button className="btn-ghost btn-sm" disabled={busy} onClick={() => set('rejected')}>Reject request</button>
      </div>
      {ok && <span role="status" className="text-sm text-lime">{ok}</span>}
      {err && <span role="alert" className="text-sm text-[#FF8A8A]">{err}</span>}
    </div>
  );
}

export function FeedbackDone({ id, status }: { id: string; status: string }) {
  const router = useRouter(); const [busy, setBusy] = useState(false);
  if (status === 'done') return <span className="text-dim">Done</span>;
  return <button type="button" className="btn-ghost btn-sm" disabled={busy} onClick={async () => {
    setBusy(true); await createClient().rpc('mod_feedback_status', { p_id: id, p_status: 'done' }); setBusy(false); router.refresh();
  }}>Mark done</button>;
}
