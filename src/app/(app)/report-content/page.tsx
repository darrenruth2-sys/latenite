import Link from 'next/link';
import { TakedownForm } from './TakedownForm';
import { CONTACT_EMAIL } from '@/lib/legal';

export const metadata = { title: 'Report content / takedown request' };

export default async function ReportContent({ searchParams }: { searchParams: Promise<{ type?: string }> }) {
  const { type = '' } = await searchParams;
  return (
    <div className="mx-auto flex max-w-[760px] flex-col gap-6 px-4 py-10 sm:px-6">
      <header className="flex flex-col gap-2">
        <h1 className="font-display text-[clamp(2.2rem,6vw,3.2rem)] font-extrabold leading-none">Report content</h1>
        <p className="leading-relaxed text-muted">You don’t need an account to use this form. If you’re on SignedOn, you can also tap <b>Report</b> on any post, page or message.</p>
        <ul className="list-disc pl-5 text-sm leading-relaxed text-muted">
          <li><b>Intimate images shared without consent</b> (real or AI-generated) are removed within 48 hours of a valid request.</li>
          <li><b>Child exploitation</b> is removed, preserved for law enforcement and reported to NCMEC.</li>
          <li><b>Copyright</b> notices follow our <Link className="link" href="/copyright">Copyright Policy</Link>.</li>
        </ul>
      </header>
      <section className="panel p-5"><TakedownForm initialKind={type} contactEmail={CONTACT_EMAIL} /></section>
    </div>
  );
}
