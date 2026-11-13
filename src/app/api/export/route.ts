import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// Everything stored about the signed-in user, as JSON. Uses their own session, so RLS limits it to data they're allowed to see.
// [output key, table, column, value-is-me]. Some tables appear twice: things you did, and things people did to you.
const QUERIES: [string, string, string][] = [
  ['profiles', 'profiles', 'id'], ['profile_details', 'profile_details', 'id'], ['profile_private', 'profile_private', 'id'],
  ['profile_settings', 'profile_settings', 'id'], ['presence', 'presence', 'user_id'],
  ['posts', 'posts', 'author_id'], ['comments', 'comments', 'author_id'], ['reactions', 'reactions', 'user_id'],
  ['friend_requests_sent', 'friend_requests', 'sender_id'], ['friend_requests_received', 'friend_requests', 'recipient_id'],
  ['blocks', 'blocks', 'blocker_id'], ['notifications', 'notifications', 'user_id'], ['reports', 'reports', 'reporter_id'],
  ['top_friends', 'top_friends', 'owner_id'],
  ['guestbook_entries_written', 'guestbook_entries', 'author_id'], ['guestbook_on_my_page', 'guestbook_entries', 'profile_id'],
  ['guestbook_reactions', 'guestbook_reactions', 'user_id'],
  ['profile_themes', 'profile_themes', 'owner_id'], ['theme_history', 'theme_history', 'owner_id'],
  ['conversation_memberships', 'conversation_members', 'user_id'],
  ['blog_posts', 'blog_posts', 'author_id'], ['bulletins', 'bulletins', 'author_id'],
  ['polls', 'polls', 'owner_id'], ['poll_votes', 'poll_votes', 'voter_id'],
  ['communities_started', 'communities', 'created_by'], ['community_memberships', 'community_members', 'user_id'],
  ['community_posts', 'community_posts', 'author_id'],
  ['gifts_sent', 'gifts', 'sender_id'], ['gifts_received', 'gifts', 'recipient_id'],
['badges', 'user_badges', 'user_id'],
];

const PAGE = 1000; // the API returns at most 1000 rows per request, so page through everything

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function all(build: (from: number, to: number) => PromiseLike<{ data: any[] | null; error: unknown }>) {
  const rows: unknown[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await build(from, from + PAGE - 1);
    // First page refused = you have no access to that table (skip it). A later page failing = don't hand over half a list.
    // Only a "you don't have access to this table" refusal is skipped (and listed in the file). Anything else stops the export.
    if (error) { if (from === 0 && (error as { code?: string }).code === '42501') return null; throw new Error('export interrupted'); }
    rows.push(...(data || []));
    if (!data || data.length < PAGE) return rows;
  }
}

export async function GET() {
  try { return await build(); } catch {
    return NextResponse.json({ error: 'Your export was interrupted before it finished. Please try again in a minute.' }, { status: 503 });
  }
}

async function build() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not logged in' }, { status: 401 });
  const out: Record<string, unknown> = { exported_at: new Date().toISOString(), account: { id: user.id, email: user.email, created_at: user.created_at } };
  const notIncluded: string[] = [];

  for (const [key, table, col] of QUERIES) {
    const rows = await all((a, b) => supabase.from(table).select('*').eq(col, user.id).range(a, b));
    if (rows) out[key] = rows; else notIncluded.push(key);
  }

  // Full lists, a page at a time (the UI versions are capped at 500 friends / 50 visitors). Any failure stops the export.
  async function rpcAll(fn: string) {
    const rows: unknown[] = [];
    for (let off = 0; ; off += PAGE) {
      const { data, error } = await supabase.rpc(fn, { p_offset: off, p_limit: PAGE });
      if (error) throw new Error('export interrupted');
      rows.push(...((data as unknown[]) || []));
      if (!data || (data as unknown[]).length < PAGE) return rows;
    }
  }
  out.friends = await rpcAll('export_my_friends');
  out.visitors_to_my_page = await rpcAll('export_my_visitors');
  const { data: visited, error: hErr } = await supabase.rpc('my_visit_history');
  if (hErr) throw new Error('export interrupted');
  out.pages_i_visited = visited;

  // Your chats: every conversation you're in, with the whole history (your messages and the replies).
  const convIds = ((out.conversation_memberships as { conversation_id: string }[]) || []).map((m) => m.conversation_id);
  const conversations: unknown[] = [];
  for (let i = 0; i < convIds.length; i += 100) {
    const ids = convIds.slice(i, i + 100);
    const conv = await all((a, b) => supabase.from('conversations').select('*').in('id', ids).range(a, b));
    if (conv === null) { notIncluded.push('conversations'); break; }
    for (const c of (conv || []) as { id: string }[]) {
      const msgs = await all((a, b) => supabase.from('messages').select('id, sender_id, kind, body, media_path, created_at')
        .eq('conversation_id', c.id).order('created_at').range(a, b));
      if (msgs === null && !notIncluded.includes('messages')) notIncluded.push('messages');
      conversations.push({ ...c, messages: msgs || [] });
    }
  }
  out.conversations = conversations;
  // Sections your account isn't allowed to read directly (normally none). Listed so the file never looks complete when it isn't.
  if (notIncluded.length) out._not_included = notIncluded;

  return new NextResponse(JSON.stringify(out, null, 2), {
    headers: { 'content-type': 'application/json', 'content-disposition': `attachment; filename="signedon-export-${new Date().toISOString().slice(0, 10)}.json"`, 'cache-control': 'no-store' },
  });
}
