// v10.1: music-only songs (search, official-only YouTube, server-gated), Last.fm "Now listening", Sentinel,
// real takedown removal, ideas & questions inbox. External services are stood in by tests/stubs/server.mjs.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { launch, close, BASE, newPage, apiUserUI, assertClean } from './browser.mjs';
import { admin, makeUser, uname } from '../helpers.mjs';

before(launch);
after(close);
const sweep = async () => { const r = await fetch(BASE + '/api/sentinel', { method: 'POST' }); assert.equal(r.status, 200); return r.json(); };
// keep sweeping until the queue is empty (earlier tests leave a backlog)
const drain = async () => { for (let i = 0; i < 20; i++) { const r = await sweep(); if (!r.checked) return; } };
const tick = (ms = 400) => new Promise((r) => setTimeout(r, ms));

test('profile song: search shows official music only; YouTube songs can only be saved by the server', async () => {
  const A = await apiUserUI(uname('song'));
  const p = A.page;
  await p.goto(`${BASE}/u/${A.username}?edit=1`);
  await p.fill('#ed-song', 'numb'); await p.click('button:has-text("Search")');
  const list = p.getByRole('list', { name: 'Songs' });
  await list.getByText('Song aaaaaaaaaaa').waitFor();
  assert.equal(await list.getByRole('listitem').count(), 1, 'the prank video and the 24-hour video are filtered out');
  await list.getByRole('button').first().click();
  await p.getByText('is your profile song now').waitFor();
  const { data } = await admin.from('profile_details').select('music').eq('id', A.id).single();
  assert.equal(data.music.url, 'https://www.youtube.com/watch?v=aaaaaaaaaaa');
  // pasting any other YouTube video straight into the database is refused
  const bad = await A.c.from('profile_details').update({ music: { provider: 'youtube', url: 'https://www.youtube.com/watch?v=bbbbbbbbbbb' } }).eq('id', A.id);
  assert.match(bad.error?.message || '', /AH_SONG_NOT_VERIFIED/);
  const sc = await A.c.from('profile_details').update({ music: { provider: 'soundcloud', url: 'https://soundcloud.com/a/b' } }).eq('id', A.id);
  assert.ok(sc.error, 'SoundCloud is gone');
  // editing title / autoplay of the checked song is fine
  const ok = await A.c.from('profile_details').update({ music: { ...data.music, title: 'Numb (fave)', autoplay: false } }).eq('id', A.id);
  assert.equal(ok.error, null);
  // Spotify song links still work; Spotify podcasts/playlists don't
  assert.equal((await A.c.from('profile_details').update({ music: { provider: 'spotify', url: 'https://open.spotify.com/track/2nLtzopw4rPReszdYBJU6h' } }).eq('id', A.id)).error, null);
  assert.ok((await A.c.from('profile_details').update({ music: { provider: 'spotify', url: 'https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M' } }).eq('id', A.id)).error);

  // visitors can report the song
  const B = await apiUserUI(uname('songv'));
  await B.page.goto(`${BASE}/u/${A.username}`);
  await B.page.getByRole('button', { name: 'Report this song' }).click();
  await B.page.getByRole('radio', { name: /Profile song/ }).isChecked().then((c) => assert.ok(c, 'song reason preselected'));
  await B.page.getByRole('button', { name: /^Send/ }).click();
  await B.page.getByText('A moderator will look at it').waitFor();
  const { data: rep } = await admin.from('reports').select('reason').eq('target_id', A.id).eq('reason', 'music');
  assert.equal(rep.length, 1);
  assertClean(p, 'song picker'); assertClean(B.page, 'song visitor');
});

test('autoplay never starts from clicking a button or link', async () => {
  const A = await makeUser(uname('auto'));
  await admin.rpc('set_profile_song', { p_user: A.id, p_music: { provider: 'youtube', url: 'https://www.youtube.com/watch?v=aaaaaaaaaaa', title: 'Numb', autoplay: true } });
  const V = await apiUserUI(uname('autov'));
  const p = V.page;
  await p.goto(`${BASE}/u/${A.username}`);
  await p.locator('iframe[title*="YouTube"]').waitFor();
  const spy = () => p.evaluate(() => { window.__kicks = 0; const f = document.querySelector('iframe[title*="YouTube"]');
    Object.defineProperty(f, 'contentWindow', { get: () => ({ postMessage: () => { window.__kicks++; } }) }); });
  await spy();
  await p.getByRole('button', { name: 'Report' }).first().click();
  assert.equal(await p.evaluate(() => window.__kicks), 0, 'clicking Report must not start the song');
  await p.reload(); await p.locator('iframe[title*="YouTube"]').waitFor(); await spy();
  await p.mouse.click(5, 300); // blank page area
  assert.equal(await p.evaluate(() => window.__kicks), 1, 'a click on the page itself starts it');
});

