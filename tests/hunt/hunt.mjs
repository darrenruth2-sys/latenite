// Bug hunter: seeds a realistic little world, then crawls every page, clicks every button and link,
// mashes random things ("monkey"), and reports anything that breaks.
// Usage: node tests/hunt/hunt.mjs [seed] [monkeySteps]
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { launch, close, BASE, newPage } from '../e2e/browser.mjs';
import { admin, makeUser, befriend, uname } from '../helpers.mjs';

const SEED = Number(process.argv[2] || 1);
const MONKEY = Number(process.argv[3] || 250);
const OUT = '/tmp/claude-0/-home-claude/467e0814-0f6f-5ae9-a323-9fc71cc6ac47/scratchpad/hunt';
fs.mkdirSync(OUT, { recursive: true });
let rnd = SEED * 7919;
const rand = () => ((rnd = (rnd * 16807) % 2147483647) / 2147483647);
const pick = (a) => a[Math.floor(rand() * a.length)];
const sql = (q) => execFileSync('psql', ['-h', '127.0.0.1', '-p', '54322', '-U', 'postgres', '-tAc', q], { encoding: 'utf8' }).trim();

const bugs = new Map();
function bug(kind, where, detail) {
  const key = `${kind}|${where.replace(/[0-9a-f-]{36}/g, ':id').replace(/\?.*$/, '')}|${String(detail).replace(/[0-9a-f-]{36}/g, ':id').slice(0, 160)}`;
  if (!bugs.has(key)) { bugs.set(key, { kind, where, detail: String(detail).slice(0, 400), n: 0 }); console.log('BUG', kind, where, String(detail).slice(0, 200)); }
  bugs.get(key).n++;
}
function drain(page, where) { for (const p of page.problems.splice(0)) bug('error', where, p); }

const JUNK = ['', ' ', 'a', '😀🔥💀'.repeat(20), '<script>alert(1)</script>', "'; drop table posts; --", 'x'.repeat(5000), 'https://evil.example/x', '../../etc/passwd', '-1', '99999999999999999999', 'null', '%00', 'Ω≈ç√∫'];
const DANGEROUS = /delete (my )?account|log out|sign out|deactivate/i;

// ---------- world ----------
async function seed() {
  const [A, B, C, D] = await Promise.all(['hunt_a', 'hunt_b', 'hunt_c', 'hunt_d'].map((p) => makeUser(uname(p))));
  await befriend(A, B); await befriend(A, C); await befriend(B, C);
  await D.c.rpc('send_friend_request', { p_target: A.id }); // pending request for A
  await admin.from('moderators').insert({ user_id: A.id });
  const pic = `http://localhost:54321/storage/v1/object/public/media/${A.id}/pic.png`;
  await A.c.from('profile_details').update({ headline: 'hello world', bio: 'I build things.', banner_url: pic,
    theme: { preset: 'midnight', bg_image: pic, bg_size: 'cover' },
    custom_css: '.so-name{color:#FF4FA3}' }).eq('id', A.id);
  await admin.rpc('set_profile_song', { p_user: A.id, p_music: { provider: 'youtube', url: 'https://www.youtube.com/watch?v=aaaaaaaaaaa', title: 'Song' } });
  const post = (await A.c.from('posts').insert({ author_id: A.id, body: 'first post #hello', visibility: 'friends' }).select().single()).data;
  await B.c.from('posts').insert({ author_id: B.id, body: 'B says hi', visibility: 'public' });
  await B.c.from('comments').insert({ post_id: post.id, author_id: B.id, body: 'nice' });
  await B.c.from('reactions').insert({ post_id: post.id, user_id: B.id, kind: 'like' });
  await B.c.from('guestbook_entries').insert({ profile_id: A.id, author_id: B.id, body: 'signing ur guestbook', sticker: 'glitter' });
  const blog = (await A.c.from('blog_posts').insert({ author_id: A.id, title: 'My first blog', slug: 'my-first-blog', status: 'published', visibility: 'public',
    body: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'hello blog' }] }] } }).select().single()).data;
  await A.c.from('bulletins').insert({ author_id: A.id, body: 'bulletin: party at 9' });
  await A.c.from('polls').insert({ owner_id: A.id, question: 'Best era?', options: ['2005', '2006', '2007'] });
  const slug = 'hunt' + Math.random().toString(36).slice(2, 7);
  const comm = (await A.c.rpc('create_community', { p_slug: slug, p_name: 'Hunt Club', p_description: 'testing', p_public: true })).data;
  await A.c.from('community_posts').insert({ community_id: comm, author_id: A.id, body: 'welcome to the club' });
  const dm = (await A.c.rpc('start_dm', { p_other: B.id })).data;
  for (let i = 0; i < 5; i++) await B.c.from('messages').insert({ conversation_id: dm, sender_id: B.id, kind: 'text', body: `yo ${i}` });
  const grp = (await A.c.rpc('create_group', { p_title: 'Crew', p_members: [B.id, C.id] })).data;
  await B.c.from('gifts').insert({ sender_id: B.id, recipient_id: A.id, gift_key: 'rose', message: 'for u', is_public: true }).then(() => {}, () => {});
  await B.c.from('reports').insert({ reporter_id: B.id, target_type: 'post', target_id: post.id, target_owner: A.id, reason: 'spam' });
  return { A, B, C, D, post, blog, slug, comm, dm, grp };
}

