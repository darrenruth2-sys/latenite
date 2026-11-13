import test from 'node:test'; import assert from 'node:assert/strict';
import { launch, close, newPage, signupUI, uniq, BASE, shot, assertClean, waitMail, linkIn } from './browser.mjs';

test.before(launch); test.after(close);

test('phase 1: signup, profile, friends, feed, privacy, password reset', async () => {
  // homepage + username claim
  const home = await newPage();
  await home.goto(BASE);
  await home.fill('#claim', 'admin');
  await home.getByText('@admin is taken').waitFor();
  await shot(home, 'p1-home');
  assertClean(home, 'home');

  // underage signup rejected client+server
  const kid = await newPage();
  await kid.goto(BASE + '/signup');
  const ku = uniq('kid');
  await kid.fill('#su-username', ku); await kid.fill('input[name=email]', ku + '@test.local');
  await kid.fill('input[name=password]', 'password123');
  await kid.evaluate(() => { const i = document.querySelector('input[name=birthdate]'); i.removeAttribute('max'); });
  await kid.fill('input[name=birthdate]', '2015-01-01'); await kid.check('input[name=agree]');
  await kid.click('button[type=submit]');
  await kid.getByText('18 or older').waitFor();

  const A = await signupUI(uniq('alice'), { display: 'Alice Night' });
  const B = await signupUI(uniq('bob'), { display: 'Bob Static', viewport: { width: 390, height: 844 } });
  await shot(A.page, 'p1-feed-empty');

  // edit profile
  await A.page.goto(BASE + '/settings/profile');
  await A.page.fill('textarea >> nth=0', 'I collect burned CDs and bad decisions.');
  await A.page.selectOption('select', 'nostalgic');
  await A.page.fill('input[placeholder^="vinyl"]', 'vinyl, night drives, Vinyl');
  await A.page.click('text=Save changes');
  await A.page.getByText('Saved. Your page is updated.').waitFor();
  await A.page.goto(`${BASE}/u/${A.username}`);
  await A.page.getByText('I collect burned CDs').waitFor();
  await A.page.getByText('mood: nostalgic').first().waitFor();
  assert.equal(await A.page.locator('ul[aria-label=Interests] li').count(), 2, 'interests deduped');
  await shot(A.page, 'p1-profile-own');

  // B sends request, A accepts from /friends
  await B.page.goto(`${BASE}/u/${A.username}`);
  await B.page.click('text=Add friend');
  await B.page.getByText('Request sent').waitFor();
  await A.page.goto(BASE + '/friends');
  await A.page.getByText('Friend requests · 1').waitFor();
  await A.page.click('text=Accept request');
  await A.page.getByText('All friends · 1').waitFor({ timeout: 10000 });

  // A posts friends-only; B sees it in feed, likes + comments; A gets notifications
  await A.page.goto(BASE + '/feed');
  await A.page.fill('#compose', 'first post on afterhours!!');
  await A.page.click('button:has-text("Post")');
  await A.page.getByText('first post on afterhours!!').waitFor();
  await B.page.goto(BASE + '/feed');
  const card = B.page.locator('article', { hasText: 'first post on afterhours!!' });
  await card.waitFor();
  await card.locator('button:has-text("♥")').click();
  await card.locator('button:has-text("♥ 1")').waitFor();
  await card.locator('button:has-text("Comment")').click();
  await card.locator('input[placeholder="write a comment…"]').fill('welcome!!');
  await card.locator('button:has-text("Reply")').click();
  await card.getByText('welcome!!').waitFor();
  await shot(B.page, 'p1-feed-mobile');
  await A.page.goto(BASE + '/notifications');
  await A.page.getByText('commented on your post').waitFor();
  await A.page.getByText('liked your post').waitFor();

  // stranger C cannot see friends-only post; private page hides content
  const C = await signupUI(uniq('carl'));
  await C.page.goto(`${BASE}/u/${A.username}`);
  await C.page.getByText('I collect burned CDs').waitFor();
  assert.equal(await C.page.getByText('first post on afterhours!!').count(), 0, 'stranger cannot see friends-only post');
  await A.page.goto(BASE + '/settings/privacy');
  await A.page.getByText('Private page').click();
  await A.page.getByText('Saved.').waitFor();
  await C.page.reload();
  await C.page.getByText('THIS PAGE IS PRIVATE').waitFor();
  await shot(C.page, 'p1-private');

  // block: C blocks A -> A can't load C's page
  await C.page.goto(`${BASE}/u/${C.username}`);
  await C.page.goto(`${BASE}/u/${B.username}`);
  C.page.once('dialog', (d) => d.accept());
  await C.page.click('button:has-text("Block")');
  await B.page.waitForTimeout(500);
  const r = await B.page.goto(`${BASE}/u/${C.username}`);
  // Pages stream behind a loading screen, so "not found" arrives as a not-found page (with noindex) rather than an HTTP 404.
  assert.ok([200, 404].includes(r.status()));
  await B.page.getByText('Nobody lives here.').waitFor();
  assert.equal(await B.page.locator('meta[name=robots][content*=noindex]').count() > 0 || r.status() === 404, true, 'not-found is not indexed');
  assert.equal(await B.page.getByText(C.display_name || C.username, { exact: true }).count(), 0, 'blocked profile content not shown');
  await C.page.goto(BASE + '/settings/privacy');
  await C.page.getByText(`@${B.username}`).waitFor();

  // password reset via email
  const t0 = Date.now();
  const R = await newPage();
  await R.goto(BASE + '/forgot');
  await R.fill('input[name=email]', B.email);
  await R.click('button[type=submit]');
  await R.getByText('reset link is on its way').waitFor();
  const mail = await waitMail(B.email, t0);
  await R.goto(linkIn(mail));
  await R.waitForURL(/reset-password/);
  await R.fill('input[name=password]', 'newpassword1'); await R.fill('input[name=confirm]', 'newpassword1');
  await R.click('button[type=submit]');
  await R.waitForURL(/feed/);
  // logout + login with new password
  const L = await newPage();
  await L.goto(BASE + '/login');
  await L.fill('input[name=email]', B.email); await L.fill('input[name=password]', 'password123');
  await L.click('button[type=submit]');
  await L.getByText('Wrong email or password').waitFor();
  await L.fill('input[name=password]', 'newpassword1'); await L.click('button[type=submit]');
  await L.waitForURL(/feed/);

  // protected route redirect when logged out
  const anon = await newPage();
  await anon.goto(BASE + '/feed');
  assert.match(anon.url(), /\/login\?next=%2Ffeed/);

  for (const [p, l] of [[A.page, 'A'], [B.page, 'B'], [C.page, 'C'], [home, 'home'], [R, 'reset'], [L, 'login']]) assertClean(p, l);
});
