import test from 'node:test'; import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { admin, anon, makeUser, befriend, uname } from './helpers.mjs';

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

test('founder at #1 works even when someone already has a full Top Friends list (rank limit 1..16)', async () => {
  const owner = await makeUser(uname('full'));
  const founder = await makeUser(uname('fdr'));
  const pals = await Promise.all(Array.from({ length: 16 }, (_, i) => makeUser(uname('pal' + i))));
  for (const p of pals) await befriend(owner, p);
  assert.equal((await owner.c.rpc('set_top_friends', { p_ids: pals.map((p) => p.id) })).error, null);
  sql(`insert into app.site_founder (singleton, user_id) values (true, '${founder.id}') on conflict (singleton) do update set user_id = excluded.user_id`);
  sql(`select app.befriend_founder('${owner.id}', true)`);
  const ranks = sql(`select string_agg(friend_id::text || ':' || rank, ',' order by rank) from public.top_friends where owner_id = '${owner.id}'`).split(',');
  assert.equal(ranks.length, 16, 'still 16 slots');
  assert.equal(ranks[0], `${founder.id}:1`, 'founder is #1');
  assert.equal(ranks[1], `${pals[0].id}:2`, 'everyone else moved down one');
  assert.ok(!ranks.some((r) => r.startsWith(pals[15].id)), 'the old #16 dropped off');
  sql(`delete from app.site_founder`);
});


test('export lists are complete past the UI caps (1,100 friends, paged)', async () => {
  const me = await makeUser(uname('popular'));
  // 1,100 friends straight into the database (the app's friend-request limits would make this take hours)
  const tag = me.id.slice(0, 6);
  sql(`insert into auth.users (id, email, aud, role, raw_user_meta_data) select gen_random_uuid(), 'bulk' || g || '_${me.id.slice(0, 8)}@x.test', 'authenticated', 'authenticated',
       jsonb_build_object('username', 'bk${tag}' || g, 'display_name', 'Bulk ' || g, 'birthdate', '1990-01-01') from generate_series(1, 1100) g`);
  const ids = sql(`select string_agg(p.id::text, ',') from public.profiles p join auth.users u on u.id = p.id where u.email like 'bulk%_${me.id.slice(0, 8)}@x.test'`).split(',');
  assert.equal(ids.length, 1100, 'bulk profiles created by the signup trigger');
  sql(`insert into public.friendships (user_a, user_b, requested_by) select least('${me.id}'::uuid, p), greatest('${me.id}'::uuid, p), null from unnest('{${ids.join(',')}}'::uuid[]) p`);
  const all = []; for (let off = 0; ; off += 1000) { const { data, error } = await me.c.rpc('export_my_friends', { p_offset: off, p_limit: 1000 }); assert.equal(error, null); all.push(...data); if (data.length < 1000) break; }
  assert.equal(all.length, 1100, 'every friend exported');
  assert.equal(new Set(all.map((f) => f.id)).size, 1100, 'no repeats across pages');
  assert.equal((await me.c.rpc('friends_of', { p_user: me.id, p_limit: 5000 })).data.length, 500, 'the UI list is still capped (by design)');
  assert.ok((await anon().rpc('export_my_friends', { p_offset: 0, p_limit: 10 })).error, 'logged-out callers refused');
});
