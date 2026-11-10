'use client';
import { useActionState } from 'react';
import { joinWaitlist } from './actions';

export function GuestbookForm({ initialCount }: { initialCount: number }) {
  const [state, action, pending] = useActionState(joinWaitlist, undefined);
  const count = state?.count ?? initialCount;
  return (
    <div className="flex flex-col gap-5">
      <HitCounter count={count} />
      {state?.ok ? (
        <div role="status" className="border-2 border-dashed border-lime bg-[#0f2a1a] p-5">
          <p className="pixel text-2xl text-lime">&gt; GUESTBOOK SIGNED ✔</p>
          <p className="mt-2 text-lg">{state.message}</p>
        </div>
      ) : (
        <form action={action} className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <label htmlFor="gb-name" className="label">Your name <span className="normal-case text-dim">(optional)</span></label>
              <input id="gb-name" name="name" maxLength={40} autoComplete="nickname" className="field" placeholder="xXjulesXx" />
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="gb-email" className="label">Email</label>
              <input id="gb-email" name="email" type="email" required maxLength={254} autoComplete="email" className="field" placeholder="you@example.com" />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor="gb-miss" className="label">What do you miss most about the old internet? <span className="normal-case text-dim">(optional)</span></label>
            <textarea id="gb-miss" name="miss" maxLength={280} rows={3} className="field resize-y" placeholder="away messages with song lyrics. no shame." />
          </div>
          {/* honeypot */}
          <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
            <label htmlFor="gb-website">Website</label><input id="gb-website" name="website" tabIndex={-1} autoComplete="off" />
          </div>
          {state && !state.ok && <p role="alert" className="text-[#FF8A8A]">{state.message}</p>}
          <div className="flex flex-wrap items-center gap-3">
            <button className="btn-pink px-6 text-lg" disabled={pending}>{pending ? 'Signing…' : 'Sign the guestbook'}</button>
            <p className="text-sm text-dim">Just a launch-day email. No spam, never sold.</p>
          </div>
        </form>
      )}
    </div>
  );
}

function HitCounter({ count }: { count: number }) {
  const digits = String(Math.min(count, 999999)).padStart(6, '0').split('');
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex gap-[3px] border-2 border-[#555] bg-black p-[3px]" aria-hidden="true">
        {digits.map((d, i) => (
          <span key={i} className="flex h-10 w-7 items-center justify-center bg-[#111] pixel text-[34px] text-[#FF3B3B] [text-shadow:0_0_8px_#FF3B3B]">{d}</span>
        ))}
      </div>
      <p className="pixel text-xl text-muted">
        <span className="sr-only">{count} </span>{count === 1 ? 'person has' : 'people have'} signed the guestbook{count === 0 ? ' — be the first!' : ''}
      </p>
    </div>
  );
}
