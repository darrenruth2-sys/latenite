// v10.4: the "Signing on…" screen, and profile sections with their own links (/u/name/friends, /photos, /guestbook, /blog).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { launch, close, BASE, newPage, apiUserUI, assertClean } from './browser.mjs';
import { admin, makeUser, befriend, uname } from '../helpers.mjs';

before(launch);
after(close);
const pic = (id, n) => `http://localhost:54321/storage/v1/object/public/media/${id}/p${n}.png`;

test('"Signing on…" shows once per visit, steps through, and can be skipped', async () => {
  const p = await newPage();
  // real people's browsers aren't "automated", so pretend not to be for this test
  await p.addInitScript(() => Object.defineProperty(navigator, 'webdriver', { get: () => false }));
  await p.goto(BASE + '/terms');
  const splash = p.locator('#so-splash');
  await splash.waitFor();
  await p.getByText('Dialing…').waitFor();
  await p.getByText('Signed On!').waitFor({ timeout: 4000 });
  await splash.waitFor({ state: 'detached', timeout: 4000 });
  // same visit: not again
  await p.goto(BASE + '/privacy'); await p.waitForTimeout(400);
  assert.equal(await splash.count(), 0, 'only once per visit');
  // new visit: tap to skip
  const q = await newPage();
  await q.addInitScript(() => Object.defineProperty(navigator, 'webdriver', { get: () => false }));
  await q.goto(BASE + '/rules');
  await q.locator('#so-splash').click();
  await q.locator('#so-splash').waitFor({ state: 'detached', timeout: 1500 });
  assertClean(p, 'splash'); assertClean(q, 'splash skip');
});

test('profile sections have their own links and respect privacy', async () => {
  const A = await makeUser(uname('seca')); const B = await makeUser(uname('secb')); const C = await makeUser(uname('secc'));
  await befriend(A, B);
  for (const n of [1, 2]) await A.c.from('posts').insert({ author_id: A.id, kind: 'photo', visibility: 'public', body: 'pic ' + n, media: [{ url: pic(A.id, n) }] });
  await A.c.from('posts').insert({ author_id: A.id, kind: 'status', body: 'no pic' });
  await B.c.from('guestbook_entries').insert({ profile_id: A.id, author_id: B.id, body: 'hey from B' });
  const V = await apiUserUI(uname('secV'));
  const p = V.page;
  await p.goto(`${BASE}/u/${A.username}/friends`);
  await p.getByRole('heading', { name: /friends · 1/ }).waitFor();
  await p.getByRole('link', { name: new RegExp(B.username) }).waitFor();
  await p.getByRole('link', { name: 'Photos' }).click(); await p.waitForURL(new RegExp(`/u/${A.username}/photos$`), { waitUntil: 'commit' });
  await p.getByRole('heading', { name: /photos · 2/ }).waitFor();
  assert.equal(await p.locator('main img[loading=lazy]').count(), 2);
  await p.getByRole('link', { name: 'Guestbook' }).click(); await p.waitForURL(/\/guestbook$/);
  await p.getByText('hey from B').waitFor();
  await p.getByRole('link', { name: 'Blog' }).click(); await p.waitForURL(new RegExp(`/blog/${A.username}`));
  await p.goBack(); await p.waitForURL(/\/guestbook$/);
  // main page links to them
  await p.goto(`${BASE}/u/${A.username}`);
  await p.getByRole('navigation', { name: 'Profile sections' }).getByRole('link', { name: 'Friends' }).click(); await p.waitForURL(/\/friends$/, { waitUntil: 'commit' });

  // private page: sections are private too
  await admin.from('profiles').update({ is_private: true }).eq('id', A.id);
  await p.goto(`${BASE}/u/${A.username}/photos`);
  await p.getByText('THIS PAGE IS PRIVATE').waitFor();
  assert.equal(await p.locator('main img[loading=lazy]').count(), 0);
  // ...but friends still see them
  const pb = await newPage();
  await pb.goto(BASE + '/login'); await pb.fill('input[name=email]', B.email); await pb.fill('input[name=password]', 'password123');
  await pb.click('button[type=submit]'); await pb.waitForURL(/\/feed/);
  await pb.goto(`${BASE}/u/${A.username}/photos`); await pb.getByRole('heading', { name: /photos · 2/ }).waitFor();
  // blocked: nothing
  await A.c.from('blocks').insert({ blocker_id: A.id, blocked_id: C.id });
  const pc = await newPage();
  await pc.goto(BASE + '/login'); await pc.fill('input[name=email]', C.email); await pc.fill('input[name=password]', 'password123');
  await pc.click('button[type=submit]'); await pc.waitForURL(/\/feed/);
  const r = await pc.goto(`${BASE}/u/${A.username}/friends`);
  assert.ok(r.status() === 404 || await pc.getByText('THIS PAGE IS PRIVATE').count() > 0, 'blocked people get nothing');
  assertClean(p, 'sections');
});
