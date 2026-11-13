'use client';
import { useEffect, useRef, useState } from 'react';
import { parseMusicUrl, PROVIDER_NAME, type Music } from '@/lib/music';

const OPT_OUT = 'so-no-autoplay';
const canAutoplay = (p: string) => p === 'youtube'; // Spotify and Apple Music don't allow it in embeds
// Clicking a control (Block, Report, a link, a form field…) should never be what starts the music.
const CONTROL = 'a, button, input, textarea, select, label, summary, [role=button], [role=menuitem], [role=dialog], [contenteditable=true]';

function readOptOut() { try { return localStorage.getItem(OPT_OUT) === '1'; } catch { return false; } }

/**
 * Profile song player.
 * - autoplay (profile pages, when the owner wants it): the player loads and starts right away, old-MySpace style.
 *   Browsers sometimes hold sound until you've interacted with the page; if so it starts on your first click on the
 *   page itself (never a click on a button, link or form) or key press.
 *   Anyone can switch profile autoplay off for themselves.
 * - otherwise: click to play, and nothing from the music service loads until you do.
 */
export function MusicEmbed({ music, compact = false, accent = '#FF4FA3', label, autoplay = false }:
  { music: { provider: string; url: string; title?: string; artist?: string; art?: string }; compact?: boolean; accent?: string; label?: string; autoplay?: boolean }) {
  const [on, setOn] = useState(false);
  const [optOut, setOptOut] = useState(false);
  const frame = useRef<HTMLIFrameElement>(null);
  const parsed = parseMusicUrl(music.url);
  const auto = autoplay && !!parsed && canAutoplay(parsed.provider);

  useEffect(() => {
    const o = readOptOut(); setOptOut(o);
    if (auto && !o) setOn(true);
  }, [auto]);

  // If the browser blocked sound on load, start on the visitor's first interaction with the page.
  useEffect(() => {
    if (!on || !auto || optOut || !parsed) return;
    const kick = () => {
      const w = frame.current?.contentWindow; if (!w) return;
      if (parsed.provider === 'youtube') w.postMessage(JSON.stringify({ event: 'command', func: 'playVideo', args: [] }), 'https://www.youtube-nocookie.com');
    };
    const once = (e: Event) => {
      const t = e.target as Element | null;
      if (e.type === 'keydown' && t && t.closest?.('input, textarea, select, [contenteditable=true]')) return;
      if (e.type === 'pointerdown' && t && t.closest?.(CONTROL)) return;
      kick(); off();
    };
    const off = () => { document.removeEventListener('pointerdown', once, true); document.removeEventListener('keydown', once, true); };
    document.addEventListener('pointerdown', once, true); document.addEventListener('keydown', once, true);
    return off;
  }, [on, auto, optOut, parsed]);

  if (!parsed) return null;
  const name = PROVIDER_NAME[parsed.provider as Music['provider']];
  const height = parsed.provider === 'spotify' ? 152 : parsed.provider === 'apple' ? 175 : compact ? 200 : 220;
  const src = parsed.provider === 'youtube' ? parsed.embed + '&autoplay=1&enablejsapi=1&playsinline=1' : parsed.embed;

  function setPref(v: boolean) {
    try { if (v) localStorage.setItem(OPT_OUT, '1'); else localStorage.removeItem(OPT_OUT); } catch { /* private mode */ }
    setOptOut(v);
    if (v) setOn(false); else if (auto) setOn(true);
  }

  return (
    <div className="flex flex-col gap-2 border-2 border-fg bg-ink p-3 text-fg">
      {label && <p className="pixel text-[19px] text-dim">{label}</p>}
      {!on ? (
        <div className="flex items-center gap-3">
          {music.art
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={music.art} alt="" className="h-16 w-16 shrink-0 border-2 border-fg object-cover" />
            : <div aria-hidden="true" className="h-16 w-16 shrink-0 border-2 border-fg" style={{ background: `conic-gradient(${accent}, #9B7BFF, #38E1FF, ${accent})` }} />}
          <div className="min-w-0 flex-1">
            <p className="truncate font-display text-lg font-extrabold">{music.title || 'Profile song'}</p>
            <p className="truncate text-sm text-muted">{music.artist ? `${music.artist} · ` : ''}{name}</p>
          </div>
          <button type="button" onClick={() => setOn(true)} aria-label={`Play ${music.title || 'song'} from ${name}`}
            className="flex h-13 w-13 shrink-0 items-center justify-center border-2 border-fg text-ink" style={{ background: accent }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 4l13 8-13 8z" /></svg>
          </button>
        </div>
      ) : (
        <iframe ref={frame} title={`${music.title || 'Song'} on ${name}`} src={src} width="100%" height={height}
          allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
          sandbox="allow-scripts allow-same-origin allow-popups allow-presentation" className="border-0" />
      )}
      <p className="text-xs text-dim">
        {on ? <>Playing from {name}. <a className="link" href={parsed.url} target="_blank" rel="noopener noreferrer">Open on {name}</a></> : auto && optOut ? 'Autoplay is off for you.' : 'Press play to load the player.'}
        {autoplay && canAutoplay(parsed.provider) && <> · <button type="button" className="link" onClick={() => setPref(!optOut)}>{optOut ? 'Turn profile autoplay back on' : 'Stop autoplay on profiles'}</button></>}
      </p>
    </div>
  );
}
