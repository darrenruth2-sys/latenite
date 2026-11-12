'use client';
import { useActionState, useState } from 'react';
import { changePassword, deleteAccount } from '@/app/actions/account';
import { FormMessage, Submit } from '@/components/FormBits';
import { Captcha } from '@/components/Captcha';

export function AccountForms({ email }: { email: string }) {
  const [pw, pwAction] = useActionState(changePassword, undefined);
  const [del, delAction] = useActionState(deleteAccount, undefined);
  const [showDelete, setShowDelete] = useState(false);
  return (
    <div className="flex flex-col gap-6">
      <h2 className="font-display text-3xl font-extrabold">Account &amp; data</h2>
      <section className="panel flex flex-col gap-1 p-5"><span className="label">Email</span><p>{email}</p></section>
      <form action={pwAction} className="panel flex flex-col gap-3 p-5" aria-labelledby="pw-h">
        <h3 id="pw-h" className="label">Change password</h3>
        <label className="flex flex-col gap-2"><span className="text-sm text-muted">Current password</span><input className="field" type="password" name="current" autoComplete="current-password" required /></label>
        <label className="flex flex-col gap-2"><span className="text-sm text-muted">New password</span><input className="field" type="password" name="password" autoComplete="new-password" minLength={8} required /></label>
        <Captcha resetKey={pw} />
        <FormMessage error={pw?.error} ok={pw?.ok} />
        <Submit className="btn-cyan self-start" pendingText="Saving…">Change password</Submit>
      </form>
      <section className="panel flex flex-col gap-3 p-5" aria-labelledby="exp-h">
        <h3 id="exp-h" className="label">Download your data</h3>
        <p className="text-sm text-muted">Everything you&apos;ve put on SignedOn — profile, posts, comments, guestbook entries, messages you sent, settings — as one JSON file.</p>
        <a href="/api/export" className="btn-ghost self-start" download>Download my data</a>
      </section>
      <section className="flex flex-col gap-3 border-2 border-[#FF5A5A] bg-panel p-5" aria-labelledby="del-h">
        <h3 id="del-h" className="label text-[#FF8A8A]">Delete account</h3>
        <p className="text-sm text-muted">This permanently deletes your page, posts, messages, guestbook entries and uploads. It can&apos;t be undone.</p>
        {!showDelete ? <button type="button" className="btn-ghost self-start border-[#FF5A5A]" onClick={() => setShowDelete(true)}>Delete my account…</button> : (
          <form action={delAction} className="flex flex-col gap-3">
            <label className="flex flex-col gap-2"><span className="text-sm">Type your username to confirm</span><input className="field" name="confirm" autoComplete="off" required /></label>
            <label className="flex flex-col gap-2"><span className="text-sm">Your password</span><input className="field" type="password" name="password" autoComplete="current-password" required /></label>
            <Captcha resetKey={del} />
            <FormMessage error={del?.error} />
            <Submit className="btn self-start border-fg bg-[#FF5A5A] text-ink" pendingText="Deleting…">Permanently delete</Submit>
          </form>
        )}
      </section>
    </div>
  );
}
