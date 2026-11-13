'use client';
import { useEffect, useState } from 'react';

type Listening = { playing: boolean; title: string; artist: string; album?: string; art?: string; url?: string; at?: number };

function ago(ms: number) {
  const m = Math.round((Date.now() - ms) / 60000);
  if (m < 1) return 'just now'; if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60); if (h < 24) return `${h} hr ago`;
  return `${Math.round(h / 24)} d ago`;
}

/** Live "Now listening" from Last.fm, updated every 30 seconds while the page is open. */
export function NowListening({ profileId }: { profileId: string }) {
  const [t, setT] = useState<Listening | null>(null);
  useEffect(() => {
    let stop = false;
    const load = async () => {
      if (document.hidden) return;
      try {
        const r = await fetch(`/api/now-listening?u=${profileId}`, { cache: 'no-store' });
        if (!stop) setT(r.ok ? ((await r.json()) as Listening | null) : null);
      } catch { /* offline: keep what we had */ }
    };
    load();
    const iv = setInterval(load, 30000);
    const vis = () => { if (!document.hidden) load(); };
    document.addEventListener('visibilitychange', vis);
    return () => { stop = true; clearInterval(iv); document.removeEventListener('visibilitychange', vis); };
  }, [profileId]);
  if (!t) return null;
  const body = (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {t.art ? <img src={t.art} alt="" className="h-12 w-12 shrink-0 border-2 border-fg object-cover" /> : <span aria-hidden="true" className="flex h-12 w-12 shrink-0 items-center justify-center border-2 border-fg text-xl">♪</span>}
      <span className="min-w-0 flex-1">
        <span className="pixel block text-[17px] leading-none text-dim">{t.playing ? <><span className="animate-blink text-lime">●</span> NOW LISTENING</> : `LAST PLAYED · ${t.at ? ago(t.at).toUpperCase() : ''}`}</span>
        <span className="block truncate font-bold">{t.title}</span>
        <span className="block truncate text-sm text-muted">{t.artist}</span>
      </span>
    </>
  );
  return (
    <div className="so-listening border-2 border-fg bg-ink p-3 text-fg" aria-live="polite">
      {t.url ? <a href={t.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 hover:opacity-90">{body}</a> : <div className="flex items-center gap-3">{body}</div>}
    </div>
  );
}
