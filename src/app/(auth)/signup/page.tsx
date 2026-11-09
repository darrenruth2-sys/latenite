import Link from 'next/link';
import { SignupForm } from './SignupForm';

export const metadata = { title: 'Get your page' };

export default async function Signup({ searchParams }: { searchParams: Promise<{ u?: string }> }) {
  const { u } = await searchParams;
  return (
    <div className="flex flex-col gap-5">
      <div>
        <p className="pixel text-xl text-lime">&gt; CLAIM YOUR CORNER OF THE INTERNET</p>
        <h1 className="font-display text-4xl font-extrabold tracking-tight">Get your page</h1>
      </div>
      <SignupForm initialUsername={(u || '').toLowerCase().slice(0, 20)} />
      <p className="text-sm text-muted">Already have one? <Link href="/login" className="link">Log in</Link></p>
    </div>
  );
}