async function login(page, u) {
  await page.goto(BASE + '/login');
  await page.fill('input[name=email]', u.email); await page.fill('input[name=password]', 'password123');
  await page.click('button[type=submit]'); await page.waitForURL(/\/feed/, { timeout: 15000 });
}

const settle = (page) => page.waitForLoadState('networkidle', { timeout: 6000 }).catch(() => {});

async function checkPage(page, path) {
  const where = path;
  let res;
  try { res = await page.goto(BASE + path, { timeout: 20000 }); } catch (e) { bug('load-fail', where, e.message.split('\n')[0]); return false; }
  await settle(page);
  const st = res?.status() ?? 0;
  if (st >= 500) bug('http-5xx', where, st);
  // pages stream, so "not found" can arrive as a 200 with a not-found screen: check the content too
  const nf = st === 404 || await page.locator('text=/PAGE NOT FOUND|Nobody lives here|page doesn.t exist/i').count().catch(() => 0) > 0;
  if (nf && !/does-not-exist|\/post\/0000/.test(path) && !(page.__notOwner && /^\/(mod|blog\/edit)/.test(path))) bug('404', where, 'page not found');
  drain(page, where);
  // horizontal overflow
  const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth).catch(() => 0);
  if (over > 2) bug('overflow', where, `page scrolls sideways by ${over}px at ${page.viewportSize().width}px wide`);
  // logo goes home
  const logo = page.locator('a[aria-label="SignedOn home"]').first();
  if (await logo.count()) { const href = await logo.getAttribute('href'); if (href !== '/' && href !== '/feed') bug('logo', where, `logo links to ${href}`); }
  // images that failed (ignore placeholder seed pic)
  const broken = await page.evaluate(() => [...document.images].filter((i) => i.complete && i.naturalWidth === 0 && !i.src.includes('/pic.png') && !/ytimg|scdn|spotify/.test(i.src)).map((i) => i.src)).catch(() => []);
  for (const b of broken) bug('broken-image', where, b);
  // buttons with no accessible name
  const unnamed = await page.evaluate(() => [...document.querySelectorAll('button, a[href]')].filter((e) => e.offsetParent && !(e.textContent.trim() || e.getAttribute('aria-label') || e.getAttribute('title') || e.querySelector('img[alt]:not([alt=""])'))).map((e) => e.outerHTML.slice(0, 120))).catch(() => []);
  for (const u of unnamed) bug('a11y-unnamed', where, u);
  return true;
}

async function linksOn(page) {
  return page.evaluate(() => [...new Set([...document.querySelectorAll('a[href]')].map((a) => a.getAttribute('href')))]
    .filter((h) => h && h.startsWith('/') && !h.startsWith('//') && !h.startsWith('/api/') && !h.includes('/auth/') && !h.startsWith('/preview'))).catch(() => []);
}

