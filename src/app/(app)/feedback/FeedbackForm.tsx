'use client';
import { useActionState } from 'react';
import { sendFeedback, type FeedbackState } from './actions';

export function FeedbackForm({ email, from }: { email: string; from: string }) {
  const [state, action, pending] = useActionState<FeedbackState, FormData>(sendFeedback, {});
  if (state.ok) return (
    <div role="status" className="flex flex-col gap-2"><p className="pixel text-2xl text-lime">MESSAGE SENT</p>
      <p className="text-muted">Thanks! Darren reads every one of these. If you asked for a reply, it’ll come to your email.</p>
      <a href="/feedback" className="link self-start">Send another</a></div>
  );
  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="page" value={from} />
      <fieldset className="flex flex-wrap gap-2"><legend className="label mb-2">This is…</legend>
        {[['idea', '💡 An idea'], ['question', '❓ A question'], ['bug', '🐛 Something’s broken'], ['other', '💬 Something else']].map(([v, l], i) => (
          <label key={v} className="flex min-h-11 cursor-pointer items-center gap-2 border-2 border-line px-3 has-[:checked]:border-cyan">
            <input type="radio" name="kind" value={v} defaultChecked={i === 0} className="h-4 w-4 accent-pink" />{l}</label>
        ))}
      </fieldset>
      <label className="flex flex-col gap-2"><span className="label">Your message</span>
        <textarea name="message" required minLength={3} maxLength={4000} rows={6} className="field" placeholder="Like: “This is cool! I want to be able to video chat on here.”" /></label>
      <label className="flex min-h-11 items-center gap-3"><input type="checkbox" name="reply" defaultChecked className="h-5 w-5 accent-pink" />
        <span>Email me back at <b>{email}</b></span></label>
      {state.error && <p role="alert" className="text-sm text-[#FF8A8A]">{state.error}</p>}
      <button type="submit" className="btn-cyan self-start" disabled={pending}>{pending ? 'Sending…' : 'Send it'}</button>
    </form>
  );
}
