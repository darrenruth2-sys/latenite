'use client';
import { useEffect, useRef } from 'react';

/**
 * Cloudflare Turnstile bot check. Renders nothing until NEXT_PUBLIC_TURNSTILE_SITE_KEY is set, so it can ship switched off.
 * Turnstile puts its token in a hidden `cf-turnstile-response` input inside this element, so it travels with the
 * surrounding <form>; server actions forward it to Supabase Auth as `captchaToken`.
 * Pass the form's latest state as `resetKey`: tokens are single-use, so the widget resets after every submit.
 */
type Turnstile = {
  render: (el: HTMLElement, opts: Record<string, unknown>) => string;
  reset: (id: string) => void;
  remove: (id: string) => void;
};
declare global { interface Window { turnstile?: Turnstile; __lnTurnstile?: Promise<void> } }

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

function loadTurnstile() {
  if (window.turnstile) return Promise.resolve();
  window.__lnTurnstile ??= new Promise<void>((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => { window.__lnTurnstile = undefined; reject(new Error('turnstile')); };
    document.head.appendChild(s);
  });
  return window.__lnTurnstile;
}

export function Captcha({ resetKey }: { resetKey?: unknown }) {
  const box = useRef<HTMLDivElement>(null);
  const id = useRef<string | null>(null);

  useEffect(() => {
    if (!SITE_KEY) return;
    let gone = false;
    loadTurnstile().then(() => {
      if (gone || !box.current || !window.turnstile || id.current) return;
      id.current = window.turnstile.render(box.current, { sitekey: SITE_KEY, theme: 'dark', size: 'flexible' });
    }).catch(() => {});
    return () => {
      gone = true;
      if (id.current && window.turnstile) window.turnstile.remove(id.current);
      id.current = null;
    };
  }, []);

  useEffect(() => {
    if (resetKey !== undefined && id.current && window.turnstile) window.turnstile.reset(id.current);
  }, [resetKey]);

  if (!SITE_KEY) return null;
  return <div ref={box} className="min-h-[65px]" aria-label="Quick check that you’re a person" />;
}
