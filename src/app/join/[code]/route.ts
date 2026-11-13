import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// Invite link: signedon.social/join/SO-ABCD-EFGH. A good code unlocks the signup page (the database checks the
// code again, and uses it up, when the account is actually created).
export async function GET(request: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const clean = decodeURIComponent(code).toUpperCase().replace(/\s/g, '');
  const ok = /^SO-[A-Z2-9]{4}-[A-Z2-9]{4}$/.test(clean) && !!(await (await createClient()).rpc('invite_check', { p_code: clean })).data;
  const url = new URL(ok ? '/signup' : '/soon', request.url);
  if (!ok) url.searchParams.set('invite', 'bad');
  const res = NextResponse.redirect(url);
  if (ok) res.cookies.set('so_invite', clean, { httpOnly: true, secure: url.protocol === 'https:', sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 14 });
  return res;
}
