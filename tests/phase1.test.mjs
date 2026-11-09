import test from 'node:test'; import assert from 'node:assert/strict';
import { admin, anon, makeUser, befriend, uname, URL, ANON } from './helpers.mjs';
import { createClient } from '@supabase/supabase-js';

test('signup enforces 18+ and username rules', async () => {
  const c = createClient(URL, ANON, { auth: { persistSession: false } });
  const kid = await c.auth.signUp({ email: `kid${Date.now()}@test.local`, password: 'password123',
    options: { data: { username: uname('kid'), display_name: 'Kid', birthdate: '2012-01-01' } } });
  assert.ok(kid.error, 'under-18 signup must fail');
  const reserved = await c.auth.signUp({ email: `r${Date.now()}@test.local`, password: 'password123',
    options: { data: { username: 'admin', birthdate: '1990-01-01' } } });
  assert.ok(reserved.error, 'reserved username must fail');
  const bad = await c.auth.signUp({ email: `b${Date.now()}@test.local`, password: 'password123',
    options: { data: { username: 'Bad Name!', birthdate: '1990-01-01' } } });
  assert.ok(bad.error, 'invalid username must fail');
  const ok = await c.auth.signUp({ email: `ok${Date.now()}@test.local`, password: 'password123',
    options: { data: { username: uname('okuser'), birthdate: '1990-01-01' } } });
  assert.equal(ok.error, null);
  const avail = await c.rpc('username_available', { p_username: 'admin' });
  assert.equal(avail.data, false);
});

test('friend requests, auto-accept, notifications, unfriend', async () => {
  const a = await makeUser(uname('alice')); const b = await makeUser(uname('bob'));
  assert.equal((await a.c.rpc('send_friend_request', { p_target: b.id })).data, 'sent');
  assert.equal((await a.c.rpc('send_friend_request', { p_target: b.id })).data, 'pending');
  const n = await b.c.from('notifications').select('type').eq('type', 'friend_request');
  assert.equal(n.data.length, 1);
  const reqs = await b.c.from('friend_requests').select('id').eq('recipient_id', b.id);
  assert.equal((await b.c.rpc('respond_friend_request', { p_request: reqs.data[0].id, p_accept: true })).data, 'accepted');
  assert.equal((await a.c.rpc('send_friend_request', { p_target: b.id })).data, 'already_friends');
  const feedItem = await a.c.from('posts').select('kind,author_id').eq('kind', 'friendship');
  assert.equal(feedItem.data.length, 1, 'friendship shows in feed');
  await a.c.rpc('unfriend', { p_other: b.id });
  const fs = await a.c.from('friendships').select('*').or(`user_a.eq.${a.id},user_b.eq.${a.id}`);
  assert.equal(fs.data.length, 0);
  const self = await a.c.rpc('send_friend_request', { p_target: a.id });
  assert.ok(self.error, 'cannot friend yourself');
});

test('users cannot write other people\'s data or protected columns', async () => {
  const a = await makeUser(uname('mallory')); const b = await makeUser(uname('victim'));
  const r1 = await a.c.from('profiles').update({ display_name: 'hacked' }).eq('id', b.id).select();
  assert.equal(r1.data?.length || 0, 0);
  const r2 = await a.c.from('profiles').update({ suspended_at: new Date().toISOString() }).eq('id', a.id);
  assert.ok(r2.error, 'cannot set suspended_at');
  const r3 = await a.c.from('profile_private').select('*');
  assert.equal(r3.data.length, 1, 'only own private row'); assert.equal(r3.data[0].id, a.id);
  const r4 = await a.c.from('profile_settings').select('*').eq('id', b.id);
  assert.equal(r4.data.length, 0);
  const r5 = await a.c.from('posts').insert({ author_id: b.id, body: 'impersonation' });
  assert.ok(r5.error, 'cannot post as someone else');
  const r6 = await a.c.from('posts').insert({ author_id: a.id, kind: 'friendship', body: 'fake' });
  assert.ok(r6.error, 'cannot forge system post kinds');
  const r7 = await a.c.from('friendships').insert({ user_a: a.id < b.id ? a.id : b.id, user_b: a.id < b.id ? b.id : a.id });
  assert.ok(r7.error, 'cannot forge friendships');
  const r8 = await a.c.from('notifications').insert({ user_id: b.id, type: 'x' });
  assert.ok(r8.error, 'cannot forge notifications');
  const r9 = await a.c.from('moderators').insert({ user_id: a.id });
  assert.ok(r9.error, 'cannot make yourself a moderator');
});

