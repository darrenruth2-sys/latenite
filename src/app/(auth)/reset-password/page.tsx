'use client';
import { useActionState } from 'react';
import { updatePassword } from '@/app/actions/auth';
import { FormMessage, Submit } from '@/components/FormBits';

export default function ResetPassword() {
  const [state, action] = useActionState(updatePassword, undefined);
  return (
    <div className="flex flex-col gap-5">
      <h1 className="font-display text-4xl font-extrabold tracking-tight">Pick a new password</h1>
      <form action={action} className="flex flex-col gap-4">
        <label className="flex flex-col gap-2"><span className="label">New password</span>
          <input className="field" type="password" name="password" autoComplete="new-password" minLength={8} required /></label>
        <label className="flex flex-col gap-2"><span className="label">Type it again</span>
          <input className="field" type="password" name="confirm" autoComplete="new-password" minLength={8} required /></label>
        <FormMessage error={state?.error} />
        <Submit pendingText="Saving…">Save password</Submit>
      </form>
    </div>
  );
}
