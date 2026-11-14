'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { findHelp, HELP, type HelpEntry } from '@/lib/help';

type Msg = { from: 'you' | 'bot'; text: string; entry?: HelpEntry; more?: HelpEntry[]; ask?: string };
const STARTERS = ['How do I change my profile song?', 'How do I block someone?', 'How do I set my Top 8?', 'Something’s broken'];

/** SignedOn Help: answers common questions from a fixed list and points to the right page. Anything it can't
 *  answer goes to Darren through Ideas & questions. */
export function HelpBot({ me }: { me: string }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [msgs, setMsgs] = useState<Msg[]>([{ from: 'bot', text: 'Hey! I’m the SignedOn help bot. Ask me how to do something, or tap a question below.' }]);
  const end = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => { end.current?.scrollIntoView({ block: 'end' }); }, [msgs, open]);
  useEffect(() => { if (open) input.current?.focus(); }, [open]);
  useEffect(() => {
    if (!open) return;
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', esc); return () => document.removeEventListener('keydown', esc);
  }, [open]);
  if (path?.startsWith('/messenger')) return null;

  const fill = (href: string) => href.replace('{me}', encodeURIComponent(me));
  function ask(text: string) {
    const t = text.trim(); if (!t) return;
    const hits = findHelp(t);
    const reply: Msg = hits.length
      ? { from: 'bot', text: hits[0].a, entry: hits[0], more: hits.slice(1) }
      : { from: 'bot', text: 'I don’t know that one yet. Want to ask Darren? He reads every message.', ask: t };
    setMsgs((m) => [...m, { from: 'you', text: t }, reply]); setQ('');
  }
  function pick(e: HelpEntry) { setMsgs((m) => [...m, { from: 'you', text: e.q }, { from: 'bot', text: e.a, entry: e }]); }

  return (
    <>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-controls="helpbot"
        className="fixed bottom-[88px] right-3 z-40 flex h-12 min-w-12 items-center justify-center gap-2 border-2 border-fg bg-cyan px-3 font-bold text-ink shadow-[3px_3px_0_var(--color-pink)] md:bottom-6 md:right-4 md:h-14 md:min-w-14 md:px-4">
        <span aria-hidden="true" className="text-xl leading-none">?</span><span className="hidden sm:inline">Help</span><span className="sr-only sm:hidden">Help</span>
      </button>
      {open && (
        <div id="helpbot" role="dialog" aria-label="SignedOn help" className="fixed bottom-40 right-4 z-50 flex max-h-[min(560px,calc(100dvh-200px))] w-[min(380px,calc(100vw-32px))] flex-col border-2 border-fg bg-panel text-fg shadow-[8px_8px_0_var(--color-cyan)] md:bottom-24">
          <div className="flex items-center justify-between bg-cyan px-3 py-2 text-sm font-bold text-ink">
            <span>SignedOn Help</span>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close help" className="min-h-8 min-w-8 text-lg leading-none">×</button>
          </div>
          <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-3 text-sm" aria-live="polite">
            {msgs.map((m, i) => (
              <div key={i} className={m.from === 'you' ? 'self-end max-w-[85%] border-2 border-pink bg-pink/15 px-3 py-2' : 'max-w-[92%] border-2 border-line bg-ink px-3 py-2'}>
                <p className="leading-relaxed">{m.text}</p>
                {m.entry?.links && <div className="mt-2 flex flex-wrap gap-1.5">{m.entry.links.map(([l, h]) => <Link key={h} href={fill(h)} onClick={() => setOpen(false)} className="btn-ghost btn-sm">{l} →</Link>)}</div>}
                {m.more && m.more.length > 0 && <div className="mt-2 flex flex-col gap-1"><span className="text-xs text-dim">Or did you mean:</span>
                  {m.more.map((e) => <button key={e.q} type="button" onClick={() => pick(e)} className="link min-h-8 text-left text-sm">{e.q}</button>)}</div>}
                {m.ask && <Link href={`/feedback?kind=question&q=${encodeURIComponent(m.ask)}&from=${encodeURIComponent(path || '')}`} onClick={() => setOpen(false)} className="btn-cyan btn-sm mt-2 inline-flex">Ask Darren →</Link>}
              </div>
            ))}
            {msgs.length === 1 && <div className="flex flex-wrap gap-1.5">{STARTERS.map((s) => <button key={s} type="button" onClick={() => ask(s)} className="min-h-9 border-2 border-line px-2.5 text-left text-xs hover:border-cyan">{s}</button>)}</div>}
            <div ref={end} />
          </div>
          <form onSubmit={(e) => { e.preventDefault(); ask(q); }} className="flex gap-2 border-t-2 border-line p-2">
            <label htmlFor="help-q" className="sr-only">Your question</label>
            <input id="help-q" ref={input} className="field min-h-10 flex-1 text-sm" placeholder="Ask a question…" value={q} onChange={(e) => setQ(e.target.value)} maxLength={200} autoComplete="off" />
            <button type="submit" className="btn-cyan btn-sm">Ask</button>
          </form>
          <p className="border-t border-line px-3 py-1.5 text-[11px] text-dim">{HELP.length} answers · <Link href="/feedback" className="link" onClick={() => setOpen(false)}>Ideas &amp; questions</Link></p>
        </div>
      )}
    </>
  );
}
