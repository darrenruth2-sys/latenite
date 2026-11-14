// v10.3: early birds on the waitlist get a personal beta key by email; unsubscribe works; ideas reach the founder.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { launch, close, BASE, newPage, assertClean } from './browser.mjs';
import { admin, makeUser, uname } from '../helpers.mjs';

const sql = (q) => execFileSync('psql', ['-h', '127.0.0.1', '-p', '54322', '-U', 'postgres', '-tAc', q], { encoding: 'utf8' }).trim();
const sent = async (to) => (await fetch('http://127.0.0.1:4555/resend/sent?to=' + encodeURIComponent(to))).json();
before(async () => { await launch(); sql('delete from app.waitlist_attempts'); });
after(async () => { sql('update app.settings set auto_invite = false, auto_invite_cap = 5000 where singleton'); await close(); });

async function signGuestbook(email, name) {
  sql('delete from app.waitlist_attempts'); // the real 5-per-10-minutes limit would stop a test this busy
  const p = await newPage();
  await p.goto(BASE + '/soon');
  if (name) await p.fill('#gb-name', name);
  await p.fill('#gb-email', email);
  await p.click('button:has-text("Sign the guestbook")');
  await p.getByText(/You’re on the list/).waitFor();
  return p;
}

test('early birds get their own key by email, up to the limit; the rest wait', async () => {
  const mod = await makeUser(uname('amod')); await admin.from('moderators').insert({ user_id: mod.id });
  const tag = Date.now().toString(36);
  const [a, b, c] = ['a', 'b', 'c'].map((x) => `${x}${tag}@test.local`);

  // off: nothing goes out
  await signGuestbook(`off${tag}@test.local`);
  assert.equal((await sent(`off${tag}@test.local`)).length, 0);

  const given0 = (await mod.c.rpc('mod_auto_invite_status')).data.given;
  assert.equal((await mod.c.rpc('mod_set_auto_invite', { p_on: true, p_cap: given0 + 2 })).error, null);
  const pa = await signGuestbook(a, 'Jules');
  await pa.getByText(/your beta key is on its way/).waitFor();
  await signGuestbook(b);
  await signGuestbook(c);
  const [ma] = await sent(a);
  assert.ok(ma, 'first person got an email');
  assert.match(ma.subject, /beta key/); assert.match(ma.text, /Hey Jules,/);
  const code = ma.text.match(/SO-[A-Z2-9]{4}-[A-Z2-9]{4}/)[0];
  assert.match(ma.html, new RegExp(`/join/${code}`)); assert.match(ma.html, /Unsubscribe/);
  assert.ok(ma.headers['List-Unsubscribe']);
  assert.equal((await sent(b)).length, 1, 'second person too');
  assert.equal((await sent(c)).length, 0, 'third waits: limit reached');
  // signing again doesn't send a second key
  await signGuestbook(a);
  assert.equal((await sent(a)).length, 1);

  // the emailed link works
  const j = await newPage();
  await j.goto(`${BASE}/join/${code}`); await j.waitForURL(/\/signup/);

  // raise the limit and send keys to the people already waiting
  const m = await newPage();
  await m.goto(BASE + '/login'); await m.fill('input[name=email]', mod.email); await m.fill('input[name=password]', 'password123');
  await m.click('button[type=submit]'); await m.waitForURL(/\/feed/);
  await m.goto(BASE + '/mod');
  await m.getByText('📬 Auto-keys are ON').waitFor();
  await m.getByLabel('First how many people get a key').fill(String(given0 + 50));
  await m.getByRole('button', { name: 'Save limit' }).click(); await m.getByText(/Auto-keys ON for the first/).waitFor();
  m.on('dialog', (d) => d.accept());
  await m.getByRole('button', { name: 'Send keys to people already waiting' }).click();
  await m.getByText(/Sent \d+ key/).waitFor();
  assert.equal((await sent(c)).length, 1, 'waiting person got their key');
  assertClean(m, 'auto keys panel');
});

test('a failed email is retried; unsubscribing stops keys and needs the real link', async () => {
  const mod = await makeUser(uname('umod')); await admin.from('moderators').insert({ user_id: mod.id });
  const tag = Date.now().toString(36);
  await mod.c.rpc('mod_set_auto_invite', { p_on: true, p_cap: 100000 });
  const bounce = `bounce${tag}@test.local`;
  await signGuestbook(bounce);
  let st = (await mod.c.rpc('mod_auto_invite_status')).data;
  assert.ok(st.failed >= 1, 'failure is counted');
  assert.equal(sql(`select invite_sent_at is null and invite_code is not null from public.waitlist where email = '${bounce}'`), 't', 'key kept for a retry');

  // unsubscribe
  await mod.c.rpc('mod_set_auto_invite', { p_on: false, p_cap: 100000 });
  const quiet = `quiet${tag}@test.local`;
  await signGuestbook(quiet);
  const p = await newPage();
  await p.goto(`${BASE}/unsubscribe?e=${quiet}&t=nope`); await p.getByText('That link doesn’t work').waitFor();
  // build the real link the way the email does: grab it from a key email to another address
  await mod.c.rpc('mod_set_auto_invite', { p_on: true, p_cap: 100000 });
  const other = `other${tag}@test.local`;
  await signGuestbook(other);
  const link = (await sent(other))[0].headers['List-Unsubscribe'].slice(1, -1);
  await p.goto(link); await p.getByRole('button', { name: 'Unsubscribe me' }).click();
  await p.getByText('You’re unsubscribed').waitFor();
  assert.equal(sql(`select unsubscribed_at is not null from public.waitlist where email = '${other}'`), 't');
  // the quiet one (unsubscribed by SQL here) is skipped by "send keys to people waiting"
  sql(`update public.waitlist set unsubscribed_at = now() where email = '${quiet}'`);
  const { data: waiting } = await mod.c.rpc('mod_waiting_for_keys', { p_limit: 200 });
  assert.ok(!waiting.includes(quiet));
  await mod.c.rpc('mod_set_auto_invite', { p_on: false, p_cap: 5000 });
});

test('ideas & questions are emailed to the founder with reply-to', async () => {
  const U = await makeUser(uname('fbm'));
  const p = await newPage();
  await p.goto(BASE + '/login'); await p.fill('input[name=email]', U.email); await p.fill('input[name=password]', 'password123');
  await p.click('button[type=submit]'); await p.waitForURL(/\/feed/);
  await p.goto(BASE + '/feedback');
  await p.fill('textarea[name=message]', 'Please add video chat ' + U.username);
  await p.click('button:has-text("Send it")'); await p.getByText('MESSAGE SENT').waitFor();
  const mails = (await sent('founder@test.local')).filter((m) => m.text.includes(U.username));
  assert.equal(mails.length, 1); assert.equal(mails[0].reply_to, U.email);
});
