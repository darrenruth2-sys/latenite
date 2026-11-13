import test from 'node:test'; import assert from 'node:assert/strict';
import { launch, close, apiUserUI, uniq, BASE, shot, assertClean, newPage } from './browser.mjs';
import { befriend } from '../helpers.mjs';
import path from 'node:path'; import { fileURLToPath } from 'node:url';
const PNG = path.join(path.dirname(fileURLToPath(import.meta.url)), 'pink.png');

test.before(launch); test.after(close);

test('phase 3: real-time-ish chat, typing, receipts, nudges, away, photos, groups', async () => {
  const A = await apiUserUI(uniq('kayla'), { display_name: 'Kayla Exe' });
  const B = await apiUserUI(uniq('jules'), { display_name: 'Jules Marlowe' });
  const C = await apiUserUI(uniq('pix'), { display_name: 'Pixelz' });
  await befriend(A, B); await befriend(A, C); await befriend(B, C);
  await Promise.all([A.page.goto(BASE + '/messenger'), B.page.goto(BASE + '/messenger'), C.page.goto(BASE + '/messenger')]);
  // A sees B online in buddy list and opens the chat
  const bRow = A.page.locator('button', { hasText: 'Jules Marlowe' }).first();
  await bRow.waitFor();
  await bRow.click();
  await A.page.getByText('no messages yet').waitFor();
  await A.page.fill('#ms-msg', 'ok who is the new #2 in ur top 8 ??');
  await A.page.press('#ms-msg', 'Enter');
  await A.page.getByText('ok who is the new #2 in ur top 8 ??').waitFor();
  // B gets unread badge, opens, types, replies
  await B.page.waitForTimeout(1000);
  await B.page.reload();
  await B.page.locator('a[href="/messenger"] span.bg-pink, nav a[href="/messenger"] span').first().waitFor();
  await B.page.locator('button', { hasText: 'Kayla Exe' }).first().click();
  await B.page.getByText('ok who is the new #2 in ur top 8 ??').waitFor();
  await B.page.type('#ms-msg', 'lol nobody new', { delay: 40 });
  await A.page.getByText('Jules Marlowe is typing').waitFor({ timeout: 10000 });
  await B.page.press('#ms-msg', 'Enter');
  await A.page.getByText('lol nobody new').waitFor({ timeout: 10000 });
  await B.page.getByText(/^Seen /).waitFor({ timeout: 10000 });
  // nudge shakes the other window, then cooldown
  await A.page.click('button:has-text("Nudge!")');
  await A.page.getByText('Nudge (').waitFor();
  await B.page.getByText('Kayla Exe sent you a nudge!'.replace('Kayla Exe', A.username)).waitFor({ timeout: 10000 });
  // photo
  await B.page.setInputFiles('label[aria-label="Send a photo"] input', PNG);
  await A.page.locator('img[alt="Photo"]').waitFor({ timeout: 15000 });
  await A.page.waitForFunction(() => { const i = document.querySelector('img[alt="Photo"]'); return i && i.complete && i.naturalWidth > 0; }, null, { timeout: 10000 });
  // away + auto reply
  await B.page.selectOption('#ms-status', 'away');
  await B.page.click('button:has-text("Out with friends")');
  await B.page.waitForTimeout(800);
  await A.page.fill('#ms-msg', 'u around?'); await A.page.press('#ms-msg', 'Enter');
  await A.page.getByText(`${B.username} is away:`).waitFor({ timeout: 10000 });
  await A.page.getByText('Out with friends').first().waitFor();
  await shot(A.page, 'p3-messenger');
  // group chat
  await C.page.click('button:has-text("+ Group")');
  await C.page.fill('input[placeholder="Rink crew"]', 'Rink crew');
  await C.page.locator('label', { hasText: 'Kayla Exe' }).locator('input').check();
  await C.page.locator('label', { hasText: 'Jules Marlowe' }).locator('input').check();
  await C.page.click('button:has-text("Create group")');
  await C.page.getByText('Rink crew — conversation').waitFor();
  await C.page.fill('#ms-msg', 'friday 8pm?'); await C.page.press('#ms-msg', 'Enter');
  await A.page.waitForTimeout(13000); // list refresh interval
  await A.page.locator('button', { hasText: 'Rink crew' }).first().click();
  await A.page.getByText('friday 8pm?').first().waitFor(); // it's in the chat and the list preview
  // phone: list first, then chat with back button
  const M = await newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await M.goto(BASE + '/login');
  await M.fill('input[name=email]', C.email); await M.fill('input[name=password]', 'password123'); await M.click('button[type=submit]');
  await M.waitForURL(/feed/);
  await M.goto(BASE + '/messenger');
  await M.locator('button', { hasText: 'Kayla Exe' }).first().click();
  await M.locator('button[aria-label="Back to buddy list"]').waitFor();
  const overflow = await M.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  assert.ok(overflow <= 1, 'no sideways scroll on phone');
  await shot(M, 'p3-messenger-phone');
  // profile shows online status to friends
  await C.page.goto(`${BASE}/u/${A.username}`);
  await C.page.getByText(/Online now/).waitFor();
  for (const [p, l] of [[A.page, 'A'], [B.page, 'B'], [C.page, 'C'], [M, 'M']]) assertClean(p, l);
});
