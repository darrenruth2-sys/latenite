'use client';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

const REASONS: [string, string][] = [['spam', 'Spam'], ['harassment', 'Harassment or bullying'], ['hate', 'Hate speech'], ['sexual', 'Sexual content'],
  ['intimate_image', 'Intimate image shared without consent'], ['child_safety', 'Sexualizes or endangers a child'],
  ['violence', 'Violence or threats'], ['self_harm', 'Self-harm'], ['impersonation', 'Pretending to be someone'], ['copyright', 'Copyright (my work used without permission)'],
  ['underage', 'Might be under 18'], ['other', 'Something else']];
const SONG: [string, string] = ['music', 'Profile song: not music, offensive or too loud'];

export function ReportButton({ type, id, owner, meId, label = 'Report', className = '', initialReason = 'spam' }: { type: string; id: string; owner?: string | null; meId: string | null; label?: string; className?: string; initialReason?: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState(initialReason);
  const reasons = type === 'profile' ? [SONG, ...REASONS] : REASONS;
  const [details, setDetails] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  if (!meId) return null;
  async function send() {
    setState('sending');
    const { error } = await createClient().from('reports').insert({ reporter_id: meId, target_type: type, target_id: id, target_owner: owner || null, reason, details: details.trim() || null });
    setState(error ? 'error' : 'sent');
  }
  return (
    <>
      <button type="button" onClick={() => { setOpen(true); setState('idle'); }} className={className || 'min-h-9 px-2 text-sm text-dim hover:text-fg'}>{label}</button>
      {open && (
        <div role="dialog" aria-modal="true" aria-labelledby="rep-title" className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center" onClick={(e) => e.target === e.currentTarget && setOpen(false)}>
          <div className="w-full max-w-md border-2 border-fg bg-panel p-5 text-fg shadow-[8px_8px_0_var(--color-amber)]">
            <h2 id="rep-title" className="font-display text-2xl font-extrabold">Report this</h2>
            {state === 'sent' ? (
              <div className="mt-3 flex flex-col gap-4"><p className="text-muted">Thanks. A moderator will look at it. You can also block this person from their page.</p>
                <button className="btn-cyan" onClick={() => setOpen(false)}>Done</button></div>
            ) : (
              <div className="mt-3 flex flex-col gap-3">
                <fieldset className="flex flex-col gap-1"><legend className="label mb-2">What&apos;s wrong?</legend>
                  {reasons.map(([v, l]) => (
                    <label key={v} className="flex min-h-9 items-center gap-3"><input type="radio" name="reason" value={v} checked={reason === v} onChange={() => setReason(v)} className="h-4 w-4 accent-pink" />{l}</label>
                  ))}
                </fieldset>
                <label className="flex flex-col gap-2"><span className="label">Anything else? (optional)</span>
                  <textarea className="field" rows={2} maxLength={1000} value={details} onChange={(e) => setDetails(e.target.value)} /></label>
                {state === 'error' && <p role="alert" className="text-sm text-[#FF8A8A]">Couldn&apos;t send that. Try again.</p>}
                <div className="flex gap-2"><button className="btn-pink" disabled={state === 'sending'} onClick={send}>{state === 'sending' ? 'Sending…' : 'Send report'}</button>
                  <button className="btn-ghost" onClick={() => setOpen(false)}>Cancel</button></div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
