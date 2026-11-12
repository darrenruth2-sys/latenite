// Mobile sweep: every page at phone widths with real content — no sideways scrolling, nothing tiny to tap, no crashes.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { launch, close, BASE, shot, assertClean, newPage } from './browser.mjs';
import { makeUser, befriend, uname, admin } from '../helpers.mjs';

let A, B, slug, postId, blogSlug, conv;
before(async () => {
  await launch();
  A = await makeUser(uname('mob_a'), { display_name: 'Jules With A Really Long Display Name' });
  B = await makeUser(uname('mob_b'));
  await befriend(A, B);
  await A.c.from('profile_details').update({ bio: 'x'.repeat(60) + ' https://example.com/a-very-long-link-that-should-wrap-nicely-on-phones-without-breaking-layout', headline: 'hello from a phone' }).eq('id', A.id);
  const p = await A.c.from('posts').insert({ author_id: A.id, body: 'Superlongwordwithoutanyspacesthatcouldbreakthelayoutonsmallphonescreens '.repeat(2), visibility: 'friends' }).select('id').single();
  postId = p.data.id;
  await B.c.from('comments').insert({ post_id: postId, author_id: B.id, body: 'first!' });
  await B.c.from('guestbook_entries').insert({ profile_id: A.id, author_id: B.id, body: 'thanks for the add ' + 'ha'.repeat(40) });
  await A.c.rpc('set_top_friends', { p_ids: [B.id] });
  blogSlug = 'my-first-entry';
  await A.c.from('blog_posts').insert({ author_id: A.id, title: 'My first entry with a pretty long title for a blog', slug: blogSlug, status: 'published', visibility: 'friends',
    body: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Dear diary. ' + 'words '.repeat(80) }] }] } });
  await A.c.from('polls').insert({ owner_id: A.id, question: 'Best away message era?', options: ['2004', '2006', '2008'] });
  await A.c.from('bulletins').insert({ author_id: A.id, body: 'bulletin: repost if you miss top 8' });
  slug = uname('club').replace(/_/g, '-');
  await A.c.rpc('create_community', { p_slug: slug, p_name: 'Emo Kids Unite', p_description: 'for the scene', p_public: true });
  const d = await A.c.rpc('start_dm', { p_other: B.id }); conv = d.data;
  await B.c.from('messages').insert({ conversation_id: conv, sender_id: B.id, kind: 'text', body: 'u up? ' + 'zzz'.repeat(30) });
  await admin.from('moderators').insert({ user_id: A.id });
});
after(close);

const PAGES = () => [
  '/feed', '/feed?tab=public', `/u/${A.username}`, `/u/${B.username}`, '/friends', '/notifications', '/messenger', `/messenger?c=${conv}`,
  `/post/${postId}`, `/blog/${A.username}`, `/blog/${A.username}/${blogSlug}`, '/blog/new', '/bulletins', '/communities', `/communities/${slug}`, '/communities/new',
  '/themes', '/discover', '/memories', '/settings/profile', '/settings/privacy', '/settings/account', '/mod', '/rules', '/privacy', '/terms',
];

for (const width of [375, 320]) {
  test(`mobile ${width}px: all pages fit and are usable`, async () => {
    const page = await newPage({ viewport: { width, height: 760 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
    await page.goto(BASE + '/login');
    await page.fill('input[name=email]', A.email); await page.fill('input[name=password]', 'password123');
    await page.click('button[type=submit]'); await page.waitForURL(/\/feed/);
    const issues = [];
    for (const p of PAGES()) {
      const r = await page.goto(BASE + p); await page.waitForLoadState('networkidle').catch(() => {});
      if (!r || r.status() >= 400) { issues.push(`${p}: HTTP ${r?.status()}`); continue; }
      const res = await page.evaluate((w) => {
        const out = { overflow: document.documentElement.scrollWidth - w, wide: [], tiny: [] };
        for (const el of document.querySelectorAll('body *')) {
          const s = getComputedStyle(el); if (s.position === 'fixed' || s.visibility === 'hidden' || s.display === 'none') continue;
          const b = el.getBoundingClientRect(); if (!b.width) continue;
          if (b.right > w + 1 && !el.closest('[class*=overflow-x],[class*=overflow-hidden],[aria-hidden=true],.sr-only')) out.wide.push(`${el.tagName.toLowerCase()}.${String(el.className).slice(0, 50)} r=${Math.round(b.right)}`);
          const inline = el.matches('a') && el.parentElement && /^(P|LI|SPAN|DD|LABEL|SMALL|EM|STRONG)$/.test(el.parentElement.tagName) && (el.parentElement.textContent || '').trim().length > (el.textContent || '').trim().length + 3;
          const lab = el.closest('label'); const labOk = lab && lab.getBoundingClientRect().height >= 24;
          const skip = /sr-only/.test(String(el.className)) || el.closest('.sr-only,[aria-hidden=true]');
          if (el.matches('a[href],button,input:not([type=hidden]),select,textarea,[role=button]') && (b.height < 24 || b.width < 24) && !inline && !labOk && !skip)
            out.tiny.push(`${el.tagName.toLowerCase()} "${(el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 24)}" ${Math.round(b.width)}x${Math.round(b.height)}`);
        }
        out.wide = out.wide.slice(0, 4); out.tiny = [...new Set(out.tiny)].slice(0, 6); return out;
      }, width);
      if (res.overflow > 1) issues.push(`${p}: page scrolls sideways by ${res.overflow}px — ${res.wide.join(' ; ')}`);
      if (res.tiny.length) issues.push(`${p}: small tap targets — ${res.tiny.join(' ; ')}`);
      await shot(page, `mobile-${width}${p.replace(/[/?=&]+/g, '_')}`);
    }
    assertClean(page, `mobile ${width}`);
    assert.deepEqual(issues, [], '\n' + issues.join('\n'));
  });
}
