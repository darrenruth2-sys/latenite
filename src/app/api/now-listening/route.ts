import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { lastfmConfigured, recentTrack } from '@/lib/lastfm';

export const dynamic = 'force-dynamic';

// What a profile owner is listening to, via Last.fm. Only if they share it and you're allowed to see their page
// (the database checks both, as you). Their Last.fm username never leaves the server.
export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('u') || '';
  if (!lastfmConfigured() || !/^[0-9a-f-]{36}$/.test(id)) return NextResponse.json(null, { status: 404 });
  const supabase = await createClient();
  const { data: user } = await supabase.rpc('listening_target', { p_profile: id });
  if (!user) return NextResponse.json(null, { status: 404 });
  const track = await recentTrack(String(user));
  return NextResponse.json(track, { headers: { 'Cache-Control': 'private, max-age=15' } });
}
