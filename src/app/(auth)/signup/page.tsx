import Link from 'next/link';
import { cookies } from 'next/headers';
import { SignupForm } from './SignupForm';
import { signupRegionBlock } from '@/app/actions/auth';
import { createClient } from '@/lib/supabase/server';

export const metadata = { title: 'Get your page' };

export default async function Signup({ searchParams }: { searchParams: Promise<{ u?: string }> }) {
  const { u } = await searchParams;
  const jar = await cookies();
  const tooYoung = !!jar.get('so_age_gate');
  const { data: inviteOnly } = await (await createClient()).rpc('invite_only');
  const region = await signupRegionBlock();
  if (tooYoung || region) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="font-display text-4xl font-extrabold tracking-tight">{tooYoung ? 'SignedOn is for adults' : 'Not available in your state yet'}</h1>
        <p className="leading-relaxed text-muted">{tooYoung
          ? 'You need to be 18 or older to join SignedOn. Thanks for understanding.'
          : `SignedOn can’t accept new accounts from ${region} yet. State law there requires ID-based age checks for every user, and we’re working on it.`}</p>
        <p className="text-sm text-muted">Already have an account? <Link href="/login" className="link">Log in</Link></p>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-5">
      <div>
        <p className="pixel text-xl text-lime">&gt; CLAIM YOUR CORNER OF THE INTERNET</p>
        <h1 className="font-display text-4xl font-extrabold tracking-tight">Get your page</h1>
      </div>
      <SignupForm initialUsername={(u || '').toLowerCase().slice(0, 20)} invite={{ required: !!inviteOnly, code: jar.get('so_invite')?.value || '' }} />
      <p className="text-sm text-muted">Already have one? <Link href="/login" className="link">Log in</Link></p>
    </div>
  );
}
