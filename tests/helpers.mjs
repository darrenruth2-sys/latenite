// Test helpers: talk to the local Supabase-compatible stack exactly like the app does.
import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';
const env = Object.fromEntries(fs.readFileSync('/home/claude/stack/keys.env', 'utf8').trim().split('\n').map(l => l.split(/=(.*)/s).slice(0, 2)));
export const URL = 'http://127.0.0.1:54321';
export const ANON = env.ANON_KEY; export const SERVICE = env.SERVICE_KEY;
const opts = { auth: { persistSession: false, autoRefreshToken: false }, realtime: { params: {} } };
export const admin = createClient(URL, SERVICE, opts);
export const anon = () => createClient(URL, ANON, opts);
let n = 0;
export async function makeUser(username, extra = {}) {
  const email = `${username}.${Date.now()}.${n++}@test.local`;
  const { data, error } = await admin.auth.admin.createUser({ email, password: 'password123', email_confirm: true,
    user_metadata: { username, display_name: extra.display_name || username, birthdate: extra.birthdate || '1995-05-05' } });
  if (error) throw new Error('createUser ' + username + ': ' + error.message);
  const c = createClient(URL, ANON, opts);
  const { error: e2 } = await c.auth.signInWithPassword({ email, password: 'password123' });
  if (e2) throw e2;
  return { id: data.user.id, email, c, username };
}
export async function befriend(a, b) {
  const r1 = await a.c.rpc('send_friend_request', { p_target: b.id }); if (r1.error) throw r1.error;
  const r2 = await b.c.rpc('send_friend_request', { p_target: a.id }); if (r2.error) throw r2.error;
  if (r2.data !== 'accepted') throw new Error('befriend: ' + r2.data);
}
export const uname = (p) => (p + Math.random().toString(36).slice(2, 8)).slice(0, 20);
