// Profile layout: cover photo framing, background picture layout, music autoplay, custom CSS (and its safety rails).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { launch, close, BASE, newPage } from './browser.mjs';
import { makeUser, befriend, uname } from '../helpers.mjs';

let A, B, page;
const PIC = 'http://localhost:54321/storage/v1/object/public/media/x/pic.png';
before(async () => {
  await launch();
  [A, B] = await Promise.all([makeUser(uname('css_a')), makeUser(uname('css_b'))]);
  await befriend(A, B);
  page = await newPage({ viewport: { width: 1280, height: 900 } });
  page.removeAllListeners('console'); page.problems = [];
  await page.goto(BASE + '/login');
  await page.fill('input[name=email]', B.email); await page.fill('input[name=password]', 'password123');
  await page.click('button[type=submit]'); await page.waitForURL(/\/feed/);
});
after(close);

test('saved layout settings render for visitors', async () => {
  const r = await A.c.from('profile_details').update({
    banner_url: PIC,
    theme: { preset: 'midnight', bg_image: PIC, bg_size: 'tile', bg_x: 10, bg_y: 90, bg_fixed: false, bg_dim: 40, banner_x: 20, banner_y: 80, banner_zoom: 150 },
    music: { provider: 'youtube', url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', title: 'Song' },
    custom_css: `.so-name { color: rgb(0, 255, 0) } body { border-top: 7px solid rgb(255, 0, 0) }
      .so-safe { display: none } .x { position: fixed } div { background-image: url(https://evil.example/t.gif) } @import url(https://evil.example/a.css);`,
  }).eq('id', A.id);
  assert.equal(r.error, null);
  await page.goto(`${BASE}/u/${A.username}`);
  await page.locator('.so-name').waitFor();
  // custom CSS applies, scoped to the profile
  assert.equal(await page.locator('.so-name').evaluate((e) => getComputedStyle(e).color), 'rgb(0, 255, 0)');
  assert.equal(await page.locator('.so-page').evaluate((e) => getComputedStyle(e).borderTopWidth), '7px');
  // but can't hide the safety buttons or reach outside sites
  const css = await page.locator('style').allTextContents();
  const mine = css.find((c) => c.includes('.so-css')) || '';
  assert.ok(!mine.includes('evil.example'), 'outside URLs stripped');
  assert.ok(!/position:\s*fixed/.test(mine), 'fixed positioning stripped');
  assert.equal(await page.locator('.so-safe').first().evaluate((e) => getComputedStyle(e).display), 'flex', 'safety buttons stay visible');
  assert.ok(await page.getByRole('button', { name: /Report page/ }).isVisible());
  // nothing leaks outside the profile (site header untouched)
  assert.notEqual(await page.locator('header').first().evaluate((e) => getComputedStyle(e).borderTopWidth), '7px');
  // background layout
  const bg = await page.locator('.so-page').evaluate((e) => { const c = getComputedStyle(e); return [c.backgroundRepeat, c.backgroundPosition, c.backgroundAttachment, c.backgroundImage]; });
  assert.match(bg[0], /repeat/); assert.match(bg[1], /10% 90%/); assert.match(bg[2], /scroll/); assert.match(bg[3], /linear-gradient/);
  // cover framing
  const img = await page.locator('.so-banner img').evaluate((e) => [e.style.objectPosition, e.style.transform]);
  assert.equal(img[0], '20% 80%'); assert.equal(img[1], 'scale(1.5)');
  // music autoplays (player loaded with autoplay on), and a visitor can turn it off for themselves
  const frame = page.locator('.so-music iframe').first();
  await frame.waitFor({ state: 'attached' });
  assert.match(await frame.getAttribute('src'), /autoplay=1/);
  assert.equal(await page.locator('iframe[src*="youtube"]').count(), 1, 'exactly one player, so the song never plays twice');
  await page.setViewportSize({ width: 390, height: 844 }); await page.waitForTimeout(300);
  assert.equal(await page.locator('iframe[src*="youtube"]').count(), 1, 'still one player on phone width');
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.getByRole('button', { name: 'Stop autoplay on profiles' }).first().click();
  await page.reload(); await page.locator('.so-name').waitFor(); await page.waitForTimeout(500);
  assert.equal(await page.locator('.so-music iframe').count(), 0, 'stays off after reload');
  await page.getByRole('button', { name: 'Turn profile autoplay back on' }).first().click();
});

test('owner can drag the cover photo and edit CSS live, then save', async () => {
  const p2 = await newPage({ viewport: { width: 1280, height: 900 } });
  p2.removeAllListeners('console');
  await p2.goto(BASE + '/login');
  await p2.fill('input[name=email]', A.email); await p2.fill('input[name=password]', 'password123');
  await p2.click('button[type=submit]'); await p2.waitForURL(/\/feed/);
  await p2.goto(`${BASE}/u/${A.username}?edit=1`);
  const banner = p2.locator('.so-banner');
  await banner.waitFor();
  assert.equal(await p2.locator('.so-music iframe').count(), 0, 'no autoplay while editing your own page');
  const box = await banner.boundingBox();
  await p2.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await p2.mouse.down();
  await p2.mouse.move(box.x + box.width / 2 + 100, box.y + box.height / 2 + 40, { steps: 5 }); await p2.mouse.up();
  const pos = await p2.locator('.so-banner img').evaluate((e) => e.style.objectPosition);
  assert.notEqual(pos, '20% 80%', 'dragging moves the photo');
  await p2.locator('#ed-css').fill('.so-headline { color: rgb(1, 2, 3) } .so-name { color: rgb(9, 9, 9) }');
  await p2.waitForFunction(() => getComputedStyle(document.querySelector('.so-name')).color === 'rgb(9, 9, 9)');
  await p2.getByRole('button', { name: 'Save changes' }).click();
  await p2.getByText('Saved. Your page is live.').waitFor();
  const { data } = await A.c.from('profile_details').select('custom_css, theme').eq('id', A.id).single();
  assert.match(data.custom_css, /rgb\(9, 9, 9\)/);
  assert.equal(data.theme.banner_zoom, 150);
  assert.notEqual(`${data.theme.banner_x}% ${data.theme.banner_y}%`, '20% 80%');
  await p2.close();
});

test('log out from the account menu works', async () => {
  await page.goto(`${BASE}/feed`);
  await page.getByRole('button', { name: 'Account menu' }).click();
  await page.getByRole('menuitem', { name: 'Log out' }).click();
  await page.waitForURL((u) => !u.pathname.startsWith('/feed'));
  await page.goto(`${BASE}/feed`);
  await page.waitForURL(/\/login/);
});

test('Edit profile page: drag + zoom the cover photo and save just the position', async () => {
  const C = await makeUser(uname('css_c'));
  await C.c.from('profile_details').update({ banner_url: PIC, theme: { preset: 'forest', accent: '#FF7B00' } }).eq('id', C.id);
  const p3 = await newPage({ viewport: { width: 1280, height: 900 } }); p3.removeAllListeners('console');
  await p3.goto(BASE + '/login');
  await p3.fill('input[name=email]', C.email); await p3.fill('input[name=password]', 'password123');
  await p3.click('button[type=submit]'); await p3.waitForURL(/\/feed/);
  await p3.goto(BASE + '/settings/profile');
  const b = p3.locator('.so-banner'); await b.waitFor();
  const box = await b.boundingBox();
  await p3.mouse.move(box.x + 300, box.y + 80); await p3.mouse.down();
  await p3.mouse.move(box.x + 150, box.y + 20, { steps: 5 }); await p3.mouse.up();
  await p3.locator('input[type=range]').first().fill('180');
  await p3.getByRole('button', { name: 'Save position' }).click();
  await p3.getByText('Cover photo position saved.').waitFor();
  const { data } = await C.c.from('profile_details').select('theme').eq('id', C.id).single();
  assert.equal(data.theme.banner_zoom, 180);
  assert.ok(data.theme.banner_x !== 50 || data.theme.banner_y !== 50, 'moved');
  assert.equal(data.theme.accent, '#FF7B00', 'rest of the theme kept');
  await p3.close();
});
