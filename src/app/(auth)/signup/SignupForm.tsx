'use client';
import { useActionState, useEffect, useState } from 'react';
import Link from 'next/link';
import { signUp } from '@/app/actions/auth';
import { FormMessage, Submit } from '@/components/FormBits';
import { Captcha } from '@/components/Captcha';
import { createClient } from '@/lib/supabase/client';

const RE = /^[a-z0-9._]{3,20}$/;

export function useUsernameCheck(value: string) {
  const [status, setStatus] = useState<'idle' | 'checking' | 'ok' | 'taken' | 'invalid'>('idle');
  useEffect(() => {
    const u = value.trim().toLowerCase();
    if (!u) { setStatus('idle'); return; }
    if (!RE.test(u) || /^[._]|[._]$|\.\./.test(u)) { setStatus('invalid'); return; }
    setStatus('checking');
    let live = true;
    const t = setTimeout(async () => {
      const { data, error } = await createClient().rpc('username_available', { p_username: u });
      if (live) setStatus(error ? 'idle' : data ? 'ok' : 'taken');
    }, 350);
    return () => { live = false; clearTimeout(t); };
  }, [value]);
  return status;
}

export function SignupForm({ initialUsername = '' }: { initialUsername?: string }) {
  const [state, action] = useActionState(signUp, undefined);
  const [username, setUsername] = useState(state?.fields?.username ?? initialUsername);
  const status = useUsernameCheck(username);
  const max = new Date(); max.setFullYear(max.getFullYear() - 18);
  const msg = {
    idle: ['3–20 letters, numbers, dots or underscores.', 'text-dim'],
    checking: ['Checking…', 'text-dim'],
    ok: [`@${username.toLowerCase()} is available.`, 'text-lime'],
    taken: [`@${username.toLowerCase()} is taken.`, 'text-[#FF8A8A]'],
    invalid: ['Use 3–20 letters, numbers, dots or underscores (not at the start or end).', 'text-amber'],
  }[status];
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <div className="flex flex-col gap-2">
        <label htmlFor="su-username" className="label">Username</label>
        <div className="flex items-center border-2 border-line bg-ink focus-within:border-cyan">
          <span className="pl-3 font-pixel text-xl text-violet">@</span>
          <input id="su-username" name="username" className="min-h-11 w-full bg-transparent px-1 py-2 outline-none" autoComplete="username"
            value={username} onChange={(e) => setUsername(e.target.value.replace(/\s/g, '').toLowerCase())} maxLength={20} required aria-describedby="su-u-help" />
        </div>
        <p id="su-u-help" role="status" className={`text-sm ${msg[1]}`}>{msg[0]}</p>
      </div>
      <label className="flex flex-col gap-2"><span className="label">Display name</span>
        <input className="field" name="display_name" maxLength={40} defaultValue={state?.fields?.display_name} placeholder="what friends call you" /></label>
      <label className="flex flex-col gap-2"><span className="label">Email</span>
        <input className="field" type="email" name="email" autoComplete="email" required defaultValue={state?.fields?.email} /></label>
      <label className="flex flex-col gap-2"><span className="label">Password</span>
        <input className="field" type="password" name="password" autoComplete="new-password" minLength={8} required />
        <span className="text-xs text-dim">At least 8 characters.</span></label>
      <label className="flex flex-col gap-2"><span className="label">Birthday</span>
        <input className="field" type="date" name="birthdate" required max={max.toISOString().slice(0, 10)} min="1900-01-01" defaultValue={state?.fields?.birthdate} />
        <span className="text-xs text-dim">SignedOn is for adults 18+. We never show your birthday.</span></label>
      <label className="flex min-h-11 items-start gap-3 text-sm">
        <input type="checkbox" name="agree" className="mt-0.5 h-5 w-5 accent-pink" required />
        <span>I&apos;m 18+ and I agree to the <Link href="/terms" className="link">terms</Link>, <Link href="/rules" className="link">community rules</Link> and <Link href="/privacy" className="link">privacy policy</Link>.</span>
      </label>
      <Captcha resetKey={state} />
      <FormMessage error={state?.error} />
      <Submit pendingText="Creating your page…">Create my page</Submit>
    </form>
  );
}
