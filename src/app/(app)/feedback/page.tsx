import { redirect } from 'next/navigation';
import { getMe } from '@/lib/me';
import { FeedbackForm } from './FeedbackForm';

export const metadata = { title: 'Ideas & questions' };

export default async function Feedback({ searchParams }: { searchParams: Promise<{ from?: string }> }) {
  const { me, supabase } = await getMe();
  if (!me) redirect('/login');
  const { data: { user } } = await supabase.auth.getUser();
  const { from = '' } = await searchParams;
  return (
    <div className="mx-auto flex max-w-[760px] flex-col gap-6 px-4 py-10 sm:px-6">
      <header className="flex flex-col gap-2">
        <h1 className="font-display text-[clamp(2.2rem,6vw,3.2rem)] font-extrabold leading-none">Ideas &amp; questions</h1>
        <p className="leading-relaxed text-muted">SignedOn is being built by one person, and your ideas shape what comes next. Big or small, wild or practical: send it.
          To report someone or something harmful, use <b>Report</b> on it instead so a moderator sees it fast.</p>
      </header>
      <section className="panel p-5"><FeedbackForm email={user?.email || ''} from={from.startsWith('/') && !from.startsWith('//') ? from.slice(0, 300) : ''} /></section>
    </div>
  );
}
