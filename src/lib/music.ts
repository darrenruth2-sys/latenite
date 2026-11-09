export type Music = { provider: 'spotify' | 'youtube' | 'apple' | 'soundcloud'; url: string; embed: string; title?: string; artist?: string; art?: string };

/** Turns a share link from a supported service into an embeddable player URL. Returns null for anything else. */
export function parseMusicUrl(raw: string): Omit<Music, 'title' | 'artist' | 'art'> | null {
  let u: URL;
  try { u = new URL(raw.trim()); } catch { return null; }
  if (u.protocol !== 'https:') return null;
  const host = u.hostname.replace(/^www\./, '');
  if (host === 'open.spotify.com') {
    const m = u.pathname.match(/^\/(?:intl-[a-z-]+\/)?(track|album|playlist|episode)\/([A-Za-z0-9]{10,40})/);
    if (!m) return null;
    return { provider: 'spotify', url: `https://open.spotify.com/${m[1]}/${m[2]}`, embed: `https://open.spotify.com/embed/${m[1]}/${m[2]}` };
  }
  if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'music.youtube.com' || host === 'youtu.be') {
    const id = host === 'youtu.be' ? u.pathname.slice(1) : u.pathname.startsWith('/shorts/') ? u.pathname.split('/')[2] : u.searchParams.get('v');
    if (!id || !/^[A-Za-z0-9_-]{11}$/.test(id)) return null;
    return { provider: 'youtube', url: `https://www.youtube.com/watch?v=${id}`, embed: `https://www.youtube-nocookie.com/embed/${id}?rel=0` };
  }
  if (host === 'music.apple.com') {
    if (!/^\/[a-z]{2}\/(album|song|playlist)\//.test(u.pathname)) return null;
    const embed = new URL('https://embed.music.apple.com' + u.pathname);
    const i = u.searchParams.get('i'); if (i && /^\d+$/.test(i)) embed.searchParams.set('i', i);
    return { provider: 'apple', url: u.toString(), embed: embed.toString() };
  }
  if (host === 'soundcloud.com' || host === 'm.soundcloud.com') {
    if (!/^\/[\w-]+\/[\w-]+/.test(u.pathname)) return null;
    const clean = 'https://soundcloud.com' + u.pathname;
    return { provider: 'soundcloud', url: clean, embed: `https://w.soundcloud.com/player/?url=${encodeURIComponent(clean)}&auto_play=false&visual=false&show_comments=false` };
  }
  return null;
}

export const PROVIDER_NAME: Record<Music['provider'], string> = { spotify: 'Spotify', youtube: 'YouTube', apple: 'Apple Music', soundcloud: 'SoundCloud' };
