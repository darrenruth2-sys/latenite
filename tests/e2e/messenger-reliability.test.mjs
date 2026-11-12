// Messenger reliability: chat switching, offline send + retry, background tabs, scroll position.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { launch, close, BASE, newPage, assertClean } from './browser.mjs';
import { makeUser, befriend, uname } from '../helpers.mjs';

let A, B, C, abConv, acConv, page;
before(async () => {
  await launch();
  [A, B, C] = await Promise.all([makeUser(uname('rel_a')), makeUser(uname('rel_b')), makeUser(uname('rel_c'))]);
  await befriend(A, B); await befriend(A, C);
  abConv = (await A.c.rpc('start_dm', { p_other: B.id })).data;
  acConv = (await A.c.rpc('start_dm', { p_other: C.id })).data;
  for (let i = 0; i < 40; i++) await B.c.from('messages').insert({ conversation_id: abConv, sender_id: B.id, kind: 'text', body: `from-B ${i}` });
  await C.c.from('messages').insert({ conversation_id: acConv, sender_id: C.id, kind: 'text', body: 'from-C hello' });
  page = await newPage({ viewport: { width: 1280, height: 900 } });
  page.problems = []; // offline step below causes expected network errors; we check app-level crashes only
  page.removeAllListeners('console');
  await page.goto(BASE + '/login');
  await page.fill('input[name=email]', A.email); await page.fill('input[name=password]', 'password123');
  await page.click('button[type=submit]'); await page.waitForURL(/\/feed/);
});
after(close);

test('switching chats fast never mixes conversations', async () => {
  for (let i = 0; i < 6; i++) {
    await page.goto(`${BASE}/messenger?c=${abConv}`);
    await page.goto(`${BASE}/messenger?c=${acConv}`);
  }
  await page.getByText('from-C hello').waitFor();
  await page.waitForTimeout(3500); // let a few polls land
  assert.equal(await page.getByText(/from-B \d+/).count(), 0, 'B messages leaked into the C chat');
  // in-app switching (no reload)
  await page.goto(`${BASE}/messenger?c=${abConv}`); await page.getByText('from-B 39').waitFor();
  await page.getByRole('button', { name: /← Back|Back to buddy list/ }).click().catch(() => {});
  const cBtn = page.locator('section[aria-labelledby=bl-h] button', { hasText: C.username }).first();
  await cBtn.click(); await page.getByText('from-C hello').waitFor();
  await page.waitForTimeout(3000);
  assert.equal(await page.getByText(/from-B \d+/).count(), 0, 'B messages leaked after in-app switch');
});

test('send while offline keeps your text, Retry delivers it once', async () => {
  await page.goto(`${BASE}/messenger?c=${acConv}`); await page.getByText('from-C hello').waitFor();
  await page.context().setOffline(true);
  await page.fill('#ms-msg', 'sent while offline'); await page.click('button:has-text("Send")');
  await page.getByText('not sent').waitFor();
  await page.getByText('Connection lost').waitFor({ timeout: 10000 });
  await page.context().setOffline(false);
  await page.getByRole('button', { name: 'Retry' }).click();
  await page.getByText('not sent').waitFor({ state: 'detached' });
  await page.waitForTimeout(3000);
  assert.equal(await page.getByText('sent while offline', { exact: true }).count(), 1, 'message should appear exactly once');
  const { data } = await C.c.from('messages').select('body').eq('conversation_id', acConv).eq('body', 'sent while offline');
  assert.equal(data.length, 1, 'stored exactly once');
  await page.getByText('Connection lost').waitFor({ state: 'detached' });
});

test('your own message never blinks out after sending', async () => {
  await page.fill('#ms-msg', 'no blink please'); await page.click('button:has-text("Send")');
  const seen = await page.evaluate(async () => {
    const out = []; const t0 = performance.now();
    while (performance.now() - t0 < 2500) { out.push([...document.querySelectorAll('#chat p')].some((p) => p.textContent === 'no blink please')); await new Promise((r) => setTimeout(r, 30)); }
    return out;
  });
  const firstSeen = seen.indexOf(true);
  assert.ok(firstSeen >= 0, 'message never appeared');
  assert.ok(seen.slice(firstSeen).every(Boolean), 'message disappeared after appearing');
});

test('a background tab still picks up messages (so desktop alerts can fire), and doesn’t mark them read', async () => {
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')); });
  const before = Date.now();
  await C.c.from('messages').insert({ conversation_id: acConv, sender_id: C.id, kind: 'text', body: 'ping while hidden' });
  await page.getByText('ping while hidden').waitFor({ timeout: 15000 });
  const { data: st } = await C.c.rpc('conversation_state', { p_conv: acConv });
  const mine = st.find((s) => s.user_id === A.id);
  assert.ok(!mine?.last_read_at || new Date(mine.last_read_at).getTime() < before, 'should not be marked read while the tab is hidden');
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => false }); document.dispatchEvent(new Event('visibilitychange')); });
  await page.waitForTimeout(1500);
  const { data: st2 } = await C.c.rpc('conversation_state', { p_conv: acConv });
  assert.ok(new Date(st2.find((s) => s.user_id === A.id).last_read_at).getTime() >= before, 'marked read once you come back');
});

test('reading older messages is not interrupted by new ones', async () => {
  await page.goto(`${BASE}/messenger?c=${abConv}`); await page.getByText('from-B 39').waitFor(); await page.waitForTimeout(800);
  const list = page.locator('#chat [aria-live=polite]');
  await list.evaluate((el) => { el.scrollTop = 0; el.dispatchEvent(new Event('scroll')); });
  await B.c.from('messages').insert({ conversation_id: abConv, sender_id: B.id, kind: 'text', body: 'new while reading' });
  await page.getByText('new while reading').waitFor({ timeout: 10000 }); await page.waitForTimeout(700);
  assert.ok(await list.evaluate((el) => el.scrollTop) < 50, 'should stay where you were reading');
  // at the bottom, new messages are followed
  await list.evaluate((el) => { el.scrollTop = el.scrollHeight; el.dispatchEvent(new Event('scroll')); });
  await B.c.from('messages').insert({ conversation_id: abConv, sender_id: B.id, kind: 'text', body: 'follow me' });
  await page.getByText('follow me').waitFor({ timeout: 10000 }); await page.waitForTimeout(900);
  assert.ok(await list.evaluate((el) => el.scrollHeight - el.scrollTop - el.clientHeight < 60), 'should follow when at bottom');
  assertClean(page, 'messenger');
});
