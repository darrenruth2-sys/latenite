import Link from 'next/link';
import type { ReactNode } from 'react';

export type LegalSection = { id: string; title: string; body: ReactNode };

/** Shared layout for Terms, Privacy and Copyright: plain-words summary up top, numbered sections, a table of contents. */
export function LegalDoc({ title, updated, intro, summary, sections, footer }:
  { title: string; updated: string; intro: ReactNode; summary?: string[]; sections: LegalSection[]; footer?: ReactNode }) {
  return (
    <div className="mx-auto flex max-w-[820px] flex-col gap-6 px-4 py-10 sm:px-6">
      <header className="flex flex-col gap-2">
        <h1 className="font-display text-[clamp(2.2rem,6vw,3.2rem)] font-extrabold leading-none">{title}</h1>
        <p className="text-sm text-dim">Last updated {updated}</p>
        <div className="leading-relaxed text-muted">{intro}</div>
      </header>
      {summary && (
        <section aria-labelledby="sum-h" className="border-2 border-lime p-5">
          <h2 id="sum-h" className="pixel text-xl text-lime">THE SHORT VERSION</h2>
          <ul className="mt-2 flex list-disc flex-col gap-1.5 pl-5 leading-relaxed text-muted">{summary.map((s) => <li key={s}>{s}</li>)}</ul>
          <p className="mt-3 text-sm text-dim">This summary is here to help. The full text below is what actually applies.</p>
        </section>
      )}
      <nav aria-label="Sections" className="panel p-5">
        <h2 className="pixel text-xl text-dim">CONTENTS</h2>
        <ol className="mt-2 grid list-decimal gap-x-6 gap-y-0 pl-5 text-sm sm:grid-cols-2">
          {sections.map((s) => <li key={s.id}><a className="link inline-block py-2.5 sm:py-1" href={`#${s.id}`}>{s.title}</a></li>)}
        </ol>
      </nav>
      {sections.map((s, i) => (
        <section key={s.id} id={s.id} aria-labelledby={`${s.id}-h`} className="panel scroll-mt-24 p-5">
          <h2 id={`${s.id}-h`} className="font-display text-xl font-extrabold">{i + 1}. {s.title}</h2>
          <div className="legal-body mt-2 flex flex-col gap-3 leading-relaxed text-muted">{s.body}</div>
        </section>
      ))}
      {footer}
      <p className="text-sm text-dim">See also: <Link className="link" href="/terms">Terms</Link> · <Link className="link" href="/privacy">Privacy</Link> · <Link className="link" href="/rules">Community rules</Link> · <Link className="link" href="/copyright">Copyright</Link> · <Link className="link" href="/report-content">Report content / takedown requests</Link></p>
    </div>
  );
}
