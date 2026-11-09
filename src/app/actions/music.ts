'use server';
import { parseMusicUrl } from '@/lib/music';

const OEMBED: Record<string, (u: string) => string> = {
  spotify: (u) => `https://open.spotify.com/oembed?url=${encodeURIComponent(u)}`,
  youtube: (u) => `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(u)}`,
  soundcloud: (u) => `https://soundcloud.com/oembed?format=json&url=${encodeURIComponent(u)}`,
};

/** Looks up the song title/artwork from the service's public oEmbed endpoint (no API keys). */
export async function lookupMusic(url: string): Promise<{ title?: string; artist?: string; art?: string } | null> {
  const m = parseMusicUrl(url);
  if (!m || !OEMBED[m.provider]) return null;
  try {
    const res = await fetch(OEMBED[m.provider](m.url), { signal: AbortSignal.timeout(3500), next: { revalidate: 86400 } });
    if (!res.ok) return null;
    const j = (await res.json()) as { title?: string; author_name?: string; thumbnail_url?: string };
    let title = j.title?.slice(0, 100); let artist = j.author_name?.slice(0, 100);
    if (m.provider === 'youtube' && title && / - /.test(title) && (!artist || / - Topic$/.test(artist) || /VEVO$/i.test(artist))) {
      const [a, t] = title.split(' - ', 2); artist = a.trim(); title = t.trim();
    }
    const art = j.thumbnail_url && /^https:\/\/[^\s"'()<>\\]+$/.test(j.thumbnail_url) ? j.thumbnail_url.slice(0, 500) : undefined;
    return { title, artist: artist?.replace(/ - Topic$/, ''), art };
  } catch { return null; }
}