test('post visibility: friends-only, public, private profiles, blocks, feed', async () => {
  const a = await makeUser(uname('poster')); const f = await makeUser(uname('friend')); const s = await makeUser(uname('strang'));
  await befriend(a, f);
  const fp = await a.c.from('posts').insert({ author_id: a.id, body: 'friends only', visibility: 'friends' }).select().single();
  const pp = await a.c.from('posts').insert({ author_id: a.id, body: 'hello world', visibility: 'public' }).select().single();
  assert.equal(fp.error, null); assert.equal(pp.error, null);
  const seenByFriend = await f.c.from('posts').select('id').in('id', [fp.data.id, pp.data.id]);
  assert.equal(seenByFriend.data.length, 2);
  const seenByStranger = await s.c.from('posts').select('id').in('id', [fp.data.id, pp.data.id]);
  assert.deepEqual(seenByStranger.data.map(x => x.id), [pp.data.id]);
  const seenByAnon = await anon().from('posts').select('id').in('id', [fp.data.id, pp.data.id]);
  assert.deepEqual(seenByAnon.data.map(x => x.id), [pp.data.id]);
  const feed = await f.c.rpc('friend_feed', { p_limit: 50 });
  assert.ok(feed.data.some(p => p.id === fp.data.id), 'friend sees post in feed');
  const sfeed = await s.c.rpc('friend_feed', { p_limit: 50 });
  assert.ok(!sfeed.data.some(p => p.id === pp.data.id), 'public posts from strangers never enter friends feed');
  // private profile hides even "public" posts from strangers and details from strangers
  await a.c.from('profiles').update({ is_private: true }).eq('id', a.id);
  await a.c.from('profile_details').update({ bio: 'secret bio' }).eq('id', a.id);
  assert.equal((await s.c.from('posts').select('id').eq('id', pp.data.id)).data.length, 0);
  assert.equal((await s.c.from('profile_details').select('bio').eq('id', a.id)).data.length, 0);
  assert.equal((await f.c.from('profile_details').select('bio').eq('id', a.id)).data[0].bio, 'secret bio');
  assert.equal((await s.c.from('profiles').select('username').eq('id', a.id)).data.length, 1, 'card stays visible');
  // stranger cannot comment on hidden post
  const c1 = await s.c.from('comments').insert({ post_id: fp.data.id, author_id: s.id, body: 'hi' });
  assert.ok(c1.error);
  // block: friend blocks poster -> friendship gone, poster cannot see blocker at all
  await f.c.from('blocks').insert({ blocker_id: f.id, blocked_id: a.id });
  assert.equal((await a.c.from('friendships').select('*').or(`user_a.eq.${a.id},user_b.eq.${a.id}`)).data.length, 0);
  assert.equal((await a.c.from('profiles').select('id').eq('id', f.id)).data.length, 0, 'blocked user cannot see blocker');
  assert.equal((await f.c.from('posts').select('id').eq('id', fp.data.id)).data.length, 0);
  const again = await a.c.rpc('send_friend_request', { p_target: f.id });
  assert.ok(again.error, 'cannot friend across a block');
});

test('comments, likes and notifications', async () => {
  const a = await makeUser(uname('author')); const b = await makeUser(uname('liker'));
  await befriend(a, b);
  const p = await a.c.from('posts').insert({ author_id: a.id, body: 'like me' }).select().single();
  assert.equal((await b.c.from('reactions').insert({ post_id: p.data.id, user_id: b.id })).error, null);
  assert.ok((await b.c.from('reactions').insert({ post_id: p.data.id, user_id: b.id })).error, 'no double like');
  assert.equal((await b.c.from('comments').insert({ post_id: p.data.id, author_id: b.id, body: 'nice' })).error, null);
  const notes = await a.c.from('notifications').select('type');
  const types = notes.data.map(x => x.type).sort();
  assert.ok(types.includes('like') && types.includes('comment'));
  // author can delete a comment on their post
  const cm = await a.c.from('comments').select('id').eq('post_id', p.data.id);
  const del = await a.c.from('comments').delete().eq('id', cm.data[0].id).select();
  assert.equal(del.data.length, 1);
  // empty status rejected
  assert.ok((await a.c.from('posts').insert({ author_id: a.id, body: '   ' })).error);
});
