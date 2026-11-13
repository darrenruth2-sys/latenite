export type Music = { provider: 'spotify' | 'youtube' | 'apple'; url: string; embed: string; title?: string; artist?: string; art?: string };

/**
 * Turns a saved profile-song link into an embeddable player URL. Returns null for anything else.
 * Only released music: Spotify tracks, Apple Music songs, and YouTube videos the server already checked
 * are official music (the database refuses unchecked YouTube links).
 */
export function parseMusicUrl(raw: string): Omit<Music, 'title' | 'artist' | 'art'> | null {
  let u: URL;
  try { u = new URL(raw.trim()); } catch { return null; }
  if (u.protocol !== 'https:') return null;
  const host = u.hostname.replace(/^www\./, '');
  if (host === 'open.spotify.com') {
    const m = u.pathname.match(/^\/(?:intl-[a-z-]+\/)?track\/([A-Za-z0-9]{10,40})/);
    if (!m) return null;
    return { provider: 'spotify', url: `https://open.spotify.com/track/${m[1]}`, embed: `https://open.spotify.com/embed/track/${m[1]}` };
  }
  if (host === 'youtube.com') {
    const id = u.pathname === '/watch' ? u.searchParams.get('v') : null;
    if (!id || !/^[A-Za-z0-9_-]{11}$/.test(id)) return null;
    return { provider: 'youtube', url: `https://www.youtube.com/watch?v=${id}`, embed: `https://www.youtube-nocookie.com/embed/${id}?rel=0` };
  }
  if (host === 'music.apple.com') {
    const song = u.pathname.match(/^\/([a-z]{2})\/song\/([A-Za-z0-9._~%-]+)\/(\d+)$/);
    const album = u.pathname.match(/^\/([a-z]{2})\/album\/([A-Za-z0-9._~%-]+)\/(\d+)$/);
    const i = u.searchParams.get('i');
    let path: string;
    if (song) path = `/${song[1]}/song/${song[2]}/${song[3]}`;
    else if (album && i && /^\d+$/.test(i)) path = `/${album[1]}/album/${album[2]}/${album[3]}?i=${i}`;
    else return null;
    return { provider: 'apple', url: 'https://music.apple.com' + path, embed: 'https://embed.music.apple.com' + path };
  }
  return null;
}

export const PROVIDER_NAME: Record<Music['provider'], string> = { spotify: 'Spotify', youtube: 'YouTube', apple: 'Apple Music' };

/** One search result in the song picker. */
export type SongHit = { provider: 'youtube' | 'apple'; id: string; url: string; title: string; artist: string; art?: string; seconds?: number };
