'use client';
import { useActionState } from 'react';
import Link from 'next/link';
import { requestReset } from '@/app/actions/auth';
import { FormMessage, Submit } from '@/components/FormBits';

export default function Forgot() {
  const [state, action] = useActionState(requestReset, undefined);
  return (
    <div className="flex flex-col gap-5">
      <h1 className="font-display text-4xl font-extrabold tracking-tight">Reset your password</h1>
      <p className="text-muted">Enter your email and we&apos;ll send you a link to pick a new password.</p>
      <form action={action} className="flex flex-col gap-4">
        <label className="flex flex-col gap-2"><span className="label">Email</span>
          <input className="field" type="email" name="email" autoComplete="email" required /></label>
        <FormMessage error={state?.error} ok={state?.ok} />
        <Submit pendingText="Sending…">Send reset link</Submit>
      </form>
      <Link href="/login" className="link text-sm">Back to log in</Link>
    </div>
  );
}
