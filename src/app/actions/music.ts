'use server';
import { parseMusicUrl, type SongHit } from '@/lib/music';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

const YT = () => (process.env.YOUTUBE_API_BASE || 'https://www.googleapis.com/youtube/v3').replace(/\/$/, '');
const ITUNES = () => (process.env.ITUNES_API_BASE || 'https://itunes.apple.com').replace(/\/$/, '');
const MAX_SECONDS = 600;

/** Looks up a pasted Spotify song's title and artwork from Spotify's public oEmbed endpoint (no API key). */
export async function lookupMusic(url: string): Promise<{ title?: string; artist?: string; art?: string } | null> {
  const m = parseMusicUrl(url);
  if (!m || m.provider !== 'spotify') return null;
  try {
    const res = await fetch(`https://open.spotify.com/oembed?url=${encodeURIComponent(m.url)}`, { signal: AbortSignal.timeout(3500), next: { revalidate: 86400 } });
    if (!res.ok) return null;
    const j = (await res.json()) as { title?: string; thumbnail_url?: string };
    const art = j.thumbnail_url && /^https:\/\/[^\s"'()<>\\]+$/.test(j.thumbnail_url) ? j.thumbnail_url.slice(0, 500) : undefined;
    return { title: j.title?.slice(0, 100), art };
  } catch { return null; }
}

const seconds = (iso: string) => {
  const m = iso.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  return m ? (+(m[1] || 0)) * 3600 + (+(m[2] || 0)) * 60 + (+(m[3] || 0)) : Infinity;
};
// Official music on YouTube: auto-generated "Artist - Topic" channels (label/distributor uploads) and VEVO.
const officialChannel = (t: string) => / - Topic$/.test(t) || /VEVO$/i.test(t);

type YtVideo = { id: string; snippet: { title: string; channelTitle: string; categoryId: string; thumbnails?: Record<string, { url: string }> };
  contentDetails: { duration: string }; status: { embeddable: boolean; privacyStatus: string } };

/** Checks YouTube videos are official, embeddable music of a sane length. Returns only those that pass. */
async function officialSongs(ids: string[]): Promise<SongHit[]> {
  if (!ids.length) return [];
  const url = `${YT()}/videos?part=snippet,contentDetails,status&id=${ids.map(encodeURIComponent).join(',')}&key=${process.env.YOUTUBE_API_KEY}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(6000), next: { revalidate: 3600 } });
  if (!res.ok) throw new Error('youtube');
  const items = ((await res.json()) as { items?: YtVideo[] }).items || [];
  return items
    .filter((v) => v.snippet.categoryId === '10' && officialChannel(v.snippet.channelTitle) && v.status.embeddable
      && v.status.privacyStatus === 'public' && seconds(v.contentDetails.duration) <= MAX_SECONDS)
    .map((v) => ({
      provider: 'youtube' as const, id: v.id, url: `https://www.youtube.com/watch?v=${v.id}`,
      title: v.snippet.title.slice(0, 100), artist: v.snippet.channelTitle.replace(/ - Topic$/, '').replace(/VEVO$/i, '').trim().slice(0, 100),
      art: `https://i.ytimg.com/vi/${v.id}/hqdefault.jpg`, seconds: seconds(v.contentDetails.duration),
    }));
}

/** Song search for the profile-song picker. Music only: official YouTube music when set up, otherwise Apple's catalog. */
export async function searchSongs(q: string): Promise<{ hits: SongHit[]; source: 'youtube' | 'apple'; error?: string }> {
  const term = q.trim().slice(0, 80);
  const source = process.env.YOUTUBE_API_KEY ? 'youtube' : 'apple';
  if (term.length < 2) return { hits: [], source };
  const { data: { user } } = await (await createClient()).auth.getUser();
  if (!user) return { hits: [], source, error: 'Sign in to search.' };
  try {
    if (source === 'youtube') {
      const s = await fetch(`${YT()}/search?part=snippet&type=video&videoCategoryId=10&videoEmbeddable=true&maxResults=15&q=${encodeURIComponent(term)}&key=${process.env.YOUTUBE_API_KEY}`,
        { signal: AbortSignal.timeout(6000), next: { revalidate: 86400 } });
      if (!s.ok) throw new Error('youtube');
      const ids = (((await s.json()) as { items?: { id: { videoId?: string } }[] }).items || []).map((i) => i.id.videoId).filter((x): x is string => !!x);
      return { hits: (await officialSongs(ids)).slice(0, 8), source };
    }
    const r = await fetch(`${ITUNES()}/search?media=music&entity=song&limit=10&term=${encodeURIComponent(term)}`, { signal: AbortSignal.timeout(6000), next: { revalidate: 86400 } });
    if (!r.ok) throw new Error('itunes');
    const results = ((await r.json()) as { results?: { trackId: number; trackName: string; artistName: string; artworkUrl100?: string; trackViewUrl?: string; trackTimeMillis?: number }[] }).results || [];
    const hits: SongHit[] = [];
    for (const t of results) {
      const p = t.trackViewUrl && parseMusicUrl(t.trackViewUrl.replace(/&.*$/, ''));
      if (!p) continue;
      hits.push({ provider: 'apple', id: String(t.trackId), url: p.url, title: t.trackName.slice(0, 100), artist: t.artistName.slice(0, 100),
        art: t.artworkUrl100?.startsWith('https://') ? t.artworkUrl100.replace('100x100', '300x300') : undefined,
        seconds: t.trackTimeMillis ? Math.round(t.trackTimeMillis / 1000) : undefined });
    }
    return { hits: hits.slice(0, 8), source };
  } catch {
    return { hits: [], source, error: 'Song search isn’t responding right now. Try again in a minute.' };
  }
}

/** Saves an official YouTube song as your profile song (checked again on the server; the database only accepts it from here). */
export async function saveYouTubeSong(videoId: string, autoplay: boolean): Promise<{ ok?: true; music?: Record<string, unknown>; error?: string }> {
  if (!/^[A-Za-z0-9_-]{11}$/.test(videoId)) return { error: 'That song can’t be used.' };
  if (!process.env.YOUTUBE_API_KEY) return { error: 'YouTube songs aren’t set up yet.' };
  const { data: { user } } = await (await createClient()).auth.getUser();
  if (!user) return { error: 'Sign in first.' };
  let hit: SongHit | undefined;
  try { hit = (await officialSongs([videoId]))[0]; } catch { return { error: 'Couldn’t check that song right now. Try again in a minute.' }; }
  if (!hit) return { error: 'Only official music (10 minutes or shorter) can be a profile song.' };
  const music = { provider: 'youtube', url: hit.url, title: hit.title, artist: hit.artist, art: hit.art, autoplay };
  const { error } = await createAdminClient().rpc('set_profile_song', { p_user: user.id, p_music: music });
  if (error) return { error: error.message.includes('SUSPENDED') ? 'Your account is suspended.' : 'Couldn’t save the song.' };
  return { ok: true, music };
}
