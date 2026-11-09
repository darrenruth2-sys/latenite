import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) await supabase.from('profile_settings').update({ discover_feed: true }).eq('id', user.id);
  return NextResponse.redirect(new URL('/feed?tab=discover', request.url), 303);
}
