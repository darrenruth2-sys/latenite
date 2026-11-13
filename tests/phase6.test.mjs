import test from 'node:test'; import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { admin, anon, makeUser, uname } from './helpers.mjs';

const sql = (q) => execFileSync('psql', ['-h', '127.0.0.1', '-p', '54322', '-U', 'postgres', '-tAc', q], { encoding: 'utf8' }).trim();

test('first friend: founder befriends existing people, then new signups get the founder at #1', async () => {
  const early = await makeUser(uname('early'));
  const founder = await makeUser(uname('boss'));
  const n = Number(sql(`select app.set_site_founder('${founder.username}')`));
  assert.ok(n >= 1);
  assert.equal(sql(`select count(*) from public.user_badges where user_id = '${founder.id}' and badge_key = 'site_founder'`), '1');
  const fe = await early.c.rpc('friends_of', { p_user: early.id, p_limit: 50 });
  assert.ok(fe.data.some((f) => f.id === founder.id), 'existing user is now friends with founder');

  const fresh = await makeUser(uname('newbie'));
  const tops = await fresh.c.rpc('get_top_friends', { p_owner: fresh.id });
  assert.equal(tops.data[0].id, founder.id, 'founder is #1 in Top 8');
  const notes = await fresh.c.from('notifications').select('type, actor_id').eq('user_id', fresh.id);
  assert.ok(notes.data.some((x) => x.type === 'first_friend' && x.actor_id === founder.id));
  const founderNotes = await founder.c.from('notifications').select('type').eq('user_id', founder.id).eq('type', 'friend_accepted');
  assert.equal(founderNotes.data.length, 0, 'founder is not spammed for every signup');

  // users can drop the founder like anyone else
  assert.equal((await fresh.c.rpc('set_top_friends', { p_ids: [] })).error, null);
  assert.equal((await fresh.c.rpc('get_top_friends', { p_owner: fresh.id })).data.length, 0);

  // nobody but the database owner can name a founder
  assert.ok((await fresh.c.rpc('set_site_founder', { p_username: fresh.username })).error);
  sql(`delete from app.site_founder`);
});

test('waitlist: per-visitor limit, one visitor cannot lock out everyone, no public access', async () => {
  const join = (email, src) => admin.rpc('join_waitlist', { p_email: email, p_name: null, p_miss: null, p_source: src });
  for (let i = 0; i < 5; i++) assert.equal((await join(`bot${i}@x.test`, 'bot')).error, null);
  const blocked = await join('bot6@x.test', 'bot');
  assert.match(blocked.error?.message || '', /AH_RATE_LIMIT/, 'same visitor gets stopped');
  const real = await join('real.person@x.test', 'someone-else');
  assert.equal(real.error, null, 'a different visitor still gets in');
  assert.equal(real.data.new, true);
  assert.ok((await anon().rpc('join_waitlist', { p_email: 'a@b.test', p_name: null, p_miss: null, p_source: 'x' })).error, 'browser cannot call it directly');
  assert.ok(Number((await anon().rpc('waitlist_count')).data) >= 6);
  sql(`delete from public.waitlist; delete from app.waitlist_attempts`);
});
