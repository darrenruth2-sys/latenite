import test from 'node:test'; import assert from 'node:assert/strict';
import fs from 'node:fs'; import { createRequire } from 'node:module';
import { launch, close, apiUserUI, uniq, BASE, shot, newPage } from './browser.mjs';
import { admin, befriend } from '../helpers.mjs';
const AXE = fs.readFileSync(createRequire(import.meta.url).resolve('axe-core/axe.min.js'), 'utf8');

test.before(launch); test.after(close);

let A, B;
test('seed', async () => {
  A = await apiUserUI(uniq('ally'), { display_name: 'Ally Access' });
  B = await apiUserUI(uniq('monk'), { display_name: 'Monkey Tester' });
  await befriend(A, B);
  await A.c.from('posts').insert({ author_id: A.id, body: 'hello from ally', visibility: 'public' });
  await B.c.from('guestbook_entries').insert({ profile_id: A.id, author_id: B.id, body: 'hiii', sticker: 'star' });
  await A.c.from('blog_posts').insert({ author_id: A.id, title: 'A post', slug: 'a-post', body: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'words' }] }] }, status: 'published', visibility: 'public' });
});

test('accessibility: no serious/critical axe violations on key pages', async () => {
  const pages = ['/feed', `/u/${A.username}`, '/messenger', '/discover', '/themes', '/communities', '/settings/profile', '/settings/privacy', `/blog/${A.username}/a-post`, '/notifications', '/friends', '/bulletins', '/memories'];
  const anonPages = ['/', '/login', '/signup', '/forgot'];
  const problems = [];
  const scan = async (page, path) => {
    await page.goto(BASE + path); await page.waitForTimeout(400);
    await page.addScriptTag({ content: AXE });
    const res = await page.evaluate(async () => (await window.axe.run(document, { resultTypes: ['violations'] })).violations
      .filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => `${v.id} (${v.nodes.length}): ${v.nodes[0].target.join(' ')} — ${v.nodes[0].failureSummary?.split('\n')[1] || ''}`));
    for (const r of res) problems.push(`${path}: ${r}`);
  };
  for (const p of pages) await scan(A.page, p);
  const anon = await newPage();
  for (const p of anonPages) await scan(anon, p);
  fs.writeFileSync('/tmp/claude-0/-home-claude/467e0814-0f6f-5ae9-a323-9fc71cc6ac47/scratchpad/axe.txt', problems.join('\n'));
  assert.deepEqual(problems, []);
});

test('monkey: random clicks + junk typing on every page, no crashes or 500s', async () => {
  const junk = ['', ' ', 'a'.repeat(5000), '<script>alert(1)</script>', '"; drop table posts; --', '😀🔥💀'.repeat(50), '\u0000‮ evil', '../../etc/passwd', 'https://evil.example/x.png', '-1', '9'.repeat(40)];
  const paths = ['/feed', `/u/${A.username}`, `/u/${A.username}?edit=1`, '/messenger', '/discover?q=a', '/themes', '/communities', '/communities/new', '/bulletins', '/settings/profile', '/settings/privacy', '/blog/new', '/friends', '/notifications', '/memories', `/u/${B.username}`];
  const page = await newPage();
  await page.goto(BASE + '/login');
  await page.fill('input[name=email]', B.email); await page.fill('input[name=password]', 'password123'); await page.click('button[type=submit]');
  await page.waitForURL(/feed/);
  page.on('dialog', (d) => (Math.random() < 0.5 ? d.dismiss() : d.type() === 'prompt' ? d.accept('monkey') : d.accept()).catch(() => {}));
  let actions = 0;
  const rnd = (n) => Math.floor(Math.random() * n);
  for (const path of paths) {
    await page.goto(BASE + path).catch(() => {});
    for (let i = 0; i < 25; i++) {
      try {
        if (!page.url().startsWith(BASE)) await page.goto(BASE + path);
        if (/\/login|\/$/.test(new URL(page.url()).pathname) && !page.url().includes('/u/')) {
          // the monkey logged itself out; log back in
          await page.goto(BASE + '/login'); await page.fill('input[name=email]', B.email); await page.fill('input[name=password]', 'password123'); await page.click('button[type=submit]'); await page.waitForURL(/feed/);
          await page.goto(BASE + path);
        }
        const targets = await page.$$('main button:not([disabled]), main a[href^="/"], main input:not([type=file]):not([type=hidden]), main textarea, main select, header button');
        if (!targets.length) break;
        const el = targets[rnd(targets.length)];
        if (!(await el.isVisible())) continue;
        const tag = await el.evaluate((e) => e.tagName + ':' + (e.getAttribute('type') || '') + ':' + (e.textContent || '').trim().slice(0, 30));
        if (/Delete my account|Permanently delete|Log out/i.test(tag)) continue;
        if (tag.startsWith('INPUT') && !/checkbox|radio|color|date|submit/.test(tag) || tag.startsWith('TEXTAREA')) { await el.fill(junk[rnd(junk.length)], { timeout: 2000 }); if (Math.random() < 0.4) await el.press('Enter'); }
        else if (tag.startsWith('SELECT')) { const opts = await el.$$eval('option', (o) => o.map((x) => x.value)); if (opts.length) await el.selectOption(opts[rnd(opts.length)]); }
        else await el.click({ timeout: 2000 });
        actions++;
        await page.waitForTimeout(150);
      } catch { /* element went away mid-click: fine */ }
    }
  }
  console.log(`monkey performed ${actions} actions`);
  await shot(page, 'p5-monkey-last');
  fs.writeFileSync('/tmp/claude-0/-home-claude/467e0814-0f6f-5ae9-a323-9fc71cc6ac47/scratchpad/monkey.txt', page.problems.join('\n----\n'));
  const real = page.problems.filter((p) => !/Minified React error #418|hydrat/i.test(p));
  assert.deepEqual(real, [], 'problems: ' + real.join(' | '));
  assert.ok(actions > 150, 'monkey actually did things');
});

test('moderator dashboard resolves a report end to end', async () => {
  const M = await apiUserUI(uniq('modz'), { display_name: 'Mod Squad' });
  await admin.from('moderators').insert({ user_id: M.id });
  const p = await B.c.from('posts').insert({ author_id: B.id, body: 'report me please', visibility: 'public' }).select().single();
  await A.c.from('reports').insert({ reporter_id: A.id, target_type: 'post', target_id: p.data.id, target_owner: B.id, reason: 'spam' });
  await M.page.goto(BASE + '/mod');
  const item = M.page.locator('li', { hasText: 'report me please' });
  await item.locator('button:has-text("Remove content")').click();
  await M.page.getByText('report me please').waitFor({ state: 'detached' });
  assert.equal((await A.c.from('posts').select('id').eq('id', p.data.id)).data.length, 0);
  const notMod = await A.page.goto(BASE + '/mod');
  assert.equal(notMod.status(), 404, 'non-mods get a 404');
});
