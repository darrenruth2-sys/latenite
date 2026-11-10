'use client';
import { useEffect, useState } from 'react';

const pad = (n: number) => String(n).padStart(2, '0');

/** Flip-clock style countdown. Renders nothing time-dependent on the server to avoid hydration mismatches. */
export function Countdown({ target, label }: { target: string; label: string }) {
  const end = new Date(target).getTime();
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const left = now === null ? null : Math.max(0, end - now);
  const parts = left === null ? null : {
    DAYS: Math.floor(left / 86400000), HRS: Math.floor(left / 3600000) % 24, MIN: Math.floor(left / 60000) % 60, SEC: Math.floor(left / 1000) % 60,
  };
  return (
    <div className="flex flex-col gap-2">
      <p className="pixel text-xl text-dim">{left === 0 ? '> DOORS ARE OPENING…' : `> COUNTDOWN TO ${label}`}</p>
      <div className="flex flex-wrap gap-2" role="timer" aria-label={parts ? `${parts.DAYS} days, ${parts.HRS} hours, ${parts.MIN} minutes until launch` : `Launch: ${label}`}>
        {(['DAYS', 'HRS', 'MIN', 'SEC'] as const).map((k) => (
          <div key={k} className="flex min-w-[76px] flex-col items-center border-2 border-line bg-black px-3 py-2" aria-hidden="true">
            <span className="pixel text-[44px] leading-none text-lime [text-shadow:0_0_10px_rgba(92,255,138,.6)]">
              {parts ? (k === 'DAYS' ? String(parts[k]) : pad(parts[k])) : '--'}
            </span>
            <span className="pixel text-base text-dim">{k}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
