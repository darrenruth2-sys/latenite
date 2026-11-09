import test from 'node:test'; import assert from 'node:assert/strict';
import { anon, makeUser, befriend, uname } from './helpers.mjs';

test('themes, layout and music are validated', async () => {
  const a = await makeUser(uname('themer'));
  const ok = await a.c.from('profile_details').update({ theme: { preset: 'bubblegum', page: '#FFD6EC', accent: '#D4146F', pattern: 'checker', font: 'serif' } }).eq('id', a.id);
  assert.equal(ok.error, null);
  for (const bad of [{ page: 'red; background:url(javascript:alert(1))' }, { evil: 1 }, { font: 'comic' }, { bg_image: 'javascript:alert(1)' }, { bg_image: 'https://x.com/a.png);background:red' }]) {
    const r = await a.c.from('profile_details').update({ theme: bad }).eq('id', a.id);
    assert.ok(r.error, 'should reject ' + JSON.stringify(bad));
  }
  assert.ok((await a.c.from('profile_details').update({ layout: ['top', 'top'] }).eq('id', a.id)).error, 'no duplicate sections');
  assert.ok((await a.c.from('profile_details').update({ layout: ['<script>'] }).eq('id', a.id)).error);
  assert.equal((await a.c.from('profile_details').update({ layout: ['guestbook', 'top', 'about'] }).eq('id', a.id)).error, null);
  assert.equal((await a.c.from('profile_details').update({ music: { provider: 'youtube', url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', title: 'Song' } }).eq('id', a.id)).error, null);
  assert.ok((await a.c.from('profile_details').update({ music: { provider: 'youtube', url: 'https://evil.com/x' } }).eq('id', a.id)).error);
  assert.ok((await a.c.from('profile_details').update({ view_count: 999999 }).eq('id', a.id)).error, 'cannot fake view count');
  const hist = await a.c.from('theme_history').select('*');
  assert.ok(hist.data.length >= 1, 'theme history recorded');
});

test('top friends: friends only, ranks, hidden order, unfriend cleanup, top-only posts', async () => {
  const o = await makeUser(uname('owner')); const f1 = await makeUser(uname('ff1')); const f2 = await makeUser(uname('ff2')); const s = await makeUser(uname('str'));
  await befriend(o, f1); await befriend(o, f2);
  assert.ok((await o.c.rpc('set_top_friends', { p_ids: [s.id] })).error, 'strangers cannot be top friends');
  assert.ok((await o.c.rpc('set_top_friends', { p_ids: [f1.id, f1.id] })).error, 'no duplicates');
  assert.equal((await o.c.rpc('set_top_friends', { p_ids: [f2.id, f1.id] })).error, null);
  const seen = await s.c.rpc('get_top_friends', { p_owner: o.id });
  assert.deepEqual(seen.data.map((x) => [x.rank, x.id]), [[1, f2.id], [2, f1.id]]);
  const n = await f1.c.from('notifications').select('type').eq('type', 'top_friend');
  assert.equal(n.data.length, 1, 'top friend notification');
  await o.c.from('profile_details').update({ top_hidden: true }).eq('id', o.id);
  const hidden = await s.c.rpc('get_top_friends', { p_owner: o.id });
  assert.ok(hidden.data.every((x) => x.rank === null), 'ranks hidden from visitors');
  const own = await o.c.rpc('get_top_friends', { p_owner: o.id });
  assert.ok(own.data.every((x) => x.rank !== null), 'owner still sees ranks');
  // top-only post visible to top friend, not to plain friend
  await o.c.rpc('set_top_friends', { p_ids: [f1.id] });
  const p = await o.c.from('posts').insert({ author_id: o.id, body: 'top 8 only', visibility: 'top' }).select().single();
  assert.equal((await f1.c.from('posts').select('id').eq('id', p.data.id)).data.length, 1);
  assert.equal((await f2.c.from('posts').select('id').eq('id', p.data.id)).data.length, 0);
  await f1.c.rpc('unfriend', { p_other: o.id });
  assert.equal((await o.c.from('top_friends').select('*')).data.length, 0, 'unfriend removes from top friends');
  // direct writes blocked
  assert.ok((await o.c.from('top_friends').insert({ owner_id: o.id, friend_id: s.id, rank: 1 })).error);
});

test('guestbook: policies, hiding, deleting, replies, blocks', async () => {
  const o = await makeUser(uname('gbown')); const f = await makeUser(uname('gbfr')); const s = await makeUser(uname('gbstr'));
  await befriend(o, f);
  const e1 = await f.c.from('guestbook_entries').insert({ profile_id: o.id, author_id: f.id, body: 'hi friend', sticker: 'glitter' }).select().single();
  assert.equal(e1.error, null);
  assert.ok((await s.c.from('guestbook_entries').insert({ profile_id: o.id, author_id: s.id, body: 'stranger' })).error, 'friends-only by default');
  await o.c.from('profile_details').update({ guestbook_policy: 'everyone' }).eq('id', o.id);
  assert.equal((await s.c.from('guestbook_entries').insert({ profile_id: o.id, author_id: s.id, body: 'now ok' })).error, null);
  assert.ok((await s.c.from('guestbook_entries').insert({ profile_id: o.id, author_id: f.id, body: 'spoof' })).error, 'cannot sign as someone else');
  assert.ok((await s.c.from('guestbook_entries').insert({ profile_id: o.id, author_id: s.id, sticker: 'evil' })).error, 'sticker whitelist');
  assert.ok((await s.c.from('guestbook_entries').insert({ profile_id: o.id, author_id: s.id, body: '   ' })).error, 'no empty entries');
  // hide: visitors lose it, author + owner still see it
  assert.equal((await o.c.from('guestbook_entries').update({ hidden_at: new Date().toISOString() }).eq('id', e1.data.id)).error, null);
  assert.equal((await s.c.from('guestbook_entries').select('id').eq('id', e1.data.id)).data.length, 0);
  assert.equal((await f.c.from('guestbook_entries').select('id').eq('id', e1.data.id)).data.length, 1);
  assert.equal((await anon().from('guestbook_entries').select('id').eq('id', e1.data.id)).data.length, 0);
  // author cannot un-hide or edit
  const up = await f.c.from('guestbook_entries').update({ hidden_at: null }).eq('id', e1.data.id).select();
  assert.equal(up.data?.length || 0, 0);
  // reply
  const r = await o.c.from('guestbook_entries').insert({ profile_id: o.id, author_id: o.id, parent_id: e1.data.id, body: 'thanks!' });
  assert.equal(r.error, null);
  assert.ok((await f.c.from('notifications').select('type').eq('type', 'guestbook_reply')).data.length >= 1);
  // owner deletes stranger's entry
  const se = await s.c.from('guestbook_entries').select('id').eq('author_id', s.id);
  assert.equal((await o.c.from('guestbook_entries').delete().eq('id', se.data[0].id).select()).data.length, 1);
  // blocking hides the blocked person's entries and stops signing
  await s.c.from('guestbook_entries').insert({ profile_id: o.id, author_id: s.id, body: 'again' });
  await o.c.from('blocks').insert({ blocker_id: o.id, blocked_id: s.id });
  assert.equal((await o.c.from('guestbook_entries').select('id').eq('author_id', s.id)).data.length, 0);
  assert.ok((await s.c.from('guestbook_entries').insert({ profile_id: o.id, author_id: s.id, body: 'blocked' })).error);
});

test('visitors: recorded once a day, private browsing is reciprocal, no direct access', async () => {
  const o = await makeUser(uname('visown')); const v = await makeUser(uname('vis')); const p = await makeUser(uname('sneak'));
  await v.c.rpc('record_visit', { p_profile: o.id }); await v.c.rpc('record_visit', { p_profile: o.id });
  await p.c.from('profile_settings').update({ private_browsing: true }).eq('id', p.id);
  await p.c.rpc('record_visit', { p_profile: o.id });
  const list = await o.c.rpc('my_visitors');
  assert.deepEqual(list.data.map((x) => x.id), [v.id], 'private visitor not recorded, duplicates collapsed');
  const stats = await o.c.rpc('visit_stats', { p_profile: o.id });
  assert.equal(stats.data.total, 1); assert.equal(stats.data.week, 1);
  const other = await v.c.rpc('visit_stats', { p_profile: o.id });
  assert.equal(other.data.week, null, 'only the owner sees weekly count');
  await o.c.from('profile_settings').update({ private_browsing: true }).eq('id', o.id);
  assert.equal((await o.c.rpc('my_visitors')).data.length, 0, 'owner browsing privately cannot see visitors');
  assert.ok(((await v.c.from('profile_visits').select('*')).data || []).length === 0, 'table not directly readable');
  assert.ok((await v.c.from('profile_visits').insert({ profile_id: o.id, visitor_id: p.id })).error, 'cannot fake visits');
  assert.ok((await o.c.from('notifications').select('type').eq('type', 'visit')).data.length === 1, 'one visit notification');
});
