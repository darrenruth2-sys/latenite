import 'server-only';

export const lastfmConfigured = () => !!process.env.LASTFM_API_KEY;
const BASE = () => (process.env.LASTFM_API_BASE || 'https://ws.audioscrobbler.com').replace(/\/$/, '');

export type Listening = { playing: boolean; title: string; artist: string; album?: string; art?: string; url?: string; at?: number };

/** The most recent track a Last.fm user played (or is playing right now). Null if none / not reachable. */
export async function recentTrack(user: string): Promise<Listening | null> {
  if (!lastfmConfigured() || !/^[A-Za-z][A-Za-z0-9_-]{1,14}$/.test(user)) return null;
  const url = `${BASE()}/2.0/?method=user.getrecenttracks&user=${encodeURIComponent(user)}&api_key=${process.env.LASTFM_API_KEY}&format=json&limit=1`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5000), next: { revalidate: 20 } });
    if (!res.ok) return null;
    const j = (await res.json()) as { recenttracks?: { track?: unknown } };
    const raw = j.recenttracks?.track;
    const t = (Array.isArray(raw) ? raw[0] : raw) as {
      name?: string; artist?: { '#text'?: string }; album?: { '#text'?: string }; url?: string;
      image?: { size: string; '#text': string }[]; '@attr'?: { nowplaying?: string }; date?: { uts?: string } } | undefined;
    if (!t?.name) return null;
    const img = t.image?.find((i) => i.size === 'large')?.['#text'] || t.image?.at(-1)?.['#text'];
    const art = img && /^https:\/\/[a-z0-9.-]+\.(fastly\.net|last\.fm|lst\.fm)\/[^\s"'()<>\\]+$/.test(img) && !img.includes('2a96cbd8b46e442fc41c2b86b821562f') ? img : undefined; // skip the grey star placeholder
    const link = t.url && /^https:\/\/www\.last\.fm\//.test(t.url) ? t.url : undefined;
    return { playing: t['@attr']?.nowplaying === 'true', title: t.name.slice(0, 120), artist: (t.artist?.['#text'] || '').slice(0, 120),
      album: t.album?.['#text']?.slice(0, 120) || undefined, art, url: link, at: t.date?.uts ? +t.date.uts * 1000 : undefined };
  } catch { return null; }
}
