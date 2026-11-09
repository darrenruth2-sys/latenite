import test from 'node:test'; import assert from 'node:assert/strict';
import { makeUser, befriend, uname } from './helpers.mjs';

test('DMs: friends only, members only, blocks, unread + receipts', async () => {
  const a = await makeUser(uname('ma')); const b = await makeUser(uname('mb')); const s = await makeUser(uname('ms'));
  await befriend(a, b);
  assert.ok((await a.c.rpc('start_dm', { p_other: s.id })).error, 'cannot DM strangers');
  const { data: conv } = await a.c.rpc('start_dm', { p_other: b.id });
  assert.equal((await b.c.rpc('start_dm', { p_other: a.id })).data, conv, 'same DM both ways');
  assert.equal((await a.c.from('messages').insert({ conversation_id: conv, sender_id: a.id, body: 'hey' })).error, null);
  assert.ok((await s.c.from('messages').insert({ conversation_id: conv, sender_id: s.id, body: 'intrude' })).error, 'outsiders cannot post');
  assert.equal((await s.c.from('messages').select('*').eq('conversation_id', conv)).data.length, 0, 'outsiders cannot read');
  assert.ok((await a.c.from('messages').insert({ conversation_id: conv, sender_id: b.id, body: 'spoof' })).error, 'cannot send as someone else');
  assert.ok((await a.c.from('messages').insert({ conversation_id: conv, sender_id: a.id, kind: 'nudge' })).error, 'nudges only via rpc');
  assert.equal((await b.c.rpc('unread_conversation_count')).data, 1);
  const list = await b.c.rpc('my_conversations');
  assert.equal(list.data[0].unread, 1); assert.equal(list.data[0].last_body, 'hey');
  await b.c.rpc('mark_read', { p_conv: conv });
  assert.equal((await b.c.rpc('unread_conversation_count')).data, 0);
  const st = await a.c.rpc('conversation_state', { p_conv: conv });
  assert.ok(st.data[0].last_read_at, 'receipts visible when both enabled');
  await b.c.from('profile_settings').update({ read_receipts: false }).eq('id', b.id);
  assert.equal((await a.c.rpc('conversation_state', { p_conv: conv })).data[0].last_read_at, null, 'receipts hidden when off');
  assert.equal((await a.c.from('conversation_members').select('*').eq('conversation_id', conv)).data.length, 1, 'cannot read others membership rows');
  // typing
  await b.c.rpc('set_typing', { p_conv: conv });
  assert.equal((await a.c.rpc('conversation_state', { p_conv: conv })).data[0].typing, true);
  // block -> no more messages, existing DM can't be used
  await b.c.from('blocks').insert({ blocker_id: b.id, blocked_id: a.id });
  assert.ok((await a.c.from('messages').insert({ conversation_id: conv, sender_id: a.id, body: 'still there?' })).error, 'blocked DM');
  assert.equal((await b.c.from('messages').select('id').eq('conversation_id', conv)).data.length, 0, 'blocker no longer sees blocked user messages');
});

test('nudges: respect setting, cooldown; away auto-reply; presence privacy', async () => {
  const a = await makeUser(uname('na')); const b = await makeUser(uname('nb')); const s = await makeUser(uname('nst'));
  await befriend(a, b);
  const { data: conv } = await a.c.rpc('start_dm', { p_other: b.id });
  assert.equal((await a.c.rpc('send_nudge', { p_conv: conv })).error, null);
  const again = await a.c.rpc('send_nudge', { p_conv: conv });
  assert.match(again.error.message, /AH_NUDGE_COOLDOWN/);
  await b.c.from('profile_settings').update({ allow_nudges: false }).eq('id', b.id);
  await new Promise((r) => setTimeout(r, 10500));
  assert.match((await a.c.rpc('send_nudge', { p_conv: conv })).error.message, /AH_NUDGES_OFF/);
  // away message auto-reply once
  await b.c.rpc('heartbeat');
  await b.c.from('presence').update({ status: 'away', away_message: 'BRB, dinner' }).eq('user_id', b.id);
  await a.c.from('messages').insert({ conversation_id: conv, sender_id: a.id, body: 'u there' });
  await a.c.from('messages').insert({ conversation_id: conv, sender_id: a.id, body: 'hello??' });
  const away = await a.c.from('messages').select('kind, body, sender_id').eq('conversation_id', conv).eq('kind', 'away');
  assert.equal(away.data.length, 1); assert.equal(away.data[0].body, 'BRB, dinner');
  // buddy list shows away message to friends; strangers get no status
  const bl = await a.c.rpc('buddy_list');
  assert.equal(bl.data[0].status, 'away'); assert.equal(bl.data[0].away_message, 'BRB, dinner');
  assert.equal((await s.c.rpc('presence_of', { p_ids: [b.id] })).data[0].status, null, 'strangers cannot see online status');
  await b.c.from('presence').update({ status: 'invisible' }).eq('user_id', b.id);
  assert.equal((await a.c.rpc('buddy_list')).data[0].status, 'offline', 'invisible looks offline');
  assert.equal((await a.c.from('presence').select('*').eq('user_id', b.id)).data.length, 0, 'raw presence is private');
});

test('groups: friends only, leave, outsiders blocked', async () => {
  const a = await makeUser(uname('ga')); const b = await makeUser(uname('gb')); const c = await makeUser(uname('gc')); const s = await makeUser(uname('gs'));
  await befriend(a, b); await befriend(a, c);
  assert.ok((await a.c.rpc('create_group', { p_title: 'x', p_members: [b.id, s.id] })).error, 'strangers cannot be added');
  const { data: g } = await a.c.rpc('create_group', { p_title: 'Rink crew', p_members: [b.id, c.id] });
  assert.equal((await c.c.from('messages').insert({ conversation_id: g, sender_id: c.id, body: 'friday?' })).error, null);
  assert.equal((await b.c.from('messages').select('body').eq('conversation_id', g).eq('kind', 'text')).data.length, 1);
  await c.c.rpc('leave_group', { p_conv: g });
  assert.equal((await c.c.from('messages').select('id').eq('conversation_id', g)).data.length, 0, 'left members lose access');
  assert.ok((await c.c.from('messages').insert({ conversation_id: g, sender_id: c.id, body: 'back' })).error);
  assert.ok((await a.c.rpc('send_nudge', { p_conv: g })).error, 'no nudges in groups');
});
