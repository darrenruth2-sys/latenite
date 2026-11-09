'use client';
import { useState } from 'react';
import { parseMusicUrl, PROVIDER_NAME, type Music } from '@/lib/music';

/**
 * Click-to-play music player. Nothing from the music service loads (and nothing plays)
 * until the visitor presses play.
 */
export function MusicEmbed({ music, compact = false, accent = '#FF4FA3', label }: { music: { provider: string; url: string; title?: string; artist?: string; art?: string }; compact?: boolean; accent?: string; label?: string }) {
  const [on, setOn] = useState(false);
  const parsed = parseMusicUrl(music.url);
  if (!parsed) return null;
  const name = PROVIDER_NAME[parsed.provider as Music['provider']];
  const height = parsed.provider === 'spotify' ? 152 : parsed.provider === 'soundcloud' ? 166 : parsed.provider === 'apple' ? 175 : compact ? 200 : 220;
  const src = parsed.provider === 'youtube' ? parsed.embed + '&autoplay=1' : parsed.provider === 'soundcloud' ? parsed.embed.replace('auto_play=false', 'auto_play=true') : parsed.embed;
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
        <iframe title={`${music.title || 'Song'} on ${name}`} src={src} width="100%" height={height} loading="lazy"
          allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
          sandbox="allow-scripts allow-same-origin allow-popups allow-presentation" className="border-0" />
      )}
      <p className="text-xs text-dim">{on ? <>Playing from {name}. <a className="link" href={parsed.url} target="_blank" rel="noopener noreferrer">Open on {name}</a></> : 'Press play to load the player. Never autoplays.'}</p>
    </div>
  );
}
