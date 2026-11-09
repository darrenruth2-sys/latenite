import test from 'node:test'; import assert from 'node:assert/strict';
import { anon, makeUser, befriend, uname } from './helpers.mjs';

test('blogs: drafts private, publish creates feed card, visibility, unpublish', async () => {
  const a = await makeUser(uname('blogger')); const f = await makeUser(uname('reader')); const s = await makeUser(uname('outsider'));
  await befriend(a, f);
  const d = await a.c.from('blog_posts').insert({ author_id: a.id, title: 'Every burned CD, ranked', slug: 'every-burned-cd', body: { type: 'doc', content: [] } }).select().single();
  assert.equal(d.error, null);
  assert.equal((await f.c.from('blog_posts').select('id').eq('id', d.data.id)).data.length, 0, 'drafts are private');
  await a.c.from('blog_posts').update({ status: 'published', visibility: 'friends', excerpt: 'it started as a cleaning project' }).eq('id', d.data.id);
  assert.equal((await f.c.from('blog_posts').select('id').eq('id', d.data.id)).data.length, 1);
  assert.equal((await s.c.from('blog_posts').select('id').eq('id', d.data.id)).data.length, 0, 'friends-only');
  const card = await f.c.rpc('friend_feed', { p_limit: 50 });
  assert.ok(card.data.some((p) => p.kind === 'blog' && p.meta.slug === 'every-burned-cd'), 'blog card in feed');
  await a.c.from('blog_posts').update({ visibility: 'public' }).eq('id', d.data.id);
  assert.equal((await anon().from('blog_posts').select('id').eq('id', d.data.id)).data.length, 1, 'public post readable logged out');
  await a.c.from('blog_posts').update({ status: 'draft' }).eq('id', d.data.id);
  assert.ok(!(await f.c.rpc('friend_feed', { p_limit: 50 })).data.some((p) => p.kind === 'blog'), 'unpublish removes feed card');
  assert.ok((await a.c.from('blog_posts').insert({ author_id: a.id, title: 'x', slug: 'Bad Slug!' })).error);
  assert.ok((await f.c.from('blog_posts').update({ title: 'hacked' }).eq('id', d.data.id).select()).data?.length === 0);
  assert.ok((await a.c.from('user_badges').select('badge_key').eq('user_id', a.id)).data.some((b) => b.badge_key === 'blogger'));
});

test('bulletins + polls + gifts', async () => {
  const a = await makeUser(uname('bul')); const f = await makeUser(uname('bulf')); const s = await makeUser(uname('buls'));
  await befriend(a, f);
  await a.c.from('bulletins').insert({ author_id: a.id, body: 'roller rink friday' });
  assert.equal((await f.c.from('bulletins').select('id').eq('author_id', a.id)).data.length, 1);
  assert.equal((await s.c.from('bulletins').select('id').eq('author_id', a.id)).data.length, 0);
  const poll = await a.c.from('polls').insert({ owner_id: a.id, question: 'Best profile song energy?', options: ['Emo', 'Indie', 'Hip-hop'] }).select().single();
  assert.equal(poll.error, null);
  assert.ok((await a.c.from('polls').insert({ owner_id: a.id, question: 'bad', options: ['one'] })).error, 'need 2+ options');
  assert.equal((await f.c.rpc('poll_results', { p_poll: poll.data.id })).data.counts, null, 'no peeking before voting');
  assert.ok((await f.c.from('poll_votes').insert({ poll_id: poll.data.id, voter_id: f.id, option_idx: 7 })).error, 'option must exist');
  assert.equal((await f.c.from('poll_votes').insert({ poll_id: poll.data.id, voter_id: f.id, option_idx: 1 })).error, null);
  assert.ok((await f.c.from('poll_votes').insert({ poll_id: poll.data.id, voter_id: f.id, option_idx: 0 })).error, 'one vote each');
  assert.deepEqual((await f.c.rpc('poll_results', { p_poll: poll.data.id })).data.counts, [0, 1, 0]);
  assert.equal((await f.c.from('gifts').insert({ sender_id: f.id, recipient_id: a.id, gift_key: 'mixtape', message: 'for u' })).error, null);
  assert.ok((await s.c.from('gifts').insert({ sender_id: s.id, recipient_id: a.id, gift_key: 'rose' })).error, 'friends only');
  assert.ok((await f.c.from('gifts').insert({ sender_id: f.id, recipient_id: a.id, gift_key: 'malware' })).error, 'gift catalog only');
  assert.equal((await anon().from('gifts').select('id').eq('recipient_id', a.id)).data.length, 1, 'public gift shelf');
});

