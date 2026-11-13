'use client';
import { useState } from 'react';
import { lookupMusic, saveYouTubeSong, searchSongs } from '@/app/actions/music';
import { parseMusicUrl, type Music, type SongHit } from '@/lib/music';

type Picked = { provider: Music['provider'] | string; url: string; title?: string; artist?: string; art?: string; autoplay?: boolean };
const mmss = (s?: number) => (s ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` : '');

/**
 * Music-only song picker: search real songs, or paste a Spotify song link. No other links.
 * YouTube results are official music only and are saved straight away by the server (that's the only way the
 * database accepts them).
 */
export function SongPicker({ current, onPick }: { current: Picked | null; onPick: (m: Picked | null, savedNow?: boolean) => void }) {
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<SongHit[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');
  const [spotify, setSpotify] = useState('');

  async function search(e?: React.FormEvent) {
    e?.preventDefault(); setErr(''); setOk('');
    if (q.trim().length < 2) return;
    setBusy(true);
    const r = await searchSongs(q).catch(() => ({ hits: [], source: 'apple' as const, error: 'Search failed. Try again.' }));
    setBusy(false); setHits(r.hits);
    if (r.error) setErr(r.error); else if (!r.hits.length) setErr('No songs found. Try the artist and song name.');
  }
  async function pick(h: SongHit) {
    setErr(''); setOk('');
    if (h.provider === 'youtube') {
      setBusy(true);
      const r = await saveYouTubeSong(h.id, current?.autoplay !== false).catch(() => ({ error: 'Couldn’t save the song.' } as { error: string; music?: undefined }));
      setBusy(false);
      if (!r.music) { setErr(r.error || 'Couldn’t save the song.'); return; }
      onPick(r.music as Picked, true); setOk(`“${h.title}” is your profile song now.`);
    } else {
      onPick({ provider: 'apple', url: h.url, title: h.title, artist: h.artist, art: h.art, autoplay: current?.autoplay }); setOk(`Picked “${h.title}”. Save your page to keep it.`);
    }
    setHits(null);
  }
  async function useSpotify() {
    setErr(''); setOk('');
    const p = parseMusicUrl(spotify);
    if (!p || p.provider !== 'spotify') { setErr('That isn’t a Spotify song link. In Spotify: Share → Copy song link.'); return; }
    setBusy(true);
    const info = await lookupMusic(p.url).catch(() => null);
    setBusy(false);
    onPick({ provider: 'spotify', url: p.url, title: info?.title || '', artist: '', ...(info?.art ? { art: info.art } : {}), autoplay: current?.autoplay });
    setSpotify(''); setOk('Spotify song picked. Save your page to keep it.');
  }

  return (
    <div className="flex flex-col gap-2">
      <form onSubmit={search} className="flex gap-1.5" role="search">
        <label htmlFor="ed-song" className="sr-only">Search for a song</label>
        <input id="ed-song" className="field min-h-10 flex-1 text-sm" placeholder="Search a song or artist…" value={q} onChange={(e) => setQ(e.target.value)} maxLength={80} />
        <button type="submit" className="btn-cyan btn-sm" disabled={busy}>{busy ? '…' : 'Search'}</button>
      </form>
      {hits && hits.length > 0 && (
        <ul aria-label="Songs" className="flex max-h-72 flex-col gap-1 overflow-y-auto border-2 border-line p-1">
          {hits.map((h) => (
            <li key={h.provider + h.id}>
              <button type="button" onClick={() => pick(h)} disabled={busy} className="flex min-h-12 w-full items-center gap-2.5 p-1.5 text-left hover:bg-fg/10">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {h.art ? <img src={h.art} alt="" className="h-10 w-10 shrink-0 border border-fg object-cover" /> : <span className="h-10 w-10 shrink-0 border border-fg" />}
                <span className="min-w-0 flex-1"><span className="block truncate text-sm font-bold">{h.title}</span>
                  <span className="block truncate text-xs text-dim">{h.artist}{h.seconds ? ` · ${mmss(h.seconds)}` : ''}</span></span>
                <span className="text-xs font-bold text-cyan">Use</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <details className="text-sm">
        <summary className="cursor-pointer text-dim">Or paste a Spotify song link</summary>
        <div className="mt-1.5 flex gap-1.5">
          <label htmlFor="ed-spotify" className="sr-only">Spotify song link</label>
          <input id="ed-spotify" className="field min-h-10 flex-1 text-sm" placeholder="https://open.spotify.com/track/…" value={spotify} onChange={(e) => setSpotify(e.target.value)} />
          <button type="button" className="btn-cyan btn-sm" onClick={useSpotify} disabled={busy}>Use</button>
        </div>
      </details>
      {ok && <p role="status" className="text-sm text-lime">{ok}</p>}
      {err && <p role="alert" className="text-sm text-[#FF8A8A]">{err}</p>}
      {current && <p className="text-xs text-dim">Only songs from music catalogs can be profile songs. <button type="button" className="link" onClick={() => { onPick(null); setOk(''); }}>Remove song</button></p>}
    </div>
  );
}
