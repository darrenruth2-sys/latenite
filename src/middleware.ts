import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

const PROTECTED = ['/feed', '/friends', '/settings', '/notifications', '/messenger', '/discover', '/blog/new', '/blog/edit', '/bulletins', '/communities/new', '/memories', '/mod', '/themes/mine'];

// Pre-launch: LAUNCH_MODE=soon shows the coming-soon page everywhere, except for:
//  - people holding the preview key (the founder),
//  - beta testers who are signed in (accounts can only be made with an invite code while invite-only is on),
//  - someone holding a checked invite code, who may reach the signup page.
const SOON_OPEN = ['/soon', '/privacy', '/rules', '/terms', '/preview', '/copyright', '/report-content', '/api/sentinel', '/join'];
// Pages beta testers need before they're signed in.
const SOON_AUTH = ['/login', '/forgot', '/reset-password', '/check-email', '/auth'];
const INVITE_COOKIE = 'so_invite';

export async function middleware(request: NextRequest) {
  const path0 = request.nextUrl.pathname;
  const soon = process.env.LAUNCH_MODE === 'soon';
  const key = process.env.PREVIEW_KEY;
  const previewing = soon && !!key && key.length >= 12 && request.cookies.get('ln_preview')?.value === key;
  if (soon && !previewing) {
    const under = (list: string[]) => list.some((p) => path0 === p || path0.startsWith(p + '/'));
    if (under(SOON_OPEN)) return NextResponse.next();
    // beta: the auth pages, and signup for invite holders, are reachable; everything else needs a signed-in tester
    const invited = !!request.cookies.get(INVITE_COOKIE)?.value;
    if (!under(SOON_AUTH) && !(invited && path0 === '/signup')) {
      const hasSession = request.cookies.getAll().some((c) => c.name.startsWith('sb-') && c.name.includes('-auth-token'));
      if (!hasSession) return soonPage(request, path0);
    }
  }
  let response = NextResponse.next({ request });
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        list.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });
  const { data: { user } } = await supabase.auth.getUser();
  const path = request.nextUrl.pathname;
  // pre-launch: a cookie alone isn't enough, the session has to be real
  if (soon && !previewing && !user && !SOON_AUTH.some((p) => path === p || path.startsWith(p + '/'))
      && !(path === '/signup' && request.cookies.get(INVITE_COOKIE)?.value)) return soonPage(request, path);
  if (!user && PROTECTED.some((p) => path === p || path.startsWith(p + '/'))) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.search = '?next=' + encodeURIComponent(path + request.nextUrl.search);
    return NextResponse.redirect(url);
  }
  if (user && (path === '/login' || path === '/signup')) {
    const url = request.nextUrl.clone(); url.pathname = '/feed'; url.search = '';
    return NextResponse.redirect(url);
  }
  return response;
}

function soonPage(request: NextRequest, path: string) {
  if (path.startsWith('/api/') || path.startsWith('/auth/')) return new NextResponse('Not open yet', { status: 404 });
  const url = request.nextUrl.clone(); url.pathname = '/soon'; url.search = '';
  return NextResponse.rewrite(url);
}

export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|woff2?)$).*)'] };