test('Last.fm "Now listening": connect, show live, listen invisibly, disconnect', async () => {
  const A = await apiUserUI(uname('lfm'));
  const p = A.page;
  await p.goto(BASE + '/settings/profile');
  await p.fill('#lfm', 'rj_listens'); await p.getByRole('button', { name: 'Connect' }).click();
  await p.getByText('Connected. Your page now shows').waitFor();
  const V = await apiUserUI(uname('lfmv'));
  await V.page.goto(`${BASE}/u/${A.username}`);
  const box = V.page.locator('.so-listening');
  await box.getByText('NOW LISTENING').waitFor(); await box.getByText('Numb').waitFor(); await box.getByText('Linkin Park').waitFor();
  assert.equal(await V.page.getByText('rj_listens').count(), 0, 'Last.fm username is never shown');
  // invisible
  await p.getByLabel(/Listen invisibly/).check(); await p.getByText('Invisible: nobody sees').waitFor();
  assert.equal((await V.page.request.get(`${BASE}/api/now-listening?u=${A.id}`)).status(), 404);
  // blocked people never see it either
  await p.getByLabel(/Listen invisibly/).uncheck(); await p.getByText('Sharing what you’re playing again').waitFor();
  assert.equal((await V.page.request.get(`${BASE}/api/now-listening?u=${A.id}`)).status(), 200);
  await A.c.from('blocks').insert({ blocker_id: A.id, blocked_id: V.id });
  assert.equal((await V.page.request.get(`${BASE}/api/now-listening?u=${A.id}`)).status(), 404);
  await p.getByRole('button', { name: 'Disconnect Last.fm' }).click(); await p.getByText('Disconnected from Last.fm.').waitFor();
  const { data } = await A.c.rpc('my_listening'); assert.equal(data.length, 0);
  assertClean(p, 'listening settings');
});

test('Sentinel hides clearly bad posts and comments, a moderator can put them back', async () => {
  const U = await makeUser(uname('sent'));
  const { data: post } = await U.c.from('posts').insert({ author_id: U.id, kind: 'status', body: 'SENTINEL_BAD you are trash' }).select('id').single();
  const { data: okPost } = await U.c.from('posts').insert({ author_id: U.id, kind: 'status', body: 'nice day out' }).select('id').single();
  const { data: com } = await U.c.from('comments').insert({ post_id: okPost.id, author_id: U.id, body: 'SENTINEL_BAD comment' }).select('id').single();
  const { data: sad } = await U.c.from('posts').insert({ author_id: U.id, kind: 'status', body: 'SENTINEL_SELFHARM rough week' }).select('id').single();
  await drain();
  const { data: p1 } = await admin.from('posts').select('hidden_at').eq('id', post.id).single();
  assert.ok(p1.hidden_at, 'bad post hidden');
  assert.equal((await admin.from('posts').select('hidden_at').eq('id', okPost.id).single()).data.hidden_at, null, 'fine post untouched');
  assert.equal((await admin.from('comments').select('id').eq('id', com.id)).data.length, 0, 'bad comment taken down');
  assert.equal((await admin.from('posts').select('hidden_at').eq('id', sad.id).single()).data.hidden_at, null, 'self-harm posts are not silenced');
  const { data: reps } = await admin.from('reports').select('id, reason, reporter_id, target_id, details').in('target_id', [post.id, com.id, sad.id]);
  assert.equal(reps.length, 3); assert.ok(reps.every((r) => r.reporter_id === null && r.details.startsWith('Sentinel')));
  assert.equal(reps.find((r) => r.target_id === sad.id).reason, 'self_harm');
  const { data: notes } = await admin.from('notifications').select('data').eq('user_id', U.id).eq('type', 'moderation');
  assert.ok(notes.length >= 2, 'owner told something was hidden');

  // moderator: Dismiss puts it back
  const mod = await makeUser(uname('smod')); await admin.from('moderators').insert({ user_id: mod.id });
  const page = await newPage();
  await page.goto(BASE + '/login'); await page.fill('input[name=email]', mod.email); await page.fill('input[name=password]', 'password123');
  await page.click('button[type=submit]'); await page.waitForURL(/\/feed/);
  await page.goto(BASE + '/mod');
  await page.getByText('Sentinel is on').waitFor();
  await page.getByText('flagged by Sentinel (automatic)').first().waitFor();
  for (const r of reps.filter((x) => x.target_id !== sad.id)) assert.equal((await mod.c.rpc('mod_resolve', { p_report: r.id, p_action: 'dismiss' })).error, null);
  assert.equal((await admin.from('posts').select('hidden_at').eq('id', post.id).single()).data.hidden_at, null, 'post restored');
  assert.equal((await admin.from('comments').select('body').eq('id', com.id)).data[0]?.body, 'SENTINEL_BAD comment', 'comment restored');
  assertClean(page, 'mod with sentinel');
});