// Click every visible button on the page (fresh load each time so one click doesn't hide the next).
async function clickAll(page, path) {
  if (!(await checkPage(page, path))) return;
  const labels = await page.evaluate(() => [...document.querySelectorAll('button, [role=menuitem], summary, input[type=checkbox], select')]
    .filter((b) => b.offsetParent && !b.disabled).map((b, i) => ({ i, text: (b.innerText || b.getAttribute('aria-label') || b.tagName).trim().slice(0, 60) })));
  for (const { i, text } of labels) {
    if (DANGEROUS.test(text)) continue;
    await page.goto(BASE + path).catch(() => {}); await settle(page); page.problems.splice(0);
    const el = page.locator('button, [role=menuitem], summary, input[type=checkbox], select').nth(i);
    try {
      if (!(await el.isVisible())) continue;
      const tag = await el.evaluate((e) => e.tagName);
      if (tag === 'SELECT') { const opts = await el.locator('option').allTextContents(); if (opts.length) await el.selectOption({ index: Math.floor(rand() * opts.length) }); }
      else await el.click({ timeout: 3000 });
      await page.waitForTimeout(700); await settle(page);
      // a "busy" button that never comes back
      const stuck = await page.locator('button:has-text("Saving…"), button:has-text("Sending…"), button:has-text("Loading…"), button[aria-busy=true]').count();
      if (stuck) { await page.waitForTimeout(6000); if (await page.locator('button:has-text("Saving…"), button:has-text("Sending…"), button[aria-busy=true]').count()) bug('stuck', path, `after clicking "${text}" something stayed busy`); }
      drain(page, `${path} → click "${text}"`);
      if (page.url().startsWith(BASE)) { const s = await page.evaluate(() => document.title); if (/500|Internal Server Error/.test(s)) bug('crash', path, `clicking "${text}" led to an error page`); }
    } catch (e) { if (!/Timeout|not visible|detached|outside of the viewport|intercepts pointer/.test(e.message)) bug('click-fail', path, `"${text}": ${e.message.split('\n')[0]}`); }
  }
}

async function monkey(page, startPaths, steps) {
  let path = pick(startPaths); await page.goto(BASE + path).catch(() => {});
  for (let s = 0; s < steps; s++) {
    const here = page.url().replace(BASE, '');
    if (!page.url().startsWith(BASE)) { await page.goto(BASE + pick(startPaths)).catch(() => {}); continue; }
    try {
      const r = rand();
      if (r < 0.08) { await page.goBack({ timeout: 5000 }).catch(() => {}); }
      else if (r < 0.14) { await page.goto(BASE + pick(startPaths), { timeout: 15000 }); }
      else if (r < 0.45) {
        const inputs = page.locator('input:visible:not([type=file]):not([type=checkbox]):not([type=radio]):not([type=range]):not([type=color]):not([type=hidden]), textarea:visible');
        const n = await inputs.count();
        if (n) { const el = inputs.nth(Math.floor(rand() * n)); const type = await el.getAttribute('type'); if (type !== 'date') await el.fill(pick(JUNK), { timeout: 2000 }); if (rand() < 0.4) await el.press('Enter', { timeout: 2000 }); }
      } else {
        const els = page.locator('button:visible, a[href]:visible, summary:visible, [role=menuitem]:visible, input[type=checkbox]:visible');
        const n = await els.count(); if (!n) continue;
        const el = els.nth(Math.floor(rand() * n));
        const text = ((await el.innerText().catch(() => '')) || (await el.getAttribute('aria-label').catch(() => '')) || '').trim();
        const href = await el.getAttribute('href').catch(() => null);
        if (DANGEROUS.test(text) || (href && (/^https?:/.test(href) || href.startsWith('mailto:') || href.includes('/preview')))) continue;
        await el.click({ timeout: 2500 });
      }
      await page.waitForTimeout(250 + rand() * 500);
      drain(page, `monkey @ ${here}`);
      const title = await page.title().catch(() => '');
      if (/500|Internal Server Error/.test(title)) { bug('crash', here, 'monkey reached an error page: ' + page.url()); await page.goto(BASE + pick(startPaths)).catch(() => {}); }
    } catch (e) { if (!/Timeout|not visible|detached|outside of the viewport|intercepts pointer|Target page|net::ERR_ABORTED|navigation/.test(e.message)) bug('monkey-fail', here, e.message.split('\n')[0]); }
  }
}

// ---------- run ----------
await launch();
const w = await seed();
const userPaths = ['/', '/feed', '/friends', '/discover', '/messenger', `/messenger?c=${w.dm}`, `/messenger?c=${w.grp}`, '/notifications', '/bulletins', '/communities', `/communities/${w.slug}`,
  '/communities/new', '/blog/new', `/blog/${w.A.username}`, `/blog/${w.A.username}/my-first-blog`, `/blog/edit/${w.blog.id}`, `/post/${w.post.id}`, '/memories', '/themes', '/mod',
  '/settings', '/settings/profile', '/settings/privacy', '/settings/account', `/u/${w.A.username}`, `/u/${w.A.username}?edit=1`, `/u/${w.B.username}`, `/u/${w.D.username}`,
  '/privacy', '/rules', '/terms', '/soon', '/u/does-not-exist-zz', '/post/00000000-0000-0000-0000-000000000000'];

