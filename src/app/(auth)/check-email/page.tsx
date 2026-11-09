import { ResendForm } from './ResendForm';
export const metadata = { title: 'Check your email' };

export default async function CheckEmail({ searchParams }: { searchParams: Promise<{ email?: string }> }) {
  const { email = '' } = await searchParams;
  return (
    <div className="flex flex-col gap-5">
      <p className="pixel text-xl text-lime">&gt; ALMOST THERE</p>
      <h1 className="font-display text-4xl font-extrabold tracking-tight">Check your email</h1>
      <p className="text-muted">We sent a confirmation link to <b className="text-fg">{email || 'your inbox'}</b>. Click it and your page goes live.</p>
      <ResendForm email={email} />
    </div>
  );
}