test('Sentinel: suspected child abuse is hidden, preserved and made urgent, without tipping off the poster', async () => {
  const U = await makeUser(uname('sentm')); const O = await makeUser(uname('sento'));
  const { data: gb } = await admin.from('guestbook_entries').insert({ profile_id: O.id, author_id: U.id, body: 'SENTINEL_MINOR' }).select('id').single();
  await drain();
  assert.ok((await admin.from('guestbook_entries').select('hidden_at').eq('id', gb.id).single()).data.hidden_at);
  const { data: rep } = await admin.from('reports').select('reason').eq('target_id', gb.id);
  assert.equal(rep[0].reason, 'child_safety');
  const { data: notes } = await admin.from('notifications').select('data').eq('user_id', U.id).eq('type', 'moderation');
  assert.equal(notes.length, 0, 'no heads-up to the poster');
  const mod = await makeUser(uname('smod2')); await admin.from('moderators').insert({ user_id: mod.id });
  assert.ok(((await mod.c.rpc('mod_urgent_count')).data || 0) >= 1, 'counts as urgent');
});

test('takedown: paste a link, the content really comes down, and the request closes', async () => {
  const U = await makeUser(uname('tdu'));
  const { data: post } = await U.c.from('posts').insert({ author_id: U.id, kind: 'status', body: 'a photo of someone without consent' }).select('id').single();
  const page = await newPage();
  await page.goto(BASE + '/report-content?type=intimate_image');
  await page.fill('textarea[name=urls]', `${BASE}/post/${post.id}`); await page.fill('textarea[name=description]', 'that is me');
  await page.fill('input[name=name]', 'Jane'); await page.fill('input[name=email]', 'jane@example.test');
  await page.check('input[name=is_subject]'); await page.check('input[name=sworn]'); await page.fill('input[name=signature]', 'Jane');
  await page.click('button:has-text("Send request")'); await page.getByText('REQUEST RECEIVED').waitFor();

  const mod = await makeUser(uname('tdmod')); await admin.from('moderators').insert({ user_id: mod.id });
  const m = await newPage();
  await m.goto(BASE + '/login'); await m.fill('input[name=email]', mod.email); await m.fill('input[name=password]', 'password123');
  await m.click('button[type=submit]'); await m.waitForURL(/\/feed/);
  await m.goto(BASE + '/mod');
  const card = m.locator('li', { hasText: `${BASE}/post/${post.id}` }).first();
  await card.getByPlaceholder(/Paste the link/).fill(`${BASE}/post/${post.id}`);
  await card.getByRole('button', { name: 'Remove it' }).click();
  await m.getByText(/Removed \(post\)/).waitFor();
  assert.ok((await admin.from('posts').select('hidden_at').eq('id', post.id).single()).data.hidden_at, 'post is down');
  const { data: td } = await mod.c.rpc('mod_takedowns', { p_status: 'removed' });
  assert.ok(td.some((t) => t.urls.includes(post.id)), 'request closed as removed');
  // child-safety requests show "act now", not a 48h clock
  await page.goto(BASE + '/report-content?type=child_safety');
  await page.fill('textarea[name=urls]', `${BASE}/u/${U.username}`); await page.fill('textarea[name=description]', 'concerning');
  await page.fill('input[name=name]', 'Pat'); await page.fill('input[name=email]', 'pat@example.test');
  await page.click('button:has-text("Send request")'); await page.getByText('REQUEST RECEIVED').waitFor();
  await m.goto(BASE + '/mod');
  await m.getByText('Act now: report to NCMEC as soon as possible').first().waitFor();
  assertClean(m, 'takedown removal');
});

test('ideas & questions: members send them, moderators read and mark them done', async () => {
  const A = await apiUserUI(uname('idea'));
  await A.page.goto(BASE + '/feedback');
  await A.page.fill('textarea[name=message]', 'This is cool! I want to be able to FaceTime on here.');
  await A.page.click('button:has-text("Send it")');
  await A.page.getByText('MESSAGE SENT').waitFor();
  const mod = await makeUser(uname('imod')); await admin.from('moderators').insert({ user_id: mod.id });
  const { data } = await mod.c.rpc('mod_feedback', { p_status: 'new' });
  const mine = data.find((f) => f.username === A.username);
  assert.ok(mine); assert.equal(mine.reply_email, A.email); assert.equal(mine.kind, 'idea');
  assert.ok((await A.c.rpc('mod_feedback', { p_status: 'new' })).error, 'members can’t read the inbox');
  assert.equal((await mod.c.rpc('mod_feedback_status', { p_id: mine.id, p_status: 'done' })).error, null);
  assertClean(A.page, 'feedback');
});
