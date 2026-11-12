'use client';
import { useActionState } from 'react';
import { resendConfirmation } from '@/app/actions/auth';
import { FormMessage, Submit } from '@/components/FormBits';
import { Captcha } from '@/components/Captcha';

export function ResendForm({ email }: { email: string }) {
  const [state, action] = useActionState(resendConfirmation, undefined);
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="email" value={email} />
      <Captcha resetKey={state} />
      <FormMessage ok={state?.ok} />
      <Submit className="btn-ghost" pendingText="Sending…">Didn&apos;t get it? Send again</Submit>
    </form>
  );
}
