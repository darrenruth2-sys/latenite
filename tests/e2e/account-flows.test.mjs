// Flows a random monkey won't complete: search, password change, data download, unfriend, block/unblock, delete account.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { launch, close, BASE, newPage, assertClean } from './browser.mjs';
import { admin, makeUser, befriend, uname } from '../helpers.mjs';

let A, B, page;
const login = async (p, u, pw = 'password123') => {
  await p.goto(BASE + '/login'); await p.fill('input[name=email]', u.email); await p.fill('input[name=password]', pw);
  await p.click('button[type=submit]'); await p.waitForURL(/\/feed/);
};
before(async () => {
  await launch();
  [A, B] = await Promise.all([makeUser(uname('acc_a')), makeUser(uname('acc_b'))]);
  await befriend(A, B);
  page = await newPage(); page.on('dialog', (d) => d.accept());
  await login(page, A);
});
after(close);

test('header search finds people by name, by interest, and communities by name', async () => {
  const tag = 'zz' + Math.random().toString(36).slice(2, 7);
  await B.c.from('profile_details').update({ interests: [tag] }).eq('id', B.id);
  await B.c.from('profiles').update({ discoverable: true }).eq('id', B.id);
  await A.c.rpc('create_community', { p_slug: tag + '-club', p_name: `${tag} Club`, p_description: 'x', p_public: true });
  await page.goto(BASE + '/feed');
  await page.fill('#hdr-q', tag); await page.press('#hdr-q', 'Enter');
  await page.waitForURL(/\/discover\?q=/);
  await page.getByRole('link', { name: new RegExp(B.username) }).first().waitFor();
  await page.getByRole('link', { name: new RegExp(`${tag} Club`) }).waitFor();
  await page.fill('#dq', B.username); await page.click('button:has-text("Search")');
  await page.getByRole('link', { name: new RegExp(B.username) }).first().waitFor();
  await page.fill('#dq', '100%_weird\\'); await page.click('button:has-text("Search")'); await page.waitForTimeout(800);
  assertClean(page, 'search');
});

test('download my data gives a complete JSON file', async () => {
  await page.goto(BASE + '/settings/account');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('link', { name: 'Download my data' }).click()]);
  const json = JSON.parse(fs.readFileSync(await dl.path(), 'utf8'));
  assert.equal(json.account.id, A.id);
  assert.ok(Array.isArray(json.friends) && json.friends.some((f) => f.id === B.id));
  assert.ok('conversations' in json && 'friend_requests_received' in json && 'gifts_received' in json);
});

test('change password: wrong current password is refused, right one works, new one logs in', async () => {
  await page.goto(BASE + '/settings/account');
  const f = page.locator('form[aria-labelledby=pw-h]');
  await f.locator('input[name=current]').fill('wrong-password'); await f.locator('input[name=password]').fill('newpass12345');
  await f.getByRole('button', { name: 'Change password' }).click();
  await f.getByText('Your current password is wrong.').waitFor();
  await f.locator('input[name=current]').fill('password123'); await f.locator('input[name=password]').fill('newpass12345');
  await f.getByRole('button', { name: 'Change password' }).click();
  await f.getByText('Password changed.').waitFor();
  const p2 = await newPage(); await login(p2, A, 'newpass12345'); await p2.close();
  await admin.auth.admin.updateUserById(A.id, { password: 'password123' });
});

test('unfriend, block, unblock from the UI', async () => {
  await page.context().clearCookies(); await login(page, A);
  await page.goto(`${BASE}/u/${B.username}`);
  await page.getByRole('button', { name: /✓ Friends/ }).click();
  await page.getByRole('button', { name: 'Unfriend' }).click();
  await page.getByRole('button', { name: /Add friend/ }).waitFor();
  assert.equal((await A.c.rpc('friends_of', { p_user: A.id, p_limit: 50 })).data.some((f) => f.id === B.id), false);
  await page.getByRole('button', { name: 'Block', exact: true }).click();
  await page.waitForTimeout(1200);
  await page.goto(BASE + '/settings/privacy');
  await page.getByRole('button', { name: 'Unblock' }).click();
  await page.getByText(/haven.t blocked anyone/).waitFor();
  assertClean(page, 'block');
});

test('delete account: wrong username refused, then really deletes and logs out', async () => {
  const T = await makeUser(uname('acc_t')); const p = await newPage(); await login(p, T);
  await p.goto(BASE + '/settings/account');
  await p.getByRole('button', { name: 'Delete my account…' }).click();
  const d = p.locator('form:has(input[name=confirm])');
  await d.locator('input[name=confirm]').fill('not-me'); await d.locator('input[name=password]').fill('password123');
  await d.getByRole('button', { name: 'Permanently delete' }).click();
  await d.getByText('Type your username exactly to confirm.').waitFor();
  assert.equal((await admin.from('profiles').select('id').eq('id', T.id)).data.length, 1, 'wrong username must not delete');
  await d.locator('input[name=confirm]').fill(T.username); await d.locator('input[name=password]').fill('password123');
  await d.getByRole('button', { name: 'Permanently delete' }).click();
  await p.waitForURL((u) => !u.pathname.startsWith('/settings'), { timeout: 15000 });
  assert.equal((await admin.from('profiles').select('id').eq('id', T.id)).data.length, 0, 'account gone');
  await p.goto(BASE + '/feed'); await p.waitForURL(/\/login/);
});