// 1) desktop crawl + follow every internal link found
const page = await newPage({ viewport: { width: 1360, height: 900 } });
await login(page, w.A);
const seen = new Set(); const queue = [...userPaths];
while (queue.length && seen.size < 160) {
  const p = queue.shift(); const key = p.replace(/[0-9a-f-]{36}/g, ':id');
  if (seen.has(p)) continue; seen.add(p);
  if (await checkPage(page, p)) for (const l of await linksOn(page)) if (!seen.has(l) && ![...seen].some((s) => s.replace(/[0-9a-f-]{36}/g, ':id') === l.replace(/[0-9a-f-]{36}/g, ':id') && key)) queue.push(l);
}
console.log('crawled', seen.size, 'pages');
// logo click actually goes home
await page.goto(BASE + '/settings'); await page.locator('a[aria-label="SignedOn home"]').first().click(); await page.waitForTimeout(800);
if (!/\/(feed)?$/.test(new URL(page.url()).pathname)) bug('logo', '/settings', 'clicking the logo went to ' + page.url());

// 2) click every button on every main page
for (const p of userPaths.filter((x) => !x.includes('does-not-exist') && !x.startsWith('/post/0000'))) { await clickAll(page, p); }
console.log('clicked buttons');

// 3) monkey, desktop then phone (fresh browser per phase so one crash can't end the run)
async function phase(name, fn) {
  try { await close(); } catch { /* already closed */ }
  await launch();
  try { await fn(); } catch (e) { bug('hunter', name, 'phase stopped early: ' + e.message.split('\n')[0]); }
  console.log('phase done:', name);
}
await phase('monkey-desktop', async () => { const p = await newPage({ viewport: { width: 1360, height: 900 } }); await login(p, w.A); await monkey(p, userPaths, MONKEY); });
await phase('phone', async () => {
  const phone = await newPage({ viewport: { width: 375, height: 740 }, isMobile: true, hasTouch: true }); phone.__notOwner = true;
  await login(phone, w.B);
  for (const p of userPaths) await checkPage(phone, p);
  await monkey(phone, userPaths, Math.round(MONKEY / 2));
});
await phase('logged-out', async () => {

const anonPage = await newPage();
for (const p of ['/', '/login', '/signup', '/forgot', '/privacy', '/rules', '/terms', '/soon', `/u/${w.A.username}`, `/blog/${w.A.username}/my-first-blog`]) await checkPage(anonPage, p);
for (const p of ['/feed', '/messenger', '/settings', '/friends', '/notifications', '/mod']) {
  await anonPage.goto(BASE + p); await settle(anonPage);
  if (!anonPage.url().includes('/login')) bug('auth', p, 'logged-out visitor was not sent to log in: ' + anonPage.url());
}
await anonPage.goto(BASE + '/login'); await anonPage.locator('a[aria-label="SignedOn home"]').first().click().catch(() => {}); await anonPage.waitForTimeout(600);
if (new URL(anonPage.url()).pathname !== '/') bug('logo', '/login', 'logo (logged out) went to ' + anonPage.url());
drain(anonPage, 'logged out');
});
await phase('security+logout', async () => {

const bp = await newPage(); await login(bp, w.B); const r = await bp.goto(BASE + '/mod');
if ((await bp.content()).includes('Moderation queue') && r.status() === 200) bug('security', '/mod', 'non-moderator can see the moderation queue');

const T = await makeUser(uname('hunt_t')); const tp = await newPage(); await login(tp, T);
await tp.getByRole('button', { name: 'Account menu' }).click(); await tp.getByRole('menuitem', { name: 'Log out' }).click(); await tp.waitForTimeout(1500);
await tp.goto(BASE + '/feed'); if (!tp.url().includes('/login')) bug('logout', 'menu', 'still logged in after Log out');
drain(tp, 'logout');
});
await close();
const list = [...bugs.values()].sort((a, b) => a.kind.localeCompare(b.kind));
fs.writeFileSync(`${OUT}/bugs-seed${SEED}.json`, JSON.stringify(list, null, 2));
console.log(`\nDONE seed ${SEED}: ${list.length} distinct issues`);
for (const b of list) console.log(`- [${b.kind}] ${b.where} :: ${b.detail.slice(0, 220)} (x${b.n})`);
