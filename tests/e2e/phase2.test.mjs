import test from 'node:test'; import assert from 'node:assert/strict';
import { launch, close, apiUserUI, uniq, BASE, shot, assertClean, newPage } from './browser.mjs';
import { befriend } from '../helpers.mjs';

test.before(launch); test.after(close);

test('phase 2: live editor, themes, top friends drag, music, guestbook, visitors', async () => {
  const A = await apiUserUI(uniq('jules'), { display_name: 'Jules Marlowe' });
  const B = await apiUserUI(uniq('kayla'), { display_name: 'Kayla Exe' });
  const D = await apiUserUI(uniq('dj'), { display_name: 'DJ Static' });
  const C = await apiUserUI(uniq('rando'), { display_name: 'Rando' });
  await befriend(A, B); await befriend(A, D);

  const pg = A.page;
  await pg.goto(`${BASE}/u/${A.username}?edit=1`);
  await pg.getByText('LIVE PREVIEW').waitFor();
  // theme preset changes background live
  await pg.click('button:has-text("Bubblegum")');
  const bg = await pg.locator('[style*="--pg"]').first().evaluate((el) => getComputedStyle(el).backgroundColor);
  assert.equal(bg, 'rgb(255, 214, 236)', 'bubblegum background applied live');
  await pg.click('button[aria-label="Accent #2457D6"]');
  await pg.click('button:has-text("Pixel")');
  // Top friends: count 4, add two friends
  await pg.click('[aria-label="How many Top Friends"] button:has-text("4")');
  await pg.selectOption('#add-top', { label: `Kayla Exe (@${B.username})` });
  await pg.selectOption('#add-top', { label: `DJ Static (@${D.username})` });
  await pg.getByText("Jules's Top 4").waitFor();
  // keyboard drag: move #1 (Kayla) after DJ
  const kaylaTile = pg.locator('button[aria-label^="Kayla Exe, rank 1"]');
  await kaylaTile.focus();
  await pg.keyboard.press('Space'); await pg.waitForTimeout(200);
  await pg.keyboard.press('ArrowRight'); await pg.waitForTimeout(200);
  await pg.keyboard.press('Space'); await pg.waitForTimeout(300);
  await pg.locator('button[aria-label^="DJ Static, rank 1"]').waitFor();
  // section order: move guestbook to top
  while (await pg.locator('button[aria-label="Move Guestbook up"]').isEnabled()) await pg.click('button[aria-label="Move Guestbook up"]');
  // song: music-only search (stand-in YouTube results); picking one saves it right away
  await pg.fill('#ed-song', 'neon'); await pg.click('button:has-text("Search")');
  await pg.getByRole('list', { name: 'Songs' }).getByRole('button').first().click();
  await pg.getByText('is your profile song now').waitFor();
  await pg.fill('input[aria-label="Song title"]', 'Neon Parking Lot');
  await pg.fill('input[aria-label="Artist"]', 'The Late Arrivals');
  await pg.selectOption('label:has-text("WHO CAN SIGN") select', 'everyone');
  await pg.click('button:has-text("Save changes")');
  await pg.getByText('Saved. Your page is live.').waitFor();
  await shot(pg, 'p2-editor');

  // persisted after reload, seen by a visitor
  await B.page.goto(`${BASE}/u/${A.username}`);
  const bgB = await B.page.locator('[style*="--pg"]').first().evaluate((el) => getComputedStyle(el).backgroundColor);
  assert.equal(bgB, 'rgb(255, 214, 236)');
  await B.page.locator('text=Neon Parking Lot >> visible=true').first().waitFor();
  const order = await B.page.locator('#sec-top ol li a[aria-label$="page"]').evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')));
  assert.deepEqual(order.slice(0, 2), ["DJ Static's page", "Kayla Exe's page"], 'drag order saved');
  const firstSection = await B.page.locator('[id^="sec-"]').first().getAttribute('id');
  assert.equal(firstSection, 'sec-guestbook', 'section order saved');
  // B signs guestbook with a sticker; reply; like
  await B.page.fill('#gb-new', 'ok who taught u the banner thing');
  await B.page.click('button[aria-label="Add a sticker"]');
  await B.page.click('button:has-text("glitter bomb")');
  await B.page.click('button:has-text("Sign it")');
  await B.page.getByText('ok who taught u the banner thing').waitFor();
  await B.page.waitForTimeout(1500); // visit gets recorded
  await shot(B.page, 'p2-visitor-view');
  // stranger can sign (policy = everyone) and sees the entry
  await C.page.goto(`${BASE}/u/${A.username}`);
  await C.page.getByText('ok who taught u the banner thing').waitFor();
  await C.page.fill('#gb-new', 'hi from a stranger');
  await C.page.click('button:has-text("Sign it")');
  await C.page.getByText('hi from a stranger').waitFor();
  await C.page.waitForTimeout(1500);

  // owner: visitors listed, hides the stranger's entry, replies to Kayla
  await pg.goto(`${BASE}/u/${A.username}`);
  await pg.getByText('Who’s been by').waitFor();
  await pg.locator('#vis-h').locator('..').locator('..').getByText('Kayla Exe').waitFor();
  const strangerEntry = pg.locator('li', { hasText: 'hi from a stranger' }).first();
  await strangerEntry.locator('button:has-text("Hide")').click();
  await strangerEntry.getByText('HIDDEN FROM VISITORS').waitFor();
  const kEntry = pg.locator('li', { hasText: 'ok who taught u the banner thing' }).first();
  await kEntry.locator('button:has-text("Reply")').click();
  await kEntry.locator('textarea').fill('a magician never tells');
  await kEntry.locator('button:has-text("Reply")').last().click();
  await pg.getByText('a magician never tells').waitFor();
  // Kayla can't see the hidden stranger entry; stranger still sees own (marked hidden)
  await B.page.reload();
  assert.equal(await B.page.getByText('hi from a stranger').count(), 0);
  await B.page.getByText('a magician never tells').waitFor();
  // notifications: guestbook + top friend + visit
  await pg.goto(BASE + '/notifications');
  await pg.getByText('signed your guestbook').first().waitFor();
  await pg.getByText('visited your page').first().waitFor();
  await B.page.goto(BASE + '/notifications');
  await B.page.getByText(/added you to their Top/).waitFor();
  await B.page.getByText('replied in a guestbook').waitFor();
  // private browsing hides your own visitor list
  await pg.goto(`${BASE}/u/${A.username}`);
  await pg.getByText('Browse privately.').click();
  await pg.getByText('visitor names are hidden for you too').waitFor();
  // feed got a profile-update post with the song
  await B.page.goto(BASE + '/feed');
  await B.page.getByText('changed their profile song').waitFor();
  // phone layout
  const M = await newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await M.goto(`${BASE}/u/${A.username}`);
  await M.getByRole('navigation', { name: 'Jump to section' }).waitFor();
  const overflow = await M.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  assert.ok(overflow <= 1, 'no horizontal scroll on phone, got ' + overflow);
  await shot(M, 'p2-profile-phone');
  for (const [p, l] of [[pg, 'A'], [B.page, 'B'], [C.page, 'C'], [M, 'M']]) assertClean(p, l);
});
