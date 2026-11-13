// v10.2: beta invite codes (database-enforced), the pre-launch gate for testers, SignedOn HQ, and the help bot.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { launch, close, BASE, newPage, apiUserUI, assertClean, waitMail, linkIn } from './browser.mjs';
import { admin, anon, makeUser, uname } from '../helpers.mjs';

const sql = (q) => execFileSync('psql', ['-h', '127.0.0.1', '-p', '54322', '-U', 'postgres', '-tAc', q], { encoding: 'utf8' }).trim();
let gate; // a second app server running in pre-launch mode
before(async () => {
  await launch();
  gate = spawn('npx', ['next', 'start', '-p', '3105'], { cwd: process.cwd(), env: { ...process.env, LAUNCH_MODE: 'soon', PREVIEW_KEY: 'test-preview-key-123' }, stdio: 'ignore' });
  for (let i = 0; i < 60; i++) { try { if ((await fetch('http://localhost:3105/soon')).ok) break; } catch {} await new Promise((r) => setTimeout(r, 500)); }
});
after(async () => { sql('update app.settings set invite_only = false'); gate?.kill(); await close(); });

test('invite codes: made by a moderator, required by the database, used once, tracked', async () => {
  const mod = await makeUser(uname('imod')); await admin.from('moderators').insert({ user_id: mod.id });
  const { data: codes, error } = await mod.c.rpc('mod_create_invites', { p_count: 3, p_batch: 'test', p_max_uses: 1, p_expires_days: null, p_note: null });
  assert.equal(error, null); assert.equal(codes.length, 3); assert.match(codes[0], /^SO-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
  const member = await makeUser(uname('imem'));
  assert.ok((await member.c.rpc('mod_create_invites', { p_count: 1 })).error, 'members can’t make codes');
  assert.equal((await mod.c.rpc('mod_set_invite_only', { p_on: true })).error, null);

  // the signup API itself refuses without a code, or with a made-up one
  const a = anon();
  const r1 = await a.auth.signUp({ email: `nocode${Date.now()}@test.local`, password: 'password123', options: { data: { username: uname('nocode'), birthdate: '1995-01-01' } } });
  assert.ok(r1.error, 'no code, no account');
  const r2 = await a.auth.signUp({ email: `fake${Date.now()}@test.local`, password: 'password123', options: { data: { username: uname('fake'), birthdate: '1995-01-01', invite_code: 'SO-AAAA-AAAA' } } });
  assert.ok(r2.error, 'made-up code, no account');

  // the real way: invite link → signup page with the code filled in → account
  const page = await newPage();
  await page.goto(`${BASE}/join/${codes[0]}`); await page.waitForURL(/\/signup/);
  assert.equal(await page.inputValue('input[name=invite_code]'), codes[0]);
  const username = uname('invited'); const email = `${username}@test.local`; const t0 = Date.now();
  await page.fill('#su-username', username); await page.getByText(`@${username} is available.`).waitFor();
  await page.fill('input[name=email]', email); await page.fill('input[name=password]', 'password123');
  await page.fill('input[name=birthdate]', '1994-03-14'); await page.check('input[name=agree]');
  await page.click('button[type=submit]'); await page.waitForURL(/check-email/);
  await page.goto(linkIn(await waitMail(email, t0))); await page.waitForURL(/\/feed/);

  const { data: list } = await mod.c.rpc('mod_invites', { p_batch: 'test' });
  const used = list.find((i) => i.code === codes[0]);
  assert.equal(used.uses, 1); assert.deepEqual(used.used_by, [username]);
  // used up: the same code can't make a second account
  const r3 = await a.auth.signUp({ email: `again${Date.now()}@test.local`, password: 'password123', options: { data: { username: uname('again'), birthdate: '1995-01-01', invite_code: codes[0] } } });
  assert.ok(r3.error, 'one use only');
  // a turned-off code stops working
  await mod.c.rpc('mod_revoke_invite', { p_code: codes[1] });
  assert.equal((await a.rpc('invite_check', { p_code: codes[1] })).data, false);
  assert.equal((await a.rpc('invite_check', { p_code: codes[2].toLowerCase() })).data, true, 'codes aren’t case-sensitive');
  // bad link → coming-soon page says so
  const p2 = await newPage();
  await p2.goto(`${BASE}/join/SO-ZZZZ-ZZZZ`); await p2.getByText(/That code isn.t valid or has already been used/).waitFor();
  await mod.c.rpc('mod_set_invite_only', { p_on: false });
  assertClean(page, 'invite signup');
});

test('pre-launch gate: strangers see coming-soon, invite holders reach signup, signed-in testers get the real site', async () => {
  const G = 'http://localhost:3105';
  const stranger = await newPage();
  await stranger.goto(G + '/feed'); await stranger.getByText('GOT A BETA INVITE CODE?').waitFor();
  await stranger.goto(G + '/signup'); await stranger.getByText('GOT A BETA INVITE CODE?').waitFor();
  assert.equal((await stranger.request.get(G + '/api/now-listening?u=x')).status(), 404);
  await stranger.goto(G + '/login'); await stranger.locator('input[name=email]').waitFor();   // testers can always log in

  const mod = await makeUser(uname('gmod')); await admin.from('moderators').insert({ user_id: mod.id });
  const { data: [code] } = await mod.c.rpc('mod_create_invites', { p_count: 1, p_batch: 'gate' });
  const inv = await newPage();
  await inv.goto(`${G}/soon`); await inv.fill('#inv', code); await inv.click('button:has-text("Get in")');
  await inv.waitForURL(/\/signup/); await inv.locator('#su-username').waitFor();

  const tester = await makeUser(uname('tester'));
  const t = await newPage();
  await t.goto(G + '/login'); await t.fill('input[name=email]', tester.email); await t.fill('input[name=password]', 'password123');
  await t.click('button[type=submit]'); await t.waitForURL(/\/feed/);
  await t.goto(`${G}/u/${tester.username}`); await t.getByRole('heading', { name: tester.username }).first().waitFor();
  // a fake session cookie isn't enough
  const faker = await newPage();
  await faker.context().addCookies([{ name: 'sb-127-auth-token', value: 'nope', url: G }]);
  await faker.goto(G + '/feed'); await faker.getByText('GOT A BETA INVITE CODE?').waitFor();
});

test('SignedOn HQ: everyone is in it, and people who leave stay out', async () => {
  const founder = await makeUser(uname('hqf'));
  sql(`insert into app.site_founder (singleton, user_id) values (true, '${founder.id}') on conflict (singleton) do update set user_id = excluded.user_id`);
  const { data: hq } = await admin.from('communities').select('id, created_by').eq('slug', 'signedon-hq').single();
  assert.ok(hq);
  const fresh = await makeUser(uname('hqn'));
  const { data: m } = await admin.from('community_members').select('role').eq('community_id', hq.id).eq('user_id', fresh.id);
  assert.equal(m.length, 1, 'new people join HQ automatically');
  await fresh.c.from('community_members').delete().eq('community_id', hq.id).eq('user_id', fresh.id);
  sql('select app.ensure_hq()');
  assert.equal((await admin.from('community_members').select('user_id').eq('community_id', hq.id).eq('user_id', fresh.id)).data.length, 0, 'leaving sticks');
  const page = await newPage();
  await page.goto(BASE + '/communities/signedon-hq'); await page.getByRole('heading', { name: 'SignedOn HQ' }).first().waitFor();
  sql('delete from app.site_founder');
});

test('help bot answers common questions and hands the rest to Darren', async () => {
  const U = await apiUserUI(uname('help'));
  const p = U.page;
  await p.getByRole('button', { name: 'Help' }).click();
  const bot = p.getByRole('dialog', { name: 'SignedOn help' });
  await bot.getByPlaceholder('Ask a question…').fill('how do i block someone');
  await bot.getByRole('button', { name: 'Ask', exact: true }).click();
  await bot.getByText(/Go to their page and tap Block/).waitFor();
  await bot.getByPlaceholder('Ask a question…').fill('change my song');
  await bot.getByRole('button', { name: 'Ask', exact: true }).click();
  await bot.getByRole('link', { name: 'Customize my page →' }).last().click();
  await p.waitForURL(new RegExp(`/u/${U.username}\\?edit=1`));
  await p.getByRole('button', { name: 'Help' }).click();
  await p.getByPlaceholder('Ask a question…').fill('xyzzy flarg');
  await p.getByRole('button', { name: 'Ask', exact: true }).click();
  await p.getByRole('link', { name: 'Ask Darren →' }).click();
  await p.waitForURL(/\/feedback/);
  assert.equal(await p.inputValue('textarea[name=message]'), 'xyzzy flarg');
  assert.ok(await p.getByRole('radio', { name: /A question/ }).isChecked());
  await p.goto(BASE + '/messenger'); assert.equal(await p.getByRole('button', { name: 'Help' }).count(), 0, 'stays out of Messenger’s way');
  assertClean(p, 'help bot');
});
