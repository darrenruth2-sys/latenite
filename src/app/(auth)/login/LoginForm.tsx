'use client';
import { useActionState } from 'react';
import { logIn } from '@/app/actions/auth';
import { FormMessage, Submit } from '@/components/FormBits';
import { Captcha } from '@/components/Captcha';

export function LoginForm({ next }: { next: string }) {
  const [state, action] = useActionState(logIn, undefined);
  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="next" value={next} />
      <label className="flex flex-col gap-2"><span className="label">Email</span>
        <input className="field" type="email" name="email" autoComplete="email" required defaultValue={state?.fields?.email} /></label>
      <label className="flex flex-col gap-2"><span className="label">Password</span>
        <input className="field" type="password" name="password" autoComplete="current-password" required /></label>
      <Captcha resetKey={state} />
      <FormMessage error={state?.error} />
      <Submit pendingText="Logging in…">Log in</Submit>
    </form>
  );
}
