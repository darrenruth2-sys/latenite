// Local test stand-ins for OpenAI moderation, YouTube Data API and Last.fm (the test machine has no internet).
import http from 'node:http';
const PORT = 4555;
const vid = (id, channel, cat, dur) => ({ id, snippet: { title: `Song ${id}`, channelTitle: channel, categoryId: cat, thumbnails: {} },
  contentDetails: { duration: dur }, status: { embeddable: true, privacyStatus: 'public' } });
const VIDEOS = {
  aaaaaaaaaaa: vid('aaaaaaaaaaa', 'Linkin Park - Topic', '10', 'PT3M5S'),     // official, OK
  bbbbbbbbbbb: vid('bbbbbbbbbbb', 'Prank Guy', '24', 'PT2M'),                // not music
  ccccccccccc: vid('ccccccccccc', 'Loud Noises - Topic', '10', 'PT24H'),     // way too long
};
const json = (res, o, code = 200) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(o)); };
http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://x');
  if (req.method === 'POST' && u.pathname === '/v1/moderations') {
    let body = ''; for await (const c of req) body += c;
    const s = JSON.stringify(JSON.parse(body).input);
    const cats = {};
    if (s.includes('SENTINEL_BAD')) cats.harassment = true;
    if (s.includes('SENTINEL_MINOR') || s.includes('minor.png')) { cats.sexual = true; cats['sexual/minors'] = true; }
    if (s.includes('SENTINEL_SELFHARM')) cats['self-harm'] = true;
    return json(res, { results: [{ flagged: Object.keys(cats).length > 0, categories: cats }] });
  }
  if (u.pathname === '/youtube/search') return json(res, { items: Object.keys(VIDEOS).map((videoId) => ({ id: { videoId } })) });
  if (u.pathname === '/youtube/videos') return json(res, { items: (u.searchParams.get('id') || '').split(',').map((i) => VIDEOS[i]).filter(Boolean) });
  if (u.pathname === '/lastfm/2.0/') {
    const user = u.searchParams.get('user');
    return json(res, { recenttracks: { track: [{ name: 'Numb', artist: { '#text': 'Linkin Park' }, album: { '#text': 'Meteora' }, url: 'https://www.last.fm/music/Linkin+Park/_/Numb',
      image: [], '@attr': user === 'idle_user' ? undefined : { nowplaying: 'true' }, date: user === 'idle_user' ? { uts: String(Math.floor(Date.now() / 1000) - 600) } : undefined }] } });
  }
  json(res, { error: 'not found' }, 404);
}).listen(PORT, '127.0.0.1');