test('communities: public/private, roles, posts', async () => {
  const o = await makeUser(uname('cown')); const m = await makeUser(uname('cmem')); const s = await makeUser(uname('cstr'));
  await befriend(o, m);
  const { data: pub } = await o.c.rpc('create_community', { p_slug: 'label-makers', p_name: 'Label Makers Anonymous', p_description: 'we label everything' });
  const { data: priv } = await o.c.rpc('create_community', { p_slug: 'secret-club', p_name: 'Secret Club', p_description: null, p_public: false });
  assert.ok(pub && priv);
  assert.ok((await o.c.rpc('create_community', { p_slug: 'label-makers', p_name: 'Dupe', p_description: null })).error, 'unique slug');
  assert.equal((await s.c.from('communities').select('id').eq('id', priv)).data.length, 0, 'private hidden');
  assert.ok((await s.c.rpc('join_community', { p_id: priv })).error, 'cannot self-join private');
  assert.equal((await s.c.rpc('join_community', { p_id: pub })).error, null);
  assert.equal((await s.c.from('community_posts').insert({ community_id: pub, author_id: s.id, body: 'hi' })).error, null);
  assert.ok((await s.c.from('community_posts').insert({ community_id: priv, author_id: s.id, body: 'hi' })).error);
  assert.ok((await s.c.rpc('add_community_member', { p_id: priv, p_user: s.id })).error, 'non-mods cannot add');
  assert.equal((await o.c.rpc('add_community_member', { p_id: priv, p_user: m.id })).error, null);
  assert.equal((await m.c.from('communities').select('member_count').eq('id', priv).single()).data.member_count, 2);
  const sp = await s.c.from('community_posts').select('id').eq('community_id', pub);
  assert.equal((await o.c.from('community_posts').delete().eq('id', sp.data[0].id).select()).data.length, 1, 'owner moderates');
  assert.ok((await s.c.from('communities').update({ name: 'hijacked' }).eq('id', pub).select()).data?.length === 0);
});

test('themes gallery, discovery, discover feed opt-in', async () => {
  const a = await makeUser(uname('tm')); const b = await makeUser(uname('tu')); const shy = await makeUser(uname('shy'));
  const { data: tid } = await a.c.rpc('publish_theme', { p_name: 'Neon Static', p_tokens: { preset: 'static', accent: '#FF4FA3' } });
  assert.ok(tid);
  assert.ok((await a.c.rpc('publish_theme', { p_name: 'Bad', p_tokens: { page: 'url(evil)' } })).error, 'gallery validates themes');
  const used = await b.c.rpc('use_theme', { p_id: tid });
  assert.equal(used.data.accent, '#FF4FA3');
  assert.equal((await b.c.from('profile_details').select('theme').eq('id', b.id).single()).data.theme.preset, 'static');
  assert.equal((await anon().from('profile_themes').select('uses_count').eq('id', tid).single()).data.uses_count, 1);
  // discovery: interest search only finds opted-in people; username search finds anyone
  await a.c.from('profiles').update({ discoverable: true }).eq('id', a.id);
  await a.c.from('profile_details').update({ interests: ['vinyl', 'roller skating'], region: 'Ohio, USA' }).eq('id', a.id);
  await shy.c.from('profile_details').update({ interests: ['vinyl'] }).eq('id', shy.id);
  const byInterest = await b.c.rpc('discover_people', { p_interest: 'vinyl' });
  assert.ok(byInterest.data.some((x) => x.id === a.id)); assert.ok(!byInterest.data.some((x) => x.id === shy.id), 'non-discoverable hidden');
  assert.ok((await b.c.rpc('discover_people', { p_q: shy.username })).data.some((x) => x.id === shy.id), 'username search finds anyone');
  assert.ok((await b.c.rpc('discover_people', { p_region: 'ohio' })).data.some((x) => x.id === a.id));
  await a.c.from('posts').insert({ author_id: a.id, body: 'public hello', visibility: 'public' });
  assert.equal((await b.c.rpc('discover_feed')).data.length, 0, 'discover feed off by default');
  await b.c.from('profile_settings').update({ discover_feed: true }).eq('id', b.id);
  assert.ok((await b.c.rpc('discover_feed')).data.some((p) => p.author_id === a.id));
});
