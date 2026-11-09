'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useUsernameCheck } from './(auth)/signup/SignupForm';

export function ClaimForm() {
  const [u, setU] = useState('');
  const status = useUsernameCheck(u);
  const router = useRouter();
  const color = { idle: 'text-dim', checking: 'text-dim', ok: 'text-lime', taken: 'text-[#FF8A8A]', invalid: 'text-amber' }[status];
  const border = { idle: 'border-line', checking: 'border-line', ok: 'border-lime', taken: 'border-[#FF5A5A]', invalid: 'border-amber' }[status];
  const text = { idle: 'Letters, numbers, dots and underscores. 3–20 characters.', checking: 'Checking…', ok: `@${u} is available.`, taken: `@${u} is taken. Try another.`, invalid: 'Use 3–20 letters, numbers, dots or underscores.' }[status];
  return (
    <form className="flex max-w-[520px] flex-col gap-2.5" onSubmit={(e) => { e.preventDefault(); router.push(`/signup?u=${encodeURIComponent(u)}`); }}>
      <label htmlFor="claim" className="pixel text-xl text-dim">CLAIM YOUR NAME BEFORE SOMEONE ELSE DOES</label>
      <div className="flex flex-wrap gap-2.5">
        <div className={`flex min-h-13 flex-[1_1_220px] items-center border-2 bg-panel ${border}`}>
          <span className="pl-3 pr-1 pixel text-xl text-violet">latenite.social/@</span>
          <input id="claim" value={u} onChange={(e) => setU(e.target.value.replace(/\s/g, '').toLowerCase())} maxLength={20} autoComplete="off" placeholder="yourname"
            className="min-w-0 flex-1 bg-transparent py-3 pr-3 text-lg outline-none" />
        </div>
        <button className="btn-cyan min-h-13 px-6">Claim it</button>
      </div>
      <p role="status" className={`min-h-5 text-sm ${color}`}>{text}</p>
    </form>
  );
}
