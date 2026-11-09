import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// Email confirmation + password reset links land here with a one-time code.
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const tokenHash = url.searchParams.get('token_hash');
  const type = url.searchParams.get('type');
  const nextParam = url.searchParams.get('next') || '/feed';
  const next = nextParam.startsWith('/') && !nextParam.startsWith('//') ? nextParam : '/feed';
  const supabase = await createClient();
  let ok = false;
  if (code) ok = !(await supabase.auth.exchangeCodeForSession(code)).error;
  else if (tokenHash && type) ok = !(await supabase.auth.verifyOtp({ token_hash: tokenHash, type: type as 'signup' | 'recovery' | 'email' })).error;
  const dest = new URL(ok ? next : '/login?error=link', url.origin);
  return NextResponse.redirect(dest);
}
