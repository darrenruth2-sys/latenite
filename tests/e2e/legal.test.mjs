// Legal protections, end to end: public legal pages, the takedown form (no account needed), the under-18 lockout,
// the paused-state signup, and the moderator side of an urgent takedown.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { launch, close, BASE, newPage, assertClean } from './browser.mjs';
import { admin, makeUser, uname } from '../helpers.mjs';

before(launch);
after(close);

test('legal pages load for anyone and link to each other', async () => {
  const p = await newPage();
  for (const [path, h] of [['/terms', 'Terms of Service'], ['/privacy', 'Privacy Policy'], ['/copyright', 'Copyright Policy'], ['/rules', 'Community rules'], ['/report-content', 'Report content']]) {
    const r = await p.goto(BASE + path); assert.equal(r.status(), 200, path);
    await p.getByRole('heading', { level: 1, name: h }).waitFor();
  }
  await p.goto(BASE + '/terms'); await p.getByText('No class actions.', { exact: true }).waitFor();
  await p.getByRole('link', { name: 'Copyright Policy' }).first().click(); await p.waitForURL(/\/copyright/);
  await p.getByText('Repeat infringers').first().waitFor();
  assertClean(p, 'legal pages');
});

test('takedown form works without an account, with the right checks per type', async () => {
  const p = await newPage();
  await p.goto(BASE + '/report-content?type=intimate_image');
  await p.fill('textarea[name=urls]', 'https://signedon.social/u/someone');
  await p.fill('textarea[name=description]', 'posted without my consent');
  await p.fill('input[name=name]', 'Jane Doe'); await p.fill('input[name=email]', 'jane@example.test');
  await p.check('input[name=is_subject]'); await p.check('input[name=sworn]'); await p.fill('input[name=signature]', 'Jane Doe');
  await p.click('button:has-text("Send request")');
  await p.getByText('REQUEST RECEIVED').waitFor();
  await p.getByRole('status').getByText(/within 48 hours/).waitFor();
  // child safety shows 911 / NCMEC guidance
  await p.goto(BASE + '/report-content?type=child_safety');
  await p.getByText('If a child is in immediate danger, call 911.').waitFor();
  assertClean(p, 'takedown form');
});

test('moderator sees the urgent badge and the 48h clock, and can resolve it', async () => {
  const mod = await makeUser(uname('emod')); await admin.from('moderators').insert({ user_id: mod.id });
  const p = await newPage();
  await p.goto(BASE + '/login'); await p.fill('input[name=email]', mod.email); await p.fill('input[name=password]', 'password123');
  await p.click('button[type=submit]'); await p.waitForURL(/\/feed/);
  await p.getByRole('link', { name: /urgent moderation item/ }).waitFor();
  await p.goto(BASE + '/mod');
  await p.getByText(/h left of the 48h legal deadline/).first().waitFor();
  p.on('dialog', (d) => d.accept('removed the photo'));
  await p.getByRole('button', { name: 'Content removed' }).first().click();
  await p.waitForTimeout(1500);
});

test('under-18 birthday locks signup on that browser; paused states can’t sign up', async () => {
  const p = await newPage();
  await p.goto(BASE + '/signup');
  const kid = new Date(); kid.setFullYear(kid.getFullYear() - 15);
  await p.fill('input[name=username]', uname('kid')); await p.fill('input[name=display_name]', 'Kid');
  await p.fill('input[name=email]', `kid${Date.now()}@example.test`); await p.fill('input[name=password]', 'password123');
  await p.fill('input[name=birthdate]', kid.toISOString().slice(0, 10)); await p.check('input[name=agree]');
  await p.click('button:has-text("Create my page")');
  await p.getByText('You need to be 18 or older to join SignedOn.').first().waitFor();
  await p.goto(BASE + '/signup');
  await p.getByRole('heading', { name: 'SignedOn is for adults' }).waitFor();
  assert.equal(await p.locator('input[name=birthdate]').count(), 0, 'no form to retry with a different birthday');

  const ms = await newPage({ extraHTTPHeaders: { 'x-vercel-ip-country': 'US', 'x-vercel-ip-country-region': 'MS' } });
  await ms.goto(BASE + '/signup');
  await ms.getByRole('heading', { name: 'Not available in your state yet' }).waitFor();
  await ms.getByText(/Mississippi/).waitFor();
  const oh = await newPage({ extraHTTPHeaders: { 'x-vercel-ip-country': 'US', 'x-vercel-ip-country-region': 'OH' } });
  await oh.goto(BASE + '/signup'); await oh.getByRole('heading', { name: 'Get your page' }).waitFor();
});
