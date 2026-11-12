import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// Everything stored about the signed-in user, as JSON. Uses their own session, so RLS limits it to their data.
const TABLES: [string, string][] = [
  ['profiles', 'id'], ['profile_details', 'id'], ['profile_private', 'id'], ['profile_settings', 'id'],
  ['posts', 'author_id'], ['comments', 'author_id'], ['reactions', 'user_id'], ['friend_requests', 'sender_id'],
  ['blocks', 'blocker_id'], ['notifications', 'user_id'], ['reports', 'reporter_id'],
  ['top_friends', 'owner_id'], ['guestbook_entries', 'author_id'], ['profile_themes', 'owner_id'], ['theme_history', 'owner_id'],
  ['messages', 'sender_id'], ['conversation_members', 'user_id'], ['presence', 'user_id'],
  ['blog_posts', 'author_id'], ['bulletins', 'author_id'], ['polls', 'owner_id'], ['poll_votes', 'voter_id'],
  ['community_members', 'user_id'], ['gifts', 'sender_id'], ['user_badges', 'user_id'],
];

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not logged in' }, { status: 401 });
  const out: Record<string, unknown> = { exported_at: new Date().toISOString(), account: { id: user.id, email: user.email, created_at: user.created_at } };
  for (const [table, col] of TABLES) {
    const { data, error } = await supabase.from(table).select('*').eq(col, user.id).limit(10000);
    if (!error) out[table] = data;
  }
  const { data: friends } = await supabase.rpc('friends_of', { p_user: user.id, p_limit: 500 });
  out.friends = friends;
  const { data: gbOnMine } = await supabase.from('guestbook_entries').select('*').eq('profile_id', user.id).limit(10000);
  if (gbOnMine) out.guestbook_on_my_page = gbOnMine;
  return new NextResponse(JSON.stringify(out, null, 2), {
    headers: { 'content-type': 'application/json', 'content-disposition': `attachment; filename="signedon-export-${new Date().toISOString().slice(0, 10)}.json"`, 'cache-control': 'no-store' },
  });
}
