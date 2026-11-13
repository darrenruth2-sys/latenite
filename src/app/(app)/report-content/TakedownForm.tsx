'use client';
import { useActionState, useState } from 'react';
import { submitTakedown, type TakedownState } from './actions';
import { Captcha } from '@/components/Captcha';

const KINDS: [string, string][] = [
  ['intimate_image', 'An intimate image or video of me shared without my consent (including fakes/AI)'],
  ['child_safety', 'Content that sexualizes or endangers a child'],
  ['copyright', 'Copyright infringement (DMCA notice)'],
  ['impersonation', 'Someone is pretending to be me or my organization'],
  ['privacy', 'My private information was posted (address, phone, ID…)'],
  ['other', 'Something else that breaks the rules or the law'],
];

export function TakedownForm({ initialKind, contactEmail }: { initialKind: string; contactEmail: string }) {
  const [state, action, pending] = useActionState<TakedownState, FormData>(submitTakedown, {});
  const [kind, setKind] = useState(KINDS.some(([k]) => k === initialKind) ? initialKind : 'other');
  if (state.ok) {
    return (
      <div role="status" className="border-2 border-lime p-5">
        <p className="pixel text-xl text-lime">&gt; REQUEST RECEIVED</p>
        <p className="mt-2 text-lg font-bold">Reference #{state.id}</p>
        <p className="mt-2 text-muted">{kind === 'intimate_image' || kind === 'child_safety'
          ? 'This is treated as urgent. Valid requests are acted on within 48 hours, and we’ll email you when it’s done.'
          : 'We’ll review it and email you. Keep your reference number.'}</p>
      </div>
    );
  }
  const needsOath = kind === 'intimate_image' || kind === 'copyright';
  return (
    <form action={action} className="flex flex-col gap-4">
      {kind === 'child_safety' && (
        <div role="alert" className="border-2 border-[#FF5A5A] p-4 text-sm leading-relaxed">
          <b>If a child is in immediate danger, call 911.</b> You can also report directly to the National Center for Missing &amp; Exploited Children at{' '}
          <a className="link" href="https://report.cybertip.org" target="_blank" rel="noopener noreferrer">report.cybertip.org</a> or 1-800-843-5678.
          Please don’t download, copy or forward the content, even to show us. Just send the link.
        </div>
      )}
      <fieldset className="flex flex-col gap-2">
        <legend className="label mb-1">What’s the problem?</legend>
        {KINDS.map(([v, l]) => (
          <label key={v} className="flex min-h-10 items-start gap-3 text-sm"><input type="radio" name="kind" value={v} checked={kind === v} onChange={() => setKind(v)} className="mt-1 h-4 w-4 accent-pink" />{l}</label>
        ))}
      </fieldset>
      <label className="flex flex-col gap-1"><span className="label">Link(s) to the content, or the username</span>
        <textarea name="urls" required rows={3} maxLength={4000} className="field" placeholder="https://signedon.social/u/…" /></label>
      <label className="flex flex-col gap-1"><span className="label">{kind === 'copyright' ? 'Describe your copyrighted work and how it’s being infringed' : 'What happened?'}</span>
        <textarea name="description" required rows={4} maxLength={5000} className="field" /></label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1"><span className="label">Your full name</span><input name="name" required maxLength={200} className="field" autoComplete="name" /></label>
        <label className="flex flex-col gap-1"><span className="label">Your email</span><input name="email" type="email" required maxLength={254} className="field" autoComplete="email" /></label>
      </div>
      {kind === 'copyright' && (
        <label className="flex flex-col gap-1"><span className="label">Your mailing address and phone (required for copyright notices)</span>
          <textarea name="contact" required rows={2} maxLength={1000} className="field" /></label>
      )}
      {kind === 'intimate_image' && (
        <label className="flex items-start gap-3 text-sm"><input type="checkbox" name="is_subject" className="mt-1 h-5 w-5 accent-pink" />
          <span>I am the person shown, or I’m authorized to act on their behalf.</span></label>
      )}
      {needsOath && (
        <>
          <label className="flex items-start gap-3 text-sm"><input type="checkbox" name="sworn" className="mt-1 h-5 w-5 accent-pink" />
            <span>{kind === 'copyright'
              ? 'I have a good-faith belief that this use isn’t authorized by the copyright owner, its agent, or the law. Under penalty of perjury, the information in this notice is accurate and I am the owner, or authorized to act for the owner, of the copyright being infringed.'
              : 'I have a good-faith belief that this image or video was shared without the consent of the person shown, and the information in this request is accurate.'}</span></label>
          <label className="flex flex-col gap-1"><span className="label">Type your full name as your electronic signature</span>
            <input name="signature" required maxLength={200} className="field" /></label>
        </>
      )}
      <Captcha resetKey={state} />
      {state.error && <p role="alert" className="text-sm text-[#FF8A8A]">{state.error}</p>}
      <button type="submit" disabled={pending} className="btn-pink self-start">{pending ? 'Sending…' : 'Send request'}</button>
      <p className="text-xs text-dim">Prefer email? {contactEmail}. We use what you send only to handle this request. For copyright notices, we may share your notice (including your name) with the person who posted the content.</p>
    </form>
  );
}
