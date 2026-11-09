import test from 'node:test'; import assert from 'node:assert/strict';
import { launch, close, apiUserUI, uniq, BASE, shot, assertClean } from './browser.mjs';
import { befriend } from '../helpers.mjs';

test.before(launch); test.after(close);

test('phase 4: blogs (sanitized), bulletins, communities, themes, discovery, polls, gifts, badges, memories', async () => {
  const A = await apiUserUI(uniq('bex'), { display_name: 'Bex B' });
  const B = await apiUserUI(uniq('lo'), { display_name: 'Lo Quiet' });
  await befriend(A, B);
  for (const u of [A, B]) u.page.on('dialog', (d) => d.type() === 'prompt' ? d.accept('Neon Static Remix') : d.accept());

  // blog via the editor
  await A.page.goto(BASE + '/blog/new');
  await A.page.fill('#bt', 'Every screen name I ever had, ranked');
  await A.page.click('.ProseMirror');
  await A.page.keyboard.type('Number four had three x’s and a tilde. ');
  await A.page.click('button[aria-label="Bold"]');
  await A.page.keyboard.type('I was fourteen.');
  await A.page.selectOption('#bv', 'friends');
  await A.page.click('button:has-text("Publish")');
  await A.page.waitForURL(/\/blog\/.+\/every-screen-name/);
  await A.page.locator('.prose-ah strong', { hasText: 'I was fourteen.' }).waitFor();
  await shot(A.page, 'p4-blog');
  await B.page.goto(BASE + '/feed');
  await B.page.getByText('Every screen name I ever had, ranked').first().click();
  await B.page.waitForURL(/every-screen-name/);
  const card = B.page.locator('section[aria-label="Comments"] article');
  await card.locator('button:has-text("Comment")').click();
  await card.locator('input[placeholder="write a comment…"]').fill('number one or riot');
  await card.locator('button:has-text("Reply")').click();
  await card.getByText('number one or riot').waitFor();

  // hostile blog body inserted straight through the API is neutralized on render
  const evil = { type: 'doc', content: [{ type: 'paragraph', content: [
    { type: 'text', text: 'click me', marks: [{ type: 'link', attrs: { href: 'javascript:alert(document.cookie)' } }] },
    { type: 'text', text: '<img src=x onerror=alert(1)>' }] },
    { type: 'image', attrs: { src: 'javascript:alert(2)', alt: 'x' } }] };
  const ins = await A.c.from('blog_posts').insert({ author_id: A.id, title: 'evil', slug: 'evil', body: evil, status: 'published', visibility: 'public' });
  assert.equal(ins.error, null);
  let alerted = false; A.page.on('dialog', () => { alerted = true; });
  await A.page.goto(`${BASE}/blog/${A.username}/evil`);
  const bad = await A.page.locator('.prose-ah').evaluate((el) => ({
    handlers: [...el.querySelectorAll('*')].filter((n) => [...n.attributes].some((a) => /^on/i.test(a.name))).length,
    jsLinks: [...el.querySelectorAll('[href],[src]')].filter((n) => /^\s*javascript:/i.test(n.getAttribute('href') || n.getAttribute('src') || '')).length,
    scripts: el.querySelectorAll('script, iframe, object').length }));
  assert.deepEqual(bad, { handlers: 0, jsLinks: 0, scripts: 0 }, 'no script vectors in rendered blog');
  assert.equal(alerted, false);

  // bulletin -> friend sidebar
  await A.page.goto(BASE + '/bulletins');
  await A.page.fill('#bul', 'repost if you still remember your first screen name');
  await A.page.click('button:has-text("Post to all friends")');
  await A.page.getByText('repost if you still remember').waitFor();
  await B.page.goto(BASE + '/feed');
  await B.page.getByText('repost if you still remember').first().waitFor();

  // community
  await A.page.goto(BASE + '/communities/new');
  const slug = 'label-' + A.username.slice(-6);
  await A.page.fill('input[maxlength="50"]', 'Label Makers ' + A.username.slice(-4));
  await A.page.fill('input[maxlength="30"]', slug);
  await A.page.click('button:has-text("Create community")');
  await A.page.waitForURL(new RegExp(`/communities/${slug}`));
  await B.page.goto(`${BASE}/communities/${slug}`);
  await B.page.click('button:has-text("Join community")');
  await B.page.fill('#cpost', 'i label my labels');
  await B.page.click('button:has-text("Post")');
  await B.page.getByText('i label my labels').waitFor();

  // share a theme from the editor, friend uses it from the gallery
  await A.page.goto(`${BASE}/u/${A.username}?edit=1`);
  await A.page.click('button:has-text("Static")');
  await A.page.click('button:has-text("Save changes")');
  await A.page.getByText('Saved. Your page is live.').waitFor();
  await A.page.click('button:has-text("Share theme")');
  await A.page.getByText('Theme added to the gallery.').waitFor();
  await B.page.goto(BASE + '/themes?sort=new');
  await B.page.locator('li', { hasText: 'Neon Static Remix' }).locator('button:has-text("Use this")').first().click();
  await B.page.waitForURL(/edit=1/);
  const bg = await B.page.locator('[style*="--pg"]').first().evaluate((el) => getComputedStyle(el).backgroundColor);
  assert.equal(bg, 'rgb(14, 14, 14)', 'theme from gallery applied');

  // poll on profile; friend votes; results only after voting
  await A.page.goto(`${BASE}/u/${A.username}`);
  await A.page.fill('input[aria-label="Question"]', 'Best profile song energy?');
  await A.page.fill('input[aria-label="Answer 1"]', 'Emo anthem');
  await A.page.fill('input[aria-label="Answer 2"]', 'Indie deep cut');
  await A.page.click('button:has-text("Post poll")');
  await A.page.getByRole('heading', { name: 'Best profile song energy?' }).waitFor();
  await B.page.goto(`${BASE}/u/${A.username}`);
  await B.page.getByText('Vote to see results').waitFor();
  await B.page.click('button:has-text("Emo anthem")');
  await B.page.getByText('100%').waitFor();

  // gift
  await B.page.click('button:has-text("Send Bex a gift")');
  await B.page.click('button[aria-label="Burned CD"]');
  await B.page.fill('input[aria-label="Gift note"]', 'for the road');
  await B.page.click('button:has-text("Send gift")');
  await B.page.getByText('“for the road”').waitFor();
  await A.page.goto(BASE + '/notifications');
  await A.page.getByText('sent you a gift').waitFor();
  await A.page.getByText(/earned the Blogger badge/).waitFor();

  // discovery
  await A.c.from('profiles').update({ discoverable: true }).eq('id', A.id);
  await A.c.from('profile_details').update({ interests: ['label makers'] }).eq('id', A.id);
  await B.page.goto(BASE + '/discover?interest=label+makers');
  await B.page.getByText('Bex B').first().waitFor();

  // badges on profile + memories
  await B.page.goto(`${BASE}/u/${A.username}`);
  await B.page.getByText('BLOGGER').waitFor();
  await A.page.goto(BASE + '/memories');
  await A.page.getByText('Your past looks').waitFor();
  await A.page.getByRole('button', { name: 'Restore' }).first().waitFor();
  await shot(B.page, 'p4-profile-full');
  for (const [p, l] of [[A.page, 'A'], [B.page, 'B']]) assertClean(p, l);
});
