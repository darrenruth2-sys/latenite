'use client';
import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';

/** Chunky retro progress bar across the top while a new page loads. Decorative only. */
export function NavProgress() {
  const path = usePathname();
  const [w, setW] = useState(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const clear = () => { timers.current.forEach(clearTimeout); timers.current = []; };
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
      if (!a || a.target === '_blank' || a.hasAttribute('download')) return;
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin || url.pathname === location.pathname) return;
      clear(); setW(15);
      timers.current = [setTimeout(() => setW(45), 250), setTimeout(() => setW(70), 900), setTimeout(() => setW(85), 2500), setTimeout(() => setW(0), 10000)];
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, []);
  useEffect(() => {
    if (!w) return;
    clear(); setW(100);
    timers.current = [setTimeout(() => setW(0), 350)];
  }, [path]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!w) return null;
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-x-0 top-0 z-[90] h-[5px] bg-transparent">
      <div className="h-full transition-[width] duration-300 ease-out"
        style={{ width: `${w}%`, backgroundImage: 'repeating-linear-gradient(90deg, #FF2D95 0 14px, transparent 14px 17px)', boxShadow: '0 0 8px #FF2D95' }} />
    </div>
  );
}
