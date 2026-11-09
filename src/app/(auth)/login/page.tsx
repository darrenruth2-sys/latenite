import Link from 'next/link';
import { LoginForm } from './LoginForm';

export const metadata = { title: 'Log in' };

export default async function Login({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const sp = await searchParams;
  return (
    <div className="flex flex-col gap-5">
      <div>
        <p className="pixel text-xl text-lime">&gt; WELCOME BACK</p>
        <h1 className="font-display text-4xl font-extrabold tracking-tight">Log in</h1>
      </div>
      {sp.error === 'link' && <p role="alert" className="border-2 border-amber px-3 py-2 text-sm text-amber">That link expired or was already used. Log in, or request a new one.</p>}
      <LoginForm next={sp.next || '/feed'} />
      <div className="flex flex-wrap justify-between gap-2 text-sm">
        <Link href="/forgot" className="link">Forgot your password?</Link>
        <span className="text-muted">New here? <Link href="/signup" className="link">Get your page</Link></span>
      </div>
    </div>
  );
}
