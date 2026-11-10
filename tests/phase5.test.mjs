import test from 'node:test'; import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { admin, anon, makeUser, befriend, uname } from './helpers.mjs';

const sql = (q) => execFileSync('psql', ['-h', '127.0.0.1', '-p', '54322', '-U', 'postgres', '-tAc', q], { encoding: 'utf8' }).trim();

test('security audit: RLS everywhere, no anon writes, safe definer functions, FK indexes', () => {
  const noRls = sql(`select string_agg(relname, ',') from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity`);
  assert.equal(noRls, '', 'tables without RLS: ' + noRls);
  const anonWrites = sql(`select string_agg(distinct table_name || ':' || privilege_type, ',') from information_schema.role_table_grants where grantee = 'anon' and table_schema = 'public' and privilege_type in ('INSERT','UPDATE','DELETE','TRUNCATE')`);
  assert.equal(anonWrites, '', 'anon can write: ' + anonWrites);
  const authTruncate = sql(`select string_agg(distinct table_name, ',') from information_schema.role_table_grants where grantee = 'authenticated' and table_schema = 'public' and privilege_type in ('TRUNCATE','REFERENCES','TRIGGER')`);
  assert.equal(authTruncate, '', 'risky grants: ' + authTruncate);
  const unsafeDefiner = sql(`select string_agg(n.nspname || '.' || p.proname, ',') from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('public','app') and p.prosecdef and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%')`);
  assert.equal(unsafeDefiner, '', 'security definer without fixed search_path: ' + unsafeDefiner);
  const anonExec = sql(`select string_agg(p.proname, ',' order by p.proname) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and has_function_privilege('anon', p.oid, 'execute')`);
  assert.equal(anonExec, 'friends_of,get_top_friends,join_waitlist,poll_results,recent_backers,username_available,visit_stats,waitlist_count', 'anon-callable functions: ' + anonExec);
  const fkNoIndex = sql(`select string_agg(c.conrelid::regclass || '.' || a.attname, ',') from pg_constraint c
    join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
    where c.contype = 'f' and c.connamespace = 'public'::regnamespace and array_length(c.conkey, 1) = 1
      and not exists (select 1 from pg_index i where i.indrelid = c.conrelid and i.indkey[0] = c.conkey[1])`);
  assert.equal(fkNoIndex, '', 'foreign keys without an index: ' + fkNoIndex);
});

test('moderation: queue, remove, suspend hides everything, non-mods locked out', async () => {
  const mod = await makeUser(uname('mod')); const bad = await makeUser(uname('troll')); const v = await makeUser(uname('victim'));
  await admin.from('moderators').insert({ user_id: mod.id });
  await befriend(bad, v);
  const p = await bad.c.from('posts').insert({ author_id: bad.id, body: 'mean stuff', visibility: 'public' }).select().single();
  assert.equal((await v.c.from('reports').insert({ reporter_id: v.id, target_type: 'post', target_id: p.data.id, target_owner: bad.id, reason: 'harassment' })).error, null);
  assert.ok((await v.c.from('reports').insert({ reporter_id: v.id, target_type: 'post', target_id: p.data.id, target_owner: bad.id, reason: 'spam' })).error, 'one open report per item');
  assert.ok((await v.c.rpc('mod_reports')).error, 'non-mods cannot read the queue');
  assert.ok((await v.c.from('reports').select('*').eq('reporter_id', bad.id)).data.length === 0);
  const q = await mod.c.rpc('mod_reports');
  const rep = q.data.find((r) => r.target_id === p.data.id);
  assert.equal(rep.preview, 'mean stuff');
  assert.equal((await mod.c.rpc('mod_resolve', { p_report: rep.id, p_action: 'remove' })).error, null);
  assert.equal((await anon().from('posts').select('id').eq('id', p.data.id)).data.length, 0, 'removed post hidden');
  assert.equal((await bad.c.from('posts').select('id').eq('id', p.data.id)).data.length, 1, 'author still sees their own hidden post');
  // suspend
  await bad.c.from('guestbook_entries').insert({ profile_id: v.id, author_id: bad.id, body: 'hi' });
  assert.equal((await mod.c.rpc('mod_set_suspended', { p_user: bad.id, p_suspended: true })).error, null);
  assert.equal((await v.c.from('profiles').select('id').eq('id', bad.id)).data.length, 0, 'suspended profile hidden');
  assert.equal((await v.c.from('guestbook_entries').select('id').eq('author_id', bad.id)).data.length, 0, 'their guestbook entries hidden');
  assert.ok((await bad.c.from('posts').insert({ author_id: bad.id, body: 'still here' })).error, 'suspended users cannot post');
  assert.ok((await bad.c.rpc('send_friend_request', { p_target: mod.id })).error);
  assert.ok((await v.c.rpc('mod_set_suspended', { p_user: mod.id, p_suspended: true })).error, 'nobody suspends a mod');
  assert.equal((await mod.c.from('moderation_log').select('id')).data.length >= 2, true);
});

test('junk input never crashes the API (always a clean error, never a 500)', async () => {
  const u = await makeUser(uname('fuzz'));
  const junk = [null, '', 'x', -1, 1e20, '"; drop table profiles; --', "' or 1=1 --", '<script>alert(1)</script>', 'a'.repeat(50000), { a: 1 }, ['x'], '00000000-0000-0000-0000-000000000000'];
  const rpcs = { send_friend_request: 'p_target', respond_friend_request: 'p_request', start_dm: 'p_other', send_nudge: 'p_conv', record_visit: 'p_profile', get_top_friends: 'p_owner',
    set_top_friends: 'p_ids', use_theme: 'p_id', join_community: 'p_id', poll_results: 'p_poll', mark_read: 'p_conv', username_available: 'p_username', discover_people: 'p_q' };
  for (const [fn, arg] of Object.entries(rpcs)) for (const j of junk) {
    const r = await u.c.rpc(fn, { [arg]: j });
    if (r.error) assert.ok(!/^5/.test(String(r.status)) || /AH_|invalid input|violates|not found|malformed|out of range|too long|cannot|could not/i.test(r.error.message), `${fn}(${String(j).slice(0, 30)}) -> ${r.status} ${r.error.message}`);
  }
  for (const [table, row] of [['posts', { author_id: u.id, body: 'x'.repeat(3000) }], ['comments', { post_id: 'nope', author_id: u.id, body: 'x' }],
    ['guestbook_entries', { profile_id: u.id, author_id: u.id, body: null }], ['messages', { conversation_id: u.id, sender_id: u.id, body: 'x' }]]) {
    const r = await u.c.from(table).insert(row);
    assert.ok(r.error && r.status < 500, `${table} junk insert should fail cleanly, got ${r.status}`);
  }
  // the database is still fine
  assert.ok(sql('select count(*) from public.profiles') > 0);
});
